// dsh-custom（「DSH自定义」）P0 运行时半：
//   ① 存储骨架：$DSH_HOME/dsh-custom/（discipline.md / override.md / scope.json / meta.json / backups/ / audit.jsonl）
//   ② 防静默改写护栏（语义 b 的 P0 保守子集：拦截＋提示＋留痕；确认放行随 P2）
//   ③ 装配读取：ctx.systemPrompt.assemble() → 分区归属 + renderPrompt 实际渲染（只读）
//   ④ HTTP 数据面：/api/dsh-custom/{assembly,status}（webServer 服务；浏览器半 client.js 消费）
// 设计档：D:/DeepSeek/dsh-plugin-dev/docs/design-specs/dsh-custom-prompt-design-20261017.md
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ── 路径与会话外定位 ──────────────────────────────────────────────

export function resolveHome(env: Record<string, string | undefined> = process.env): string {
  const h = env.DSH_HOME?.trim()
  return h && h.length > 0 ? h : join(homedir(), '.dsh')
}

export function storageRoot(env: Record<string, string | undefined> = process.env): string {
  return join(resolveHome(env), 'dsh-custom')
}

export function squash(p: string): string {
  return String(p ?? '').replace(/[\\/]+/g, '/').toLowerCase()
}

export function containsPath(haystack: string, root: string): boolean {
  const h = squash(haystack)
  const r = squash(root)
  if (r.length === 0) return false
  let i = 0
  while ((i = h.indexOf(r, i)) !== -1) {
    const nxt = h[i + r.length] ?? ''
    const prv = i > 0 ? h[i - 1] : ''
    if (!/[a-z0-9_.\-]/.test(nxt) && !/[a-z0-9_-]/.test(prv)) return true
    i += r.length
  }
  return false
}

export function isInsideStorage(candidate: string, root: string): boolean {
  return containsPath(candidate, root)
}

// ── 护栏判定（纯函数，可测）──────────────────────────────────────

const SHELL_TOOLS = new Set(['bash', 'shell', 'sh', 'powershell', 'pwsh', 'cmd', 'exec', 'run_command', 'terminal'])
const WRITE_TOOL_RE = /(write|edit|patch|create|mkdir|touch|move|rename|copy|delete|remove|unlink|erase|truncate|save|append|upload)/
// #决策 2026-10-17 15:46 护栏误报修复（D1）：原 `>\s*\S` 把 `2>&1` / `>$null` 这类流合并、空重定向
// 误判为文件写（实机误拦一条只读 pwsh 命令，证据=audit guard-deny 行）；写类短动词（del/rm/cp 等）
// 收窄为「命令位」匹配，防正文/路径片段误伤；PowerShell 长动词补齐 move/copy/rename/set-item。
const SHELL_WRITE_NAMES_RE = /(remove-item|set-content|add-content|out-file|new-item|clear-content|set-item|move-item|copy-item|rename-item|writefile|writealltext|writeallbytes|unlink|rmtree|os\.remove|shutil)/i
const SHELL_WRITE_VERB_RE = /(?:^|[\r\n;&|(){}'"`])\s*(?:rmdir|rename|erase|mkdir|move|copy|del|rd|rm|mv|cp|ren)(?=\s)/i
const SHELL_REDIRECT_RE = /(?<![=\-])>+[ \t]*(?!=)(?!&[0-9]|\$null\b|nul\b|\$env:NUL\b)(?=\S)/i

export function flattenStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') {
    out.push(v)
    return out
  }
  if (Array.isArray(v)) {
    for (const x of v) flattenStrings(x, out)
    return out
  }
  if (v && typeof v === 'object') {
    for (const x of Object.values(v as Record<string, unknown>)) flattenStrings(x, out)
  }
  return out
}

export interface GuardDecision {
  touches: boolean
  action: 'allow' | 'deny'
  reason?: string
}

export function guardDecision(toolName: string, args: unknown, root: string): GuardDecision {
  const name = String(toolName ?? '').toLowerCase()
  const blobs = flattenStrings(args)
  const touches = blobs.length > 0 && blobs.some((s) => containsPath(s, root))
  if (!touches) return { touches: false, action: 'allow' }

  const isShell = SHELL_TOOLS.has(name)
  const isWriteTool = !isShell && WRITE_TOOL_RE.test(name)
  const joined = isShell ? blobs.join(' ') : ''
  const shellWrites =
    isShell && (SHELL_WRITE_NAMES_RE.test(joined) || SHELL_WRITE_VERB_RE.test(joined) || SHELL_REDIRECT_RE.test(joined))

  if (isWriteTool || shellWrites) {
    return {
      touches: true,
      action: 'deny',
      reason:
        `「DSH自定义」护栏：目标位于插件存储 ${root}。语义 b＝允许改动但必须经提示/确认并留痕；` +
        `P0 保守子集先拦截（确认放行随 P2 交付）。请改用「DSH自定义」设置页管理，或先向用户说明意图再让用户放行。`,
    }
  }
  return { touches: true, action: 'allow' }
}

// ── 存储骨架 ─────────────────────────────────────────────────────

export interface StorageInfo {
  root: string
  created: string[]
}

const SEED_FILES: Record<string, string> = {
  'discipline.md': '',
  'user-prompt.md': '',
  'override.md': '',
  'scope.json': '{\n  "version": 1,\n  "rules": []\n}\n',
  'settings.json': '{\n  "version": 1,\n  "injectEnabled": true\n}\n',
  'layered-state.json': '{\n  "version": 1,\n  "enabled": {}\n}\n',
  // 治理开关（P46，2026-10-18）：页面写 → 运行时插件 mtime 热读（layered-state 同款跨包管道）。
  // 刻意不加入 TRACKED（可再生态，回滚语义不覆盖它）。
  'governance.json': '{\n  "version": 1\n}\n',
}

// 2026-10-19 修复批：user-prompt.md 原漏出 TRACKED ⇒ 快照/外部改动/状态面都看不到「我的提示词」——
// 快照跑在写 user-prompt 之前却复制不到它，回滚会丢这段。补齐。
// 2026-10-19 备份完整性批：layered-state.json（渐进层启停表）同为「改提示词状态」的一部分，纳入 TRACKED
// （layered/ 目录内容由 snapshot() 单独复制，见该函数）。
const TRACKED = ['discipline.md', 'user-prompt.md', 'override.md', 'scope.json', 'settings.json', 'layered-state.json']

// 快照保留策略（#决策 19：保留最近 N 个自动清理，默认 20）。
const BACKUP_KEEP = 20
const BACKUP_STAMP_RE = /^\d{4}-\d{2}-\d{2}T[0-9-]+Z?$/

/**
 * 按「保留最近 keep 个」清理一个快照目录（只认标准时间戳目录名；非标准名不动）。
 * 名称=ISO 时间戳（冒号/点换连字符），字典序即时序，取新弃旧。
 * @returns 被清理的目录名（供审计留痕）。
 */
export function pruneBackupDir(dir: string, keep: number): string[] {
  let names: string[] = []
  try {
    names = readdirSync(dir).filter((n) => BACKUP_STAMP_RE.test(n))
  } catch (e) {
    const code = (e as { code?: unknown })?.code
    if (code !== 'ENOENT') console.warn(`[dsh-custom] 快照清理扫描失败（${String(code ?? e)}）：${dir}`)
    return []
  }
  const removed: string[] = []
  for (const n of names.sort().reverse().slice(keep)) {
    try {
      rmSync(join(dir, n), { recursive: true, force: true })
      removed.push(n)
    } catch (e) {
      console.warn(`[dsh-custom] 旧快照清理失败（${n}）：`, String((e as { message?: unknown })?.message ?? e))
    }
  }
  return removed
}

export function ensureStorage(root: string): StorageInfo {
  const created: string[] = []
  for (const d of [root, join(root, 'backups')]) {
    if (!existsSync(d)) {
      mkdirSync(d, { recursive: true })
      created.push(d)
    }
  }
  for (const [name, seed] of Object.entries(SEED_FILES)) {
    const p = join(root, name)
    if (!existsSync(p)) {
      writeFileSync(p, seed, 'utf8')
      created.push(p)
    }
  }
  const meta = join(root, 'meta.json')
  if (!existsSync(meta)) {
    writeFileSync(meta, JSON.stringify({ version: 1, hashes: {}, updatedAt: null }, null, 2) + '\n', 'utf8')
    created.push(meta)
  }
  return { root, created }
}

export function audit(root: string, entry: Record<string, unknown>): void {
  try {
    mkdirSync(root, { recursive: true })
    appendFileSync(join(root, 'audit.jsonl'), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8')
  } catch (e) {
    // 留痕失败不阻断主流程；审计自身失败无法再入审计，降级到控制台兜底（#决策 2026-10-17 D2：不留空 catch）
    console.warn('[dsh-custom] audit 写入失败：', String((e as { message?: unknown })?.message ?? e))
  }
}

export function hashOfFile(p: string): string | null {
  try {
    return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16)
  } catch (e) {
    // 文件不存在（ENOENT）属常态；其余读取失败须可见（#决策 2026-10-17 D2）
    const code = (e as { code?: unknown })?.code
    if (code !== 'ENOENT') console.warn(`[dsh-custom] 存储文件读取失败（${String(code ?? e)}）：${p}`)
    return null
  }
}

export interface ExternalChange {
  file: string
  from: string | null
  to: string | null
}

export function detectExternalChanges(root: string): ExternalChange[] {
  const metaPath = join(root, 'meta.json')
  let meta: { version?: number; hashes?: Record<string, string | null>; updatedAt?: string | null } = {}
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch (e) {
    // meta 不存在（首启动）属常态；损坏/不可读须留痕（#决策 2026-10-17 D2）
    const code = (e as { code?: unknown })?.code
    if (code !== 'ENOENT') audit(root, { kind: 'meta-read-fail', detail: String(code ?? (e as { message?: unknown })?.message ?? e) })
    meta = {}
  }
  const prev = meta.hashes ?? {}
  const changes: ExternalChange[] = []
  const next: Record<string, string | null> = {}
  for (const f of TRACKED) {
    const h = hashOfFile(join(root, f))
    next[f] = h
    if (f in prev && prev[f] !== h) changes.push({ file: f, from: prev[f] ?? null, to: h })
  }
  meta.version = 1
  meta.hashes = next
  meta.updatedAt = new Date().toISOString()
  try {
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8')
  } catch (e) {
    audit(root, { kind: 'meta-write-fail', detail: String(e) })
  }
  for (const c of changes) audit(root, { kind: 'external-change', file: c.file, from: c.from, to: c.to })
  return changes
}

/** 备份目录唯一名（2026-10-19 CI 修复）：毫秒级时间戳在快机/CI 上可同毫秒撞名——追加序号保唯一（同毫秒连续快照不再互相覆盖）。 */
export function uniqueBackupName(base: string, exists: (name: string) => boolean): string {
  if (!exists(base)) return base
  for (let i = 1; i <= 999; i++) {
    const cand = `${base}-${i}`
    if (!exists(cand)) return cand
  }
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

export function snapshot(root: string, reason: string): string {
  const base = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
  const stamp = uniqueBackupName(base, (n) => existsSync(join(root, 'backups', n)))
  const dir = join(root, 'backups', stamp)
  mkdirSync(dir, { recursive: true })
  const copied: string[] = []
  for (const f of TRACKED) {
    const src = join(root, f)
    if (existsSync(src)) {
      copyFileSync(src, join(dir, f))
      copied.push(f)
    }
  }
  // 2026-10-19 备份完整性批：layered/ 目录内容（用户改写/自建分节）随快照复制（平铺一层，任何扩展名全收）——
  // 此前 layered 的 保存/恢复出厂/删除 都拍快照但快照不含实际文件 ⇒ 自建删除与出厂改写无真备份（本批闭环）。
  const layeredCopied: string[] = []
  try {
    const ldir = join(root, 'layered')
    for (const f of readdirSync(ldir)) {
      const src = join(ldir, f)
      try { if (!statSync(src).isFile()) continue } catch { continue }
      mkdirSync(join(dir, 'layered'), { recursive: true })
      copyFileSync(src, join(dir, 'layered', f))
      layeredCopied.push(f)
    }
  } catch (e) {
    const code = (e as { code?: unknown })?.code
    if (code !== 'ENOENT') console.warn('[dsh-custom] layered 快照复制失败：', String((e as { message?: unknown })?.message ?? e))
  }
  audit(root, { kind: 'snapshot', reason, dir, files: copied, ...(layeredCopied.length > 0 ? { layered: layeredCopied } : {}) })
  const pruned = pruneBackupDir(join(root, 'backups'), BACKUP_KEEP)
  if (pruned.length > 0) audit(root, { kind: 'snapshot-pruned', removed: pruned, keep: BACKUP_KEEP })
  return dir
}

// ── 纪律前置：存储读写 / 开关 / 段注册（P1；#决策 2026-10-17 16:38）──

export const DISCIPLINE_SECTION = 'dsh-custom:discipline'
export const DISCIPLINE_ORDER = -2000

interface CachedFile { mtimeMs: number; text: string }
const fileCache = new Map<string, CachedFile>()

/** mtime 缓存的整文件读；变更即重读（热生效的底座）。 */
function readCachedFile(p: string): { text: string; mtimeMs: number } | null {
  try {
    const st = statSync(p)
    const hit = fileCache.get(p)
    if (hit !== undefined && hit.mtimeMs === st.mtimeMs) return { text: hit.text, mtimeMs: hit.mtimeMs }
    const text = readFileSync(p, 'utf8')
    fileCache.set(p, { mtimeMs: st.mtimeMs, text })
    return { text, mtimeMs: st.mtimeMs }
  } catch (e) {
    const code = (e as { code?: unknown })?.code
    if (code !== 'ENOENT') console.warn(`[dsh-custom] 读取失败（${String(code ?? e)}）：${p}`)
    fileCache.delete(p)
    return null
  }
}

/**
 * 插件自身写盘后立即失效该路径的 mtime 缓存（#决策 2026-10-19 D3）：
 * mtimeMs 精度有限，同一时间片内的「写 → 立即读」可能命中旧缓存；写后主动失效即可保证读到新值。
 * 只做「写后失效」，读取路径仍走 mtime 缓存（性能口径不变）。
 */
function forgetCachedFile(p: string): void {
  fileCache.delete(p)
}

/** 插件自身写入后登记哈希：避免下一次外部改动检测把本插件的写误报为会话外改动。 */
function recordHashes(root: string, files: string[]): void {
  const metaPath = join(root, 'meta.json')
  let meta: { version?: number; hashes?: Record<string, string | null>; updatedAt?: string | null } = {}
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch (e) {
    const code = (e as { code?: unknown })?.code
    if (code !== 'ENOENT') audit(root, { kind: 'meta-read-fail', detail: String(code ?? e) })
    meta = {}
  }
  meta.version = 1
  meta.hashes = meta.hashes ?? {}
  for (const f of files) meta.hashes[f] = hashOfFile(join(root, f))
  meta.updatedAt = new Date().toISOString()
  try {
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8')
  } catch (e) {
    audit(root, { kind: 'meta-write-fail', detail: String((e as { message?: unknown })?.message ?? e) })
  }
}

export interface InjectSettings {
  enabled: boolean
  overrideEnabled: boolean
}

export function readInjectSettings(root: string): InjectSettings {
  const f = readCachedFile(join(root, 'settings.json'))
  if (f === null) return { enabled: true, overrideEnabled: false } // 缺失=纪律开/深改关（设计 §8.4）
  try {
    const j = JSON.parse(f.text) as { injectEnabled?: unknown; overrideEnabled?: unknown }
    return { enabled: j?.injectEnabled !== false, overrideEnabled: j?.overrideEnabled === true }
  } catch (e) {
    console.warn('[dsh-custom] settings.json 损坏，按默认（纪律开/深改关）处理：', String((e as { message?: unknown })?.message ?? e))
    return { enabled: true, overrideEnabled: false }
  }
}

export interface DisciplineState {
  enabled: boolean
  text: string
  sourceText: string
  mtime: string | null
}

export function readDiscipline(root: string): DisciplineState {
  detectExternalChanges(root) // 组装前哈希对照：会话外改动即留痕（设计 §4）
  const md = readCachedFile(join(root, 'discipline.md'))
  const sourceText = md?.text ?? ''
  const cfg = readInjectSettings(root)
  return {
    enabled: cfg.enabled,
    text: cfg.enabled ? sourceText : '',
    sourceText,
    mtime: md === null ? null : new Date(md.mtimeMs).toISOString(),
  }
}

export function saveDiscipline(root: string, text: string): DisciplineState {
  const cur = readDiscipline(root)
  if (cur.sourceText === text) {
    // P1-10 幂等：内容未变不重写、不建快照（防重复提交刷快照挤掉有意义的历史）
    audit(root, { kind: 'save-noop', target: 'discipline' })
    return cur
  }
  snapshot(root, 'save-discipline')
  writeFileSync(join(root, 'discipline.md'), text, 'utf8')
  forgetCachedFile(join(root, 'discipline.md'))
  recordHashes(root, ['discipline.md'])
  audit(root, { kind: 'discipline-saved', bytes: Buffer.byteLength(text, 'utf8') })
  return readDiscipline(root)
}

// ── P5：用户自定义提示词段（user-prompt.md——与常驻核心区分，可开关；空=不注入）──
// 装配序：常驻核心(-2000) → 我的提示词(-1990) → 官方面(0)。
export const USER_PROMPT_SECTION = 'dsh-custom:user-prompt'
export const USER_PROMPT_ORDER = -1990

export function userPromptSectionName(): string {
  return USER_PROMPT_SECTION
}

export interface UserPromptState {
  enabled: boolean
  text: string
  mtime: string | null
}

export function readUserPrompt(root: string): UserPromptState {
  const f = readCachedFile(join(root, 'user-prompt.md'))
  const j = readSettingsJson(root)
  return {
    enabled: j?.userPromptEnabled !== false,
    text: f?.text ?? '',
    mtime: f === null ? null : new Date(f.mtimeMs).toISOString(),
  }
}

function readSettingsJson(root: string): { injectEnabled?: boolean; overrideEnabled?: boolean; userPromptEnabled?: boolean } | null {
  const f = readCachedFile(join(root, 'settings.json'))
  if (f === null) return null
  try {
    return JSON.parse(f.text)
  } catch {
    return null
  }
}

export function saveUserPrompt(root: string, text: string, enabled = true): UserPromptState {
  const cur = readUserPrompt(root)
  if (cur.text === text && cur.enabled === enabled) {
    // P1-10 幂等：内容与开关都未变→不重写、不建快照
    audit(root, { kind: 'save-noop', target: 'user-prompt' })
    return cur
  }
  snapshot(root, 'save-user-prompt')
  writeFileSync(join(root, 'user-prompt.md'), text, 'utf8')
  forgetCachedFile(join(root, 'user-prompt.md'))
  const merged = { ...(readSettingsJson(root) ?? {}), userPromptEnabled: enabled }
  writeFileSync(join(root, 'settings.json'), JSON.stringify(merged, null, 2) + '\n', 'utf8')
  forgetCachedFile(join(root, 'settings.json'))
  recordHashes(root, ['user-prompt.md'])
  audit(root, { kind: 'user-prompt-saved', bytes: Buffer.byteLength(text, 'utf8'), enabled })
  return readUserPrompt(root)
}

/** 组装期求值：开+非空→文本；否则空串（渲染期自动剔除）。 */
export function userPromptTextFor(root: string): string {
  const st = readUserPrompt(root)
  return st.enabled ? st.text : ''
}

// ── P4/P5：渐进加载层管理（出厂=包内 content/layered 副本；用户改动落 $root/layered/）──
// 启用状态表 layered-state.json（分节名→bool；缺失=启用）。分节名白名单=出厂清单（防越权路径）。
export interface LayeredSectionView {
  name: string
  force: 'M' | 'S' | 'X'
  enabled: boolean
  modified: boolean
  chars: number
  text: string
}

const FACTORY_LAYERED_DIR = fileURLToPath(new URL('../content/layered/', import.meta.url))

function factoryLayeredNames(): string[] {
  try {
    return readdirSync(FACTORY_LAYERED_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
  } catch {
    return []
  }
}

/** 从 00-加载清单.md 提取分节强制级（M/S；提取不到=按文件名映射兜底，再不济=S）。 */
function forceOfSection(name: string): 'M' | 'S' | 'X' {
  const manifest = readCachedFile(join(FACTORY_LAYERED_DIR, '00-加载清单.md'))?.text ?? ''
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const bar = String.fromCharCode(96) // 反引号（模板串内不可直书）
  const re = new RegExp('(?:^|\\s)[|' + bar + ']?\\s*' + esc + '\\s*[|' + bar + '].*?\\|\\s*([MSX])\\s*[|' + bar + ']', 'm')
  const m = manifest.match(re)
  if (m && ['M', 'S', 'X'].includes(m[1])) return m[1] as 'M' | 'S' | 'X'
  if (/l2f|l2s|clarify|docking|compression|goal/.test(name)) return 'M'
  return 'S'
}

function readLayeredState(root: string): Record<string, boolean> {
  const f = readCachedFile(join(root, 'layered-state.json'))
  if (f === null) return {}
  try {
    const j = JSON.parse(f.text) as { enabled?: Record<string, boolean> }
    return j?.enabled && typeof j.enabled === 'object' ? j.enabled : {}
  } catch {
    return {}
  }
}

function writeLayeredState(root: string, st: Record<string, boolean>): void {
  writeFileSync(join(root, 'layered-state.json'), JSON.stringify({ version: 1, enabled: st }, null, 2) + '\n', 'utf8')
  forgetCachedFile(join(root, 'layered-state.json'))
  recordHashes(root, ['layered-state.json']) // 入 TRACKED 后：本插件写入须登记哈希，防 external-change 误报
}

function safeLayeredName(name: string): string | null {
  const n = String(name ?? '').trim()
  if (n.startsWith('.') || n.includes('..')) return null // 防路径穿越与隐藏文件
  if (!/^[^\u0000-\u001f\\/:*?"<>|]+\.md$/.test(n)) return null // 允许中文名；拦分隔符/控制字符/保留字符（含 NTFS ADS）
  return n
}

export function listLayered(root: string): { sections: LayeredSectionView[] } {
  const st = readLayeredState(root)
  const factory = factoryLayeredNames()
  let customNames: string[] = []
  try {
    const ldir = join(root, 'layered')
    if (existsSync(ldir)) {
      customNames = readdirSync(ldir).filter((f) => f.endsWith('.md') && !factory.includes(f) && safeLayeredName(f) !== null)
    }
  } catch { /* 自建分节目录读不到=无 */ }
  const sections = [...factory, ...customNames].map((name) => {
    const isFactory = factory.includes(name)
    const userPath = join(root, 'layered', name)
    let text = isFactory ? readFileSync(join(FACTORY_LAYERED_DIR, name), 'utf8') : ''
    let modified = false
    try {
      if (existsSync(userPath)) {
        text = readFileSync(userPath, 'utf8')
        modified = true
      } else if (!isFactory) {
        return null // 自建分节的实体文件已被删除——不再列出
      }
    } catch { /* 读不到用户副本=出厂 */ }
    return { name, force: isFactory ? forceOfSection(name) : 'X', enabled: st[name] !== false, modified, chars: text.length, text }
  }).filter((s): s is LayeredSectionView => s !== null)
  return { sections }
}

export function readLayeredSection(root: string, name: string): LayeredSectionView | null {
  const n = safeLayeredName(name)
  if (n === null) return null
  const hit = listLayered(root).sections.find((s) => s.name === n)
  return hit ?? null
}

/** 删除自建分节（P47）：出厂分节不可删（停用即可）；仅物理删除用户镜像文件。 */
export function deleteLayeredSection(root: string, name: string): { ok: boolean; error?: string } {
  const n = safeLayeredName(name)
  if (n === null) return { ok: false, error: '分节名不合法' }
  if (factoryLayeredNames().includes(n)) return { ok: false, error: '出厂分节不可删除（可停用或恢复出厂）' }
  const p = join(root, 'layered', n)
  if (!existsSync(p)) return { ok: false, error: '分节不存在' }
  snapshot(root, 'delete-layered')
  rmSync(p)
  forgetCachedFile(p)
  audit(root, { kind: 'layered-deleted', section: n })
  return { ok: true }
}

export function saveLayeredSection(root: string, name: string, text: string): LayeredSectionView | null {
  const n = safeLayeredName(name)
  if (n === null) throw new Error(`分节名不合法（不可含路径分隔符/非法字符）：${String(name)}`)
  snapshot(root, 'save-layered')
  mkdirSync(join(root, 'layered'), { recursive: true })
  writeFileSync(join(root, 'layered', n), text, 'utf8')
  forgetCachedFile(join(root, 'layered', n))
  audit(root, { kind: 'layered-saved', section: n, bytes: Buffer.byteLength(text, 'utf8') })
  return readLayeredSection(root, n)
}

export function resetLayeredSection(root: string, name: string): LayeredSectionView | null {
  const n = safeLayeredName(name)
  if (n === null) return null
  const p = join(root, 'layered', n)
  if (existsSync(p)) {
    snapshot(root, 'reset-layered')
    rmSync(p, { force: true })
    forgetCachedFile(p)
  }
  audit(root, { kind: 'layered-reset', section: n })
  return readLayeredSection(root, n)
}

export function toggleLayeredSection(root: string, name: string, enabled: boolean): LayeredSectionView | null {
  const n = safeLayeredName(name)
  if (n === null) return null
  const st = readLayeredState(root)
  if (enabled) delete st[n]
  else st[n] = false
  writeLayeredState(root, st)
  audit(root, { kind: 'layered-toggle', section: n, enabled })
  return readLayeredSection(root, n)
}

// ── 作用域覆盖（P1b；#决策 2026-10-17 17:2x）：全局默认＋单工作区可覆盖 ──
// 匹配口径复用近邻成熟裁定：完全一致/前缀/包含/正则；越具体越优先；空正文=在该位置关闭。

export const SCOPE_MODES = ['exact', 'prefix', 'contains', 'regex'] as const
export type ScopeMode = (typeof SCOPE_MODES)[number]
export interface ScopeRule {
  path: string
  mode: ScopeMode
  text: string
}
export interface ScopeState {
  version: number
  rules: ScopeRule[]
}

function ruleValid(r: unknown): r is ScopeRule {
  const rule = r as Partial<ScopeRule> | null
  return (
    rule !== null &&
    typeof rule === 'object' &&
    typeof rule.path === 'string' &&
    rule.path.length > 0 &&
    typeof rule.mode === 'string' &&
    (SCOPE_MODES as readonly string[]).includes(rule.mode) &&
    typeof rule.text === 'string'
  )
}

export function readScope(root: string): ScopeState {
  const f = readCachedFile(join(root, 'scope.json'))
  if (f === null) return { version: 1, rules: [] }
  try {
    const j = JSON.parse(f.text) as { rules?: unknown }
    const raw = Array.isArray(j?.rules) ? j.rules : []
    const rules = raw.filter((r) => {
      const ok = ruleValid(r)
      if (!ok) console.warn('[dsh-custom] scope.json 含无效规则，已跳过：', JSON.stringify(r).slice(0, 120))
      return ok
    })
    return { version: 1, rules }
  } catch (e) {
    console.warn('[dsh-custom] scope.json 损坏，按空规则处理：', String((e as { message?: unknown })?.message ?? e))
    return { version: 1, rules: [] }
  }
}

export function saveScope(root: string, rules: unknown): ScopeState {
  if (!Array.isArray(rules)) throw new Error('rules 必须是数组')
  const normalized = rules.map((r, i) => {
    if (!ruleValid(r)) throw new Error(`第 ${String(i + 1)} 条规则不合法（path 非空串；mode ∈ exact/prefix/contains/regex；text 为字符串）`)
    if (r.mode === 'regex') {
      try {
        new RegExp(r.path)
      } catch {
        throw new Error(`第 ${String(i + 1)} 条规则 regex 非法：${r.path}`)
      }
    }
    return { path: r.path, mode: r.mode, text: r.text }
  })
  snapshot(root, 'save-scope')
  writeFileSync(join(root, 'scope.json'), JSON.stringify({ version: 1, rules: normalized }, null, 2) + '\n', 'utf8')
  forgetCachedFile(join(root, 'scope.json'))
  recordHashes(root, ['scope.json'])
  audit(root, { kind: 'scope-saved', rules: normalized.length })
  return { version: 1, rules: normalized }
}

const SCOPE_RANK: Record<ScopeMode, number> = { exact: 0, prefix: 1, contains: 2, regex: 3 }

/** 取最具体命中规则（exact > prefix > contains > regex；同级取更长者；再同级取先列者）。 */
export function pickScopeRule(rules: ScopeRule[], cwd: string | null | undefined): ScopeRule | null {
  if (rules.length === 0 || typeof cwd !== 'string' || cwd.length === 0) return null
  const c = squash(cwd)
  let best: { rule: ScopeRule; rank: number; len: number } | null = null
  for (const rule of rules) {
    if (!ruleValid(rule)) continue
    let hit = false
    let len = 0
    if (rule.mode === 'exact') {
      hit = c === squash(rule.path)
      len = rule.path.length
    } else if (rule.mode === 'prefix') {
      hit = c.startsWith(squash(rule.path))
      len = rule.path.length
    } else if (rule.mode === 'contains') {
      hit = c.includes(squash(rule.path))
      len = rule.path.length
    } else {
      try {
        hit = new RegExp(rule.path, 'i').test(cwd)
        len = rule.path.length
      } catch (e) {
        console.warn('[dsh-custom] 作用域 regex 无效，已跳过：', rule.path, String((e as { message?: unknown })?.message ?? e))
        continue
      }
    }
    if (!hit) continue
    const rank = SCOPE_RANK[rule.mode]
    if (best === null || rank < best.rank || (rank === best.rank && len > best.len)) best = { rule, rank, len }
  }
  return best === null ? null : best.rule
}

/**
 * 纪律注入文本解析（#决策 2026-10-17 P1b）：总开关关 → ''；命中工作区规则 → 规则文本（可空=该位置关）；
 * 无命中 → 全局默认（discipline.md）。cwd 缺省（全局引用）时不走规则。每次组装求值（热生效）。
 */
export function disciplineTextFor(root: string, cwd?: string | null): string {
  detectExternalChanges(root) // 组装前哈希对照（设计 §4）
  if (!readInjectSettings(root).enabled) return ''
  const rule = pickScopeRule(readScope(root).rules, cwd ?? null)
  if (rule !== null) return rule.text
  return readCachedFile(join(root, 'discipline.md'))?.text ?? ''
}

export function saveSettings(root: string, patch: { injectEnabled?: unknown; overrideEnabled?: unknown }): InjectSettings {
  const cur = readInjectSettings(root)
  const next = {
    enabled: typeof patch.injectEnabled === 'boolean' ? patch.injectEnabled : cur.enabled,
    overrideEnabled: typeof patch.overrideEnabled === 'boolean' ? patch.overrideEnabled : cur.overrideEnabled,
  }
  // #决策 2026-10-18（P46 回归修复）：旧形态整写三键会丢 userPromptEnabled → merge 写保留未知键
  let raw: Record<string, unknown> = {}
  try { raw = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as Record<string, unknown> } catch { /* 损坏=种子重建 */ }
  writeFileSync(join(root, 'settings.json'), JSON.stringify({ ...raw, version: 1, injectEnabled: next.enabled, overrideEnabled: next.overrideEnabled }, null, 2) + '\n', 'utf8')
  forgetCachedFile(join(root, 'settings.json'))
  recordHashes(root, ['settings.json'])
  audit(root, { kind: 'settings-saved', injectEnabled: next.enabled, overrideEnabled: next.overrideEnabled })
  return next
}

// ── 治理开关（P46；#决策 2026-10-18）──────────────────────────────
// 本插件=写面：$DSH_HOME/dsh-custom/governance.json → 运行时插件 mtime 热读（layered-state 同款跨包管道）。
// noExempt 域（编码/解码执行）不开放关闭与白名单——422 拒绝为第一道，引擎侧 effectiveRulesFor 强制保留为第二道。
// 白名单条目=归一化字面子串＋词边界（与运行时拒绝指纹同语义），最短 4 字符。
export const GOVERNANCE_VERSION = 1
const GOV_ALLOW_MIN_LEN = 4
// 域目录（C6，2026-10-19：单一真源管道）——运行时引擎启动时把「有效域目录」写到同目录 l3-catalog.json；
// 本页优先读它（source='engine'），缺失/坏档才回退下方镜像副本（source='mirror'，可能滞后于规则变更）。
const L3_DOMAIN_CATALOG: Array<{ domain: string; noExempt: boolean }> = [
  { domain: '编码执行', noExempt: true },
  { domain: '解码执行', noExempt: true },
  { domain: '数据删除', noExempt: false },
  { domain: '远端执行', noExempt: false },
  { domain: '敏感路径写', noExempt: false },
  { domain: '远端写/发布', noExempt: false },
  { domain: '生产配置写', noExempt: false },
  { domain: '权限变更', noExempt: false },
  { domain: '系统迁移/覆盖', noExempt: false },
  { domain: '破坏性远端操作', noExempt: false },
]
export function readL3Catalog(root: string): { domains: Array<{ domain: string; noExempt: boolean }>; source: 'engine' | 'mirror' } {
  try {
    const f = readCachedFile(join(root, 'l3-catalog.json'))
    if (f !== null) {
      const j = JSON.parse(f.text) as { version?: unknown; domains?: unknown }
      if (j !== null && typeof j === 'object' && j.version === 1 && Array.isArray(j.domains)) {
        const domains = (j.domains as Array<Record<string, unknown>>)
          .filter((d) => d !== null && typeof d === 'object' && typeof d.domain === 'string' && (d.domain as string).length > 0)
          .map((d) => ({ domain: d.domain as string, noExempt: d.noExempt === true }))
        if (domains.length > 0) return { domains, source: 'engine' }
      }
    }
  } catch { /* 坏档=回退镜像（fail-safe，不阻断页面） */ }
  return { domains: L3_DOMAIN_CATALOG, source: 'mirror' }
}

export interface GovernanceView {
  version: number
  l3Enabled: boolean
  domainsOff: string[]
  allowlist: Array<{ pattern: string; note: string }>
  levelChecklist: boolean
  compactionSignal: boolean
  concludeOnPass: boolean
  domains: Array<{ domain: string; noExempt: boolean; off: boolean }>
  catalogSource: 'engine' | 'mirror'
}

function readGovernanceRaw(root: string): Record<string, unknown> {
  try {
    const f = readCachedFile(join(root, 'governance.json'))
    return f ? (JSON.parse(f.text) as Record<string, unknown>) : { version: GOVERNANCE_VERSION }
  } catch {
    return { version: GOVERNANCE_VERSION }
  }
}
function writeGovernanceRaw(root: string, raw: Record<string, unknown>): void {
  writeFileSync(join(root, 'governance.json'), JSON.stringify({ version: GOVERNANCE_VERSION, ...raw }, null, 2) + '\n', 'utf8')
  forgetCachedFile(join(root, 'governance.json'))
}

export function readGovernance(root: string): GovernanceView {
  const raw = readGovernanceRaw(root)
  const l3 = (raw.l3 ?? {}) as { enabled?: unknown; domainsOff?: unknown; allowlist?: unknown }
  const catalog = readL3Catalog(root)
  const noExemptSet = new Set(catalog.domains.filter((d) => d.noExempt).map((d) => d.domain))
  const domainsOff = Array.isArray(l3.domainsOff)
    ? (l3.domainsOff as unknown[]).filter((d): d is string => typeof d === 'string' && !noExemptSet.has(d))
    : []
  const allowlist = Array.isArray(l3.allowlist)
    ? (l3.allowlist as Array<Record<string, unknown>>)
        .filter((e) => e && typeof e.pattern === 'string')
        .map((e) => ({ pattern: e.pattern as string, note: typeof e.note === 'string' ? (e.note as string).slice(0, 200) : '' }))
    : []
  return {
    version: GOVERNANCE_VERSION,
    l3Enabled: l3.enabled !== false,
    domainsOff,
    allowlist,
    levelChecklist: raw.levelChecklist !== false,
    compactionSignal: raw.compactionSignal !== false,
    concludeOnPass: raw.concludeOnPass === true,
    domains: catalog.domains.map((d) => ({ ...d, off: domainsOff.includes(d.domain) })),
    catalogSource: catalog.source,
  }
}

export type GovernanceSaveResult = { ok: true; view: GovernanceView } | { ok: false; status: 422; error: string }

function governanceNormalized(pattern: string): string {
  return pattern.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function saveGovernance(root: string, patch: Record<string, unknown>): GovernanceSaveResult {
  const catalog = readL3Catalog(root)
  const noExemptSet = new Set(catalog.domains.filter((d) => d.noExempt).map((d) => d.domain))
  const knownDomains = new Set(catalog.domains.map((d) => d.domain))
  const cur = readGovernanceRaw(root)
  const l3 = { ...((cur.l3 ?? {}) as Record<string, unknown>) }
  if (patch.l3 !== undefined) {
    if (!patch.l3 || typeof patch.l3 !== 'object' || Array.isArray(patch.l3)) return { ok: false, status: 422, error: 'l3 必须为对象' }
    const p = patch.l3 as Record<string, unknown>
    if (p.enabled !== undefined) {
      if (typeof p.enabled !== 'boolean') return { ok: false, status: 422, error: 'l3.enabled 必须为 boolean' }
      l3.enabled = p.enabled
    }
    if (p.domainsOff !== undefined) {
      if (!Array.isArray(p.domainsOff) || !p.domainsOff.every((d) => typeof d === 'string')) return { ok: false, status: 422, error: 'l3.domainsOff 必须为 string[]' }
      for (const d of p.domainsOff as string[]) {
        if (!knownDomains.has(d)) return { ok: false, status: 422, error: `未知域「${d}」` }
        if (noExemptSet.has(d)) return { ok: false, status: 422, error: `域「${d}」不可豁免（编码/解码执行不开放关闭与白名单）` }
      }
      l3.domainsOff = p.domainsOff
    }
    if (p.allowlist !== undefined) return { ok: false, status: 422, error: '白名单请走 /governance/allowlist 接口（POST/DELETE）' }
  }
  for (const key of ['levelChecklist', 'compactionSignal', 'concludeOnPass'] as const) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'boolean') return { ok: false, status: 422, error: `${key} 必须为 boolean` }
      cur[key] = patch[key]
    }
  }
  if (Object.keys(l3).length > 0) cur.l3 = l3
  writeGovernanceRaw(root, cur)
  const view = readGovernance(root)
  audit(root, { kind: 'governance-changed', patch: JSON.stringify(patch).slice(0, 300), l3Enabled: view.l3Enabled, domainsOff: view.domainsOff.length, allowlist: view.allowlist.length })
  return { ok: true, view }
}

export function governanceAllowlistAdd(root: string, pattern: unknown, note: unknown): GovernanceSaveResult {
  if (typeof pattern !== 'string' || pattern.trim() === '') return { ok: false, status: 422, error: 'pattern 必须为非空字符串' }
  const norm = governanceNormalized(pattern)
  if (norm.length < GOV_ALLOW_MIN_LEN) return { ok: false, status: 422, error: `pattern 归一化后短于 ${GOV_ALLOW_MIN_LEN} 字符（防全域放行）` }
  const cur = readGovernanceRaw(root)
  const l3 = { ...((cur.l3 ?? {}) as Record<string, unknown>) }
  const list = Array.isArray(l3.allowlist) ? [...(l3.allowlist as Array<Record<string, unknown>>)] : []
  if (list.some((e) => governanceNormalized(String(e.pattern ?? '')) === norm)) return { ok: false, status: 422, error: '该条目已存在' }
  list.push({ pattern, note: typeof note === 'string' ? note.slice(0, 200) : '' })
  l3.allowlist = list
  cur.l3 = l3
  writeGovernanceRaw(root, cur)
  const view = readGovernance(root)
  audit(root, { kind: 'governance-allowlist', action: 'add', pattern: pattern.slice(0, 120) })
  return { ok: true, view }
}

export function governanceAllowlistRemove(root: string, pattern: unknown): GovernanceSaveResult {
  if (typeof pattern !== 'string' || pattern === '') return { ok: false, status: 422, error: 'pattern 必须为非空字符串' }
  const cur = readGovernanceRaw(root)
  const l3 = { ...((cur.l3 ?? {}) as Record<string, unknown>) }
  const list = Array.isArray(l3.allowlist) ? [...(l3.allowlist as Array<Record<string, unknown>>)] : []
  const next = list.filter((e) => e.pattern !== pattern)
  if (next.length === list.length) return { ok: false, status: 422, error: '条目不存在' }
  l3.allowlist = next
  cur.l3 = l3
  writeGovernanceRaw(root, cur)
  const view = readGovernance(root)
  audit(root, { kind: 'governance-allowlist', action: 'remove', pattern: pattern.slice(0, 120) })
  return { ok: true, view }
}

// ── 深改接管（P2；#决策 2026-10-17 18:0x）：complete 整段替换 ──────────

export const OVERRIDE_SECTION = 'dsh-custom:override'

export interface OverrideState {
  enabled: boolean
  text: string
  mtime: string | null
}

export function readOverride(root: string): OverrideState {
  const f = readCachedFile(join(root, 'override.md'))
  return {
    enabled: readInjectSettings(root).overrideEnabled,
    text: f?.text ?? '',
    mtime: f === null ? null : new Date(f.mtimeMs).toISOString(),
  }
}

/**
 * #决策 2026-10-17 18:0x 干跑校验：候选文本对「当前变量表」按宿主插入语义预渲染——未知/畸形变量阻止保存；
 * 已注册但离线无值的变量（如 {{model}}，请求期才解析）以占位值放行（设计 §2/§3 干跑口径）。
 * @returns null=通过；否则错误信息（可直接回显给用户）。
 */
export function validateOverrideText(
  text: string,
  variables: Record<string, unknown> | null | undefined,
  render?: ((assembly: unknown) => string) | null,
): string | null {
  const vars = variables ?? {}
  if (typeof render === 'function') {
    const filled: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(vars)) filled[k] = v === undefined ? `«${k}»` : v
    try {
      render({ sections: [{ name: OVERRIDE_SECTION, text }], contexts: [], tools: [], variables: filled })
      return null
    } catch (e) {
      return String((e as { message?: unknown })?.message ?? e)
    }
  }
  // 无 renderer 的兜底：按同语义做解析级检查（简单 {{name}} 组；未知名/畸形组阻止）
  const re = /\{\{([^{}]*)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const name = m[1] ?? ''
    if (!/^[a-z][a-z0-9_]*$/i.test(name)) return `畸形变量引用「{{${name}}}」（应为 {{name}} 形式）`
    if (!Object.hasOwn(vars, name)) {
      const known = Object.keys(vars)
      return `未知变量「{{${name}}}」；当前已注册变量：${known.length > 0 ? known.join('、') : '（无）'}`
    }
  }
  return null
}

export interface BackupEntry {
  name: string
  files: string[]
  hasOverride: boolean
}

export function listBackups(root: string): BackupEntry[] {
  const b = join(root, 'backups')
  if (!existsSync(b)) return []
  let names: string[] = []
  try {
    names = readdirSync(b).filter((n) => /^[0-9A-Za-z._-]+$/.test(n))
  } catch (e) {
    console.warn('[dsh-custom] 快照目录读取失败：', String((e as { message?: unknown })?.message ?? e))
    return []
  }
  return names
    .map((name) => {
      let files: string[] = []
      try {
        files = readdirSync(join(b, name), { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name)
      } catch (e) {
        console.warn(`[dsh-custom] 快照 ${name} 读取失败：`, String((e as { message?: unknown })?.message ?? e))
      }
      return { name, files, hasOverride: files.includes('override.md') }
    })
    .sort((x, y) => (x.name < y.name ? 1 : -1))
    .slice(0, 100)
}

/** 快照详情（P47 UX 批）：每个文件的字节/行数/前 120 字摘要＋settings 键值——让「回滚到哪个状态」可读。 */
export interface BackupFileDetail { file: string; bytes: number; lines: number; head: string }
export function backupDetail(root: string, name: string, sessionId: string | null = null): { name: string; files: BackupFileDetail[]; settings: Record<string, unknown> | null; scope: { count: number; paths: string[] } | null } | null {
  if (!BACKUP_STAMP_RE.test(name) && !/^[0-9A-Za-z._-]+$/.test(name)) return null
  let dir: string
  if (sessionId !== null && sessionId !== '') {
    try { dir = join(sessionDir(root, sessionId), 'backups', name) } catch { return null }
  } else {
    dir = join(root, 'backups', name)
  }
  if (!existsSync(dir)) return null
  const files: BackupFileDetail[] = []
  let settings: Record<string, unknown> | null = null
  let scope: { count: number; paths: string[] } | null = null
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (!f.isFile()) continue // 子目录（layered/）在下方单独展开
    const p = join(dir, f.name)
    let text = ''
    try { text = readFileSync(p, 'utf8') } catch { continue }
    files.push({ file: f.name, bytes: Buffer.byteLength(text, 'utf8'), lines: text.split('\n').filter((x) => x.trim() !== '').length, head: text.replace(/\s+/g, ' ').slice(0, 120) })
    if (f.name === 'settings.json') { try { settings = JSON.parse(text) as Record<string, unknown> } catch { /* 坏档不解析 */ } }
    if (f.name === 'scope.json') {
      try {
        const j = JSON.parse(text) as { rules?: Array<{ path?: unknown }> }
        const rules = Array.isArray(j.rules) ? j.rules : []
        scope = { count: rules.length, paths: rules.slice(0, 3).map((r) => String(r.path ?? '')) }
      } catch { /* 坏档不解析 */ }
    }
  }
  // layered/ 子目录（2026-10-19 备份完整性批）：逐文件列出（file 键=layered/<名>），让「回滚到哪」可读
  try {
    for (const f of readdirSync(join(dir, 'layered'), { withFileTypes: true })) {
      if (!f.isFile()) continue
      let text = ''
      try { text = readFileSync(join(dir, 'layered', f.name), 'utf8') } catch { continue }
      files.push({ file: 'layered/' + f.name, bytes: Buffer.byteLength(text, 'utf8'), lines: text.split('\n').filter((x) => x.trim() !== '').length, head: text.replace(/\s+/g, ' ').slice(0, 120) })
    }
  } catch { /* 旧格式快照无 layered/ —— 兼容 */ }
  return { name, files, settings, scope }
}

/** 恢复快照（限 backups 根内；恢复前先对当前状态拍快照，保证可逆）。 */
export function restoreBackup(root: string, name: string): { restored: string[]; preRestoreSnapshot: string } {
  const b = resolve(join(root, 'backups'))
  const abs = resolve(b, name)
  if (abs !== b && !abs.startsWith(b + sep)) throw new Error('非法快照路径（越出 backups 根）')
  if (!existsSync(abs) || abs === b) throw new Error('快照不存在')
  const files = readdirSync(abs).filter((f) => (TRACKED as string[]).includes(f))
  // layered/ 子目录（2026-10-19 备份完整性批）：复制快照内存在的分节文件回 layered/；
  // 与根文件同语义（复制快照里有、不删快照后新增——非破坏式，恢复前自动再快照可反悔）；
  // 旧格式快照无 layered/ 子目录 ⇒ 跳过（不动现层，兼容）。
  const layeredSrc = join(abs, 'layered')
  let layeredFiles: string[] = []
  try {
    layeredFiles = readdirSync(layeredSrc, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name)
  } catch { /* 旧格式/无 layered —— 兼容跳过 */ }
  if (files.length === 0 && layeredFiles.length === 0) throw new Error('快照内无可恢复文件')
  const pre = snapshot(root, 'pre-restore')
  const restored: string[] = []
  for (const f of files) {
    copyFileSync(join(abs, f), join(root, f))
    forgetCachedFile(join(root, f))
    restored.push(f)
  }
  if (layeredFiles.length > 0) {
    mkdirSync(join(root, 'layered'), { recursive: true })
    for (const f of layeredFiles) {
      copyFileSync(join(layeredSrc, f), join(root, 'layered', f))
      forgetCachedFile(join(root, 'layered', f))
      restored.push('layered/' + f)
    }
  }
  recordHashes(root, files)
  audit(root, { kind: 'backup-restored', name, files: restored })
  return { restored, preRestoreSnapshot: pre }
}

// ── 快照时间线（P1-4，#决策 9/#19）：全局＋各会话快照合并列出；会话快照可详情/恢复/导出 ──
export interface SnapshotEntry {
  name: string
  files: string[]
  hasOverride: boolean
  scope: 'global' | 'session'
  sessionId: string | null
}

/** 合并列出全局与全部会话快照；按时间戳倒序（同刻全局在前，稳定）。 */
export function listAllSnapshots(root: string): SnapshotEntry[] {
  const out: SnapshotEntry[] = listBackups(root).map((e) => ({ ...e, scope: 'global' as const, sessionId: null }))
  try {
    const sroot = join(root, 'sessions')
    for (const sid of readdirSync(sroot)) {
      const bdir = join(sroot, sid, 'backups')
      if (!existsSync(bdir)) continue
      let names: string[] = []
      try { names = readdirSync(bdir).filter((n) => BACKUP_STAMP_RE.test(n)) } catch { continue }
      for (const name of names) {
        let files: string[] = []
        try { files = readdirSync(join(bdir, name)) } catch { continue }
        out.push({ name, files, hasOverride: files.includes('system.md'), scope: 'session', sessionId: sid })
      }
    }
  } catch { /* sessions/ 不存在＝没有会话级覆盖（常态），不算错误 */ }
  return out.sort((x, y) => (x.name < y.name ? 1 : -1)).slice(0, 300)
}

/**
 * 恢复会话快照（会话内时间线回滚）：快照=当时完整段集，恢复即「复制存在的段＋删除快照后新增的段」；
 * 恢复前自动再快照当前状态（与全局 restoreBackup 同口径，可反悔）。
 */
export function restoreSessionBackup(root: string, id: string, name: string): { restored: string[]; preRestoreSnapshot: string | null } {
  if (!BACKUP_STAMP_RE.test(name)) throw new Error('会话快照名称非法')
  const dir = sessionDir(root, id)
  const src = join(dir, 'backups', name)
  if (!existsSync(src)) throw new Error('会话快照不存在')
  const pre = snapshotSession(root, id)
  const restored: string[] = []
  for (const seg of SESSION_SEGMENTS) {
    const p = join(dir, seg + '.md')
    const s = join(src, seg + '.md')
    if (existsSync(s)) {
      copyFileSync(s, p)
      forgetCachedFile(p)
      restored.push(seg)
    } else {
      try { unlinkSync(p) } catch { /* 本就无该段文件 */ }
      forgetCachedFile(p)
    }
  }
  audit(root, { kind: 'session-backup-restored', session: id, name, restored, preRestoreSnapshot: pre })
  return { restored, preRestoreSnapshot: pre }
}

/** 快照导出（保留策略的兜底：清理前可先导出 JSON 留档）；总量上限 2MB，超出拒绝（提示用详情页看）。 */
export function snapshotExport(root: string, name: string, sessionId: string | null = null): { name: string; scope: 'global' | 'session'; sessionId: string | null; files: Record<string, string> } | null {
  if (!BACKUP_STAMP_RE.test(name)) return null
  let dir: string
  if (sessionId !== null && sessionId !== '') {
    try { dir = join(sessionDir(root, sessionId), 'backups', name) } catch { return null }
  } else {
    dir = join(root, 'backups', name)
  }
  if (!existsSync(dir)) return null
  const files: Record<string, string> = {}
  let total = 0
  for (const f of readdirSync(dir)) {
    if (!/^[0-9A-Za-z._-]+\.(md|json)$/.test(f)) continue
    let text = ''
    try { text = readFileSync(join(dir, f), 'utf8') } catch { continue }
    total += Buffer.byteLength(text, 'utf8')
    if (total > 2 * 1024 * 1024) return null
    files[f] = text
  }
  // layered/ 子目录（2026-10-19 备份完整性批）：分节文件以 layered/<名> 键导出（名可含中文，不做 ASCII 白名单）
  try {
    for (const f of readdirSync(join(dir, 'layered'), { withFileTypes: true })) {
      if (!f.isFile() || !/\.(md|json)$/.test(f.name)) continue
      let text = ''
      try { text = readFileSync(join(dir, 'layered', f.name), 'utf8') } catch { continue }
      total += Buffer.byteLength(text, 'utf8')
      if (total > 2 * 1024 * 1024) return null
      files['layered/' + f.name] = text
    }
  } catch { /* 旧格式快照无 layered/ —— 兼容 */ }
  return { name, scope: sessionId !== null && sessionId !== '' ? 'session' : 'global', sessionId, files }
}

// ── 会话对话（P1-3，#决策 13：只读；隐藏非对话条目并计数） ──
export interface ConversationMessage { role: 'user' | 'assistant'; text: string; time: number | null; truncated?: boolean }
export interface ConversationView { messages: ConversationMessage[]; hidden: number; omitted: number }
const CONV_TEXT_CAP = 4000
const CONV_MAX_MESSAGES = 300

function conversationTextOf(message: unknown): string {
  const blocks = (message as { content?: unknown })?.content
  if (!Array.isArray(blocks)) return ''
  const parts: string[] = []
  for (const b of blocks) {
    const block = b as { type?: unknown; text?: unknown }
    if (block?.type === 'text' && typeof block.text === 'string' && block.text.length > 0) parts.push(block.text)
  }
  return parts.join('\n')
}

/**
 * 纯折叠：会话事件 → 可读对话（user=source.kind 为 user 的真人消息；assistant=文本块）。
 * 隐藏计数＝非对话条目（纪律/状态行/审批应答/系统提示词快照等注入件）；`omitted`＝超上限被省略的旧消息数。
 */
export function conversationViewOf(events: unknown[]): ConversationView {
  const messages: ConversationMessage[] = []
  let hidden = 0
  for (const ev of events) {
    if (ev === null || typeof ev !== 'object') continue
    const type = (ev as { type?: unknown }).type
    const data = ((ev as { data?: unknown }).data ?? {}) as Record<string, unknown>
    const time = typeof (ev as { time?: unknown }).time === 'number' ? ((ev as { time?: number }).time ?? null) : null
    if (type === 'user/message') {
      const src = (data.source ?? {}) as { kind?: unknown }
      if (src.kind === 'user') {
        const raw = conversationTextOf(data)
        if (raw.length > 0) messages.push(finishConversationMessage('user', raw, time))
      } else {
        hidden += 1
      }
    } else if (type === 'assistant/message') {
      const raw = conversationTextOf(data.message)
      if (raw.length > 0) messages.push(finishConversationMessage('assistant', raw, time))
    } else if (type === 'system/message') {
      hidden += 1
    }
  }
  const omitted = Math.max(0, messages.length - CONV_MAX_MESSAGES)
  return { messages: omitted > 0 ? messages.slice(omitted) : messages, hidden, omitted }
}

function finishConversationMessage(role: 'user' | 'assistant', raw: string, time: number | null): ConversationMessage {
  if (raw.length > CONV_TEXT_CAP) return { role, text: raw.slice(0, CONV_TEXT_CAP), time, truncated: true }
  return { role, text: raw, time }
}

// ── 乐观锁（P1-6，#决策 22）：写请求可带 expectedMtime；与当前不符→409，由用户决定刷新或覆盖 ──
export class MtimeConflictError extends Error {
  current: Record<string, string | null>
  constructor(current: Record<string, string | null>, label: string) {
    super(`${label} 已在别处被修改（当前版本与你的编辑基线不一致）`)
    this.name = 'MtimeConflictError'
    this.current = current
  }
}

/**
 * 文件 mtime（ISO）；不存在/不可读=null。
 * 注意：必须与 readCachedFile/read* 的口径一致（new Date(mtimeMs)），不能直接用 stat.mtime——
 * NTFS 亚毫秒时间下 stat.mtime(四舍五入) 与 new Date(mtimeMs)(截断) 会差 1ms，基线将永远对不上。
 */
export function mtimeOfFileOrNull(filePath: string): string | null {
  try { return new Date(statSync(filePath).mtimeMs).toISOString() } catch { return null }
}

/** expected=undefined＝不检查（旧客户端兼容）；null＝期望文件不存在；字符串＝期望精确 mtime。 */
export function mtimeMatches(filePath: string, expected: string | null): boolean {
  return mtimeOfFileOrNull(filePath) === expected
}

// ── 会话级覆盖（页面重构）：每会话一目录，分段文件（discipline/user/layered/system），
// 保存前自动快照到 sessions/<id>/backups/<ts>/；回滚两档（official=清空覆盖 / previous=恢复上一版）。
// 优先级由注入层保证：会话级 > 全局；全局改不触碰 sessions/。
const SESSION_SEGMENTS = ['discipline', 'user', 'layered', 'system'] as const
export type SessionSegment = (typeof SESSION_SEGMENTS)[number]

export function sessionDir(root: string, id: string): string {
  const raw = String(id ?? '')
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '')
  if (!safe) throw new Error('非法会话 id')
  // P1-7：非规范 id（含会被净化的字符）目录名加「原始 id 短哈希」后缀，防 `a/b` 与 `ab` 归一撞车。
  // 规范 id（session-<uuid> 等纯 [A-Za-z0-9_-]）目录名不变 ⇒ 存量数据零迁移（本机实测无存量非规范目录）。
  if (safe !== raw) {
    const h = createHash('sha256').update(raw).digest('hex').slice(0, 8)
    return join(root, 'sessions', `${safe}-x${h}`)
  }
  return join(root, 'sessions', safe)
}

export function readSessionOverride(root: string, id: string): Record<string, string | null> {
  const dir = sessionDir(root, id)
  const out: Record<string, string | null> = {}
  for (const seg of SESSION_SEGMENTS) {
    try { out[seg] = readFileSync(join(dir, seg + '.md'), 'utf8') } catch { out[seg] = null }
  }
  return out
}

function snapshotSession(root: string, id: string): string | null {
  const dir = sessionDir(root, id)
  if (!existsSync(dir)) return null
  const files = SESSION_SEGMENTS.filter((seg) => existsSync(join(dir, seg + '.md')))
  if (files.length === 0) return null
  const base = new Date().toISOString().replace(/[:.]/g, '-')
  const stamp = uniqueBackupName(base, (n) => existsSync(join(dir, 'backups', n)))
  const dest = join(dir, 'backups', stamp)
  mkdirSync(dest, { recursive: true })
  for (const seg of files) {
    try { copyFileSync(join(dir, seg + '.md'), join(dest, seg + '.md')) } catch { /* 单段失败不阻塞 */ }
  }
  const pruned = pruneBackupDir(join(dir, 'backups'), BACKUP_KEEP)
  if (pruned.length > 0) audit(root, { kind: 'snapshot-pruned', session: id, removed: pruned, keep: BACKUP_KEEP })
  return stamp
}

export function writeSessionOverride(
  root: string,
  id: string,
  segments: Record<string, string | null>,
): { written: string[]; snapshot: string | null } {
  const dir = sessionDir(root, id)
  // P1-10 幂等：逐段对比，内容相同的段不重写（不碰 mtime）；全部未变则连快照也不建
  const changed: Array<{ seg: SessionSegment; v: string | null }> = []
  for (const seg of SESSION_SEGMENTS) {
    if (!(seg in segments)) continue
    const v = segments[seg]
    let cur: string | null = null
    try { cur = readFileSync(join(dir, seg + '.md'), 'utf8') } catch { cur = null }
    const next = v === null || v === '' ? null : v
    if (cur === next) continue
    changed.push({ seg, v })
  }
  if (changed.length === 0) {
    audit(root, { kind: 'save-noop', target: 'session', session: id })
    return { written: [], snapshot: null }
  }
  const snap = snapshotSession(root, id)
  mkdirSync(dir, { recursive: true })
  const written: string[] = []
  for (const { seg, v } of changed) {
    const p = join(dir, seg + '.md')
    if (v === null || v === '') {
      try { unlinkSync(p) } catch { /* 已不存在 */ }
      forgetCachedFile(p)
    } else {
      writeFileSync(p, v, 'utf8')
      forgetCachedFile(p)
    }
    written.push(seg)
  }
  audit(root, { kind: 'session-override-saved', session: id, segments: written })
  return { written, snapshot: snap }
}

export function rollbackSession(
  root: string,
  id: string,
  target: 'official' | 'previous',
): { cleared: string[]; restored: string[] } {
  const dir = sessionDir(root, id)
  const snap = snapshotSession(root, id)
  if (target === 'official') {
    const cleared: string[] = []
    for (const seg of SESSION_SEGMENTS) {
      const p = join(dir, seg + '.md')
      try {
        unlinkSync(p)
        forgetCachedFile(p)
        cleared.push(seg)
      } catch { /* 不存在 */ }
    }
    audit(root, { kind: 'session-rollback', session: id, target, snapshot: snap })
    return { cleared, restored: [] }
  }
  const b = join(dir, 'backups')
  if (!existsSync(b)) throw new Error('该会话暂无历史版本')
  const names = readdirSync(b).filter((n) => /^[0-9A-Za-z._-]+$/.test(n)).sort((x, y) => (x < y ? 1 : -1))
  const latest = names.find((n) => n !== snap)
  if (latest === undefined) throw new Error('该会话暂无上一版')
  const restored: string[] = []
  for (const seg of SESSION_SEGMENTS) {
    const src = join(b, latest, seg + '.md')
    if (!existsSync(src)) continue
    const dst = join(dir, seg + '.md')
    copyFileSync(src, dst)
    forgetCachedFile(dst)
    restored.push(seg)
  }
  // #决策 2026-10-19 D2：快照里没有、但当前目录还留着的段＝「快照之后新增的段」，必须一并摘掉，
  // 否则回滚不彻底（如 v1={discipline}、v2={discipline,system} 时 system.md 会残留并继续注入）。
  const cleared: string[] = []
  for (const seg of SESSION_SEGMENTS) {
    if (restored.includes(seg)) continue
    const p = join(dir, seg + '.md')
    if (!existsSync(p)) continue
    try {
      unlinkSync(p)
      forgetCachedFile(p)
      cleared.push(seg)
    } catch (e) {
      console.warn('[dsh-custom] 回滚清理多余段失败：', seg, String((e as { message?: unknown })?.message ?? e))
    }
  }
  audit(root, { kind: 'session-rollback', session: id, target: 'previous', version: latest, cleared })
  return { cleared, restored }
}

/** 注册深改接管段（complete 独占：整段替换系统提示词段列表；工具/上下文照常）。 */
export function registerOverride(svc: { section: (section: unknown) => () => void }, root: string): () => void {
  return svc.section({
    name: OVERRIDE_SECTION,
    order: 0,
    complete: true,
    text: () => readOverride(root).text,
  })
}

export function agentsCoexistence(home: string = resolveHome()): { exists: boolean; bytes: number | null; mtime: string | null } {
  const p = join(home, 'AGENTS.md')
  try {
    const st = statSync(p)
    return { exists: true, bytes: st.size, mtime: st.mtime.toISOString() }
  } catch (e) {
    const code = (e as { code?: unknown })?.code
    if (code !== 'ENOENT') console.warn(`[dsh-custom] AGENTS.md 状态读取失败（${String(code ?? e)}）`)
    return { exists: false, bytes: null, mtime: null }
  }
}

/**
 * 注册纪律前置段（system 层，order −2000 ⇒ 先于全官方面）。text 为函数：宿主每次组装时求值
 * （=热生效，改完无需推送；关/空 → 空文本，渲染期自动剔除 ⇒ 模型只见纯宿主提示词）。
 * 本函数注册「全局默认」层；工作区覆盖由 apply 中按 agent 作用域注册的同名段遮蔽（P1b）。
 */
export function registerDiscipline(svc: { section: (section: unknown) => () => void }, root: string): () => void {
  return svc.section({
    name: DISCIPLINE_SECTION,
    order: DISCIPLINE_ORDER,
    interpolate: false,
    text: () => disciplineTextFor(root, null),
  })
}

// ── 会话级注入接线（P0 缺口修复）：会话覆盖不再「只存不读」，四段全部进入装配 ──
// 优先级：总开关 > 会话级 > 全局。discipline/user/layered 的 text 是函数（宿主每次组装实时求值 ⇒
// 会话文件改完即生效，无需重同步）；只有 system 是 complete 段，「挂不挂」取决于注册那一刻的文本
// 是否非空 ⇒ 保存/回滚后必须写后重同步（见 apply 的 syncSessionSystem）。

export const SESSION_LAYERED_SECTION = 'dsh-custom:layered'
export const SESSION_LAYERED_ORDER = -1980

/**
 * 读会话级某段原文：trim 后非空 → 原文（保留用户排版）；空/缺失/非法 id → null（=该段无会话级覆盖）。
 * 非法或空 id 时 sessionDir 会抛错，此处必须吞掉：注入期抛错会连累整条系统提示词装配。
 */
function sessionSegmentText(root: string, id: string, seg: SessionSegment): string | null {
  // 空 id 是常态（全局引用/宿主未给 id）：走快路径直接判「无会话级覆盖」，不靠异常兜底
  if (String(id ?? '').length === 0) return null
  let dir = ''
  try {
    dir = sessionDir(root, id)
  } catch {
    /* 非法会话 id（sessionDir 归一后为空）＝无会话级覆盖，不得抛给调用方 */
    return null
  }
  const text = readCachedFile(join(dir, seg + '.md'))?.text ?? ''
  return text.trim().length > 0 ? text : null
}

/**
 * 会话级纪律文本（装配期求值）：
 * ①总开关关 → ''（总开关是最高优先级，会话级不得绕过——否则「关」形同虚设）；
 * ②会话 discipline 非空 → 会话文本；
 * ③否则回退全局口径（工作区规则 > 全局 discipline.md，语义见 disciplineTextFor）。
 */
export function sessionDisciplineTextFor(root: string, agentId: string, cwd?: string | null): string {
  if (!readInjectSettings(root).enabled) return ''
  const own = sessionSegmentText(root, agentId, 'discipline')
  if (own !== null) return own
  return disciplineTextFor(root, cwd ?? null)
}

/**
 * 会话级「我的提示词」：会话 user 非空 → 会话文本；否则回退全局 user-prompt.md。
 * #决策 2026-10-18（D4 已定）：`userPromptEnabled` 是**功能级开关，只关全局**，不否决会话级——
 * 本会话写了 user 段就注入，要停用请把该段清空（留空=关闭该段）。口径与「总开关只管 discipline」一致。
 */
export function sessionUserPromptTextFor(root: string, agentId: string): string {
  const own = sessionSegmentText(root, agentId, 'user')
  return own !== null ? own : userPromptTextFor(root)
}

/**
 * 会话级渐进加载层：会话 layered 非空 → 文本；否则 ''。
 * 注意**不回退全局**：全局 layered 是「按需读取的路由表」，本来就不进装配，回退等于假注入。
 */
export function sessionLayeredTextFor(root: string, agentId: string): string {
  return sessionSegmentText(root, agentId, 'layered') ?? ''
}

/**
 * 会话级 system 覆盖文本：会话 system 非空 → 文本；否则 ''。
 * 该段以 complete 注册（整段替换系统提示词段列表），**空文本绝不可注册**（会把整条提示词清空）。
 */
export function sessionSystemTextFor(root: string, agentId: string): string {
  return sessionSegmentText(root, agentId, 'system') ?? ''
}

/**
 * 在已注入的 systemPrompt 作用域上挂会话级 complete 段（仅当文本非空；空文本保持不挂）。
 *
 * #决策 2026-10-19 D1（不变量）：该段 text() **永不返回空串**。complete 段拿到空文本＝整条系统提示词被清空，
 * 而「挂不挂」在注册期就定死了；会话文件可能在注册后被外部删除/清空，故组装期必须自兜底：
 * ①会话 system 非空 → 更新 lastNonEmpty 并返回；
 * ②为空且全局深改开着且非空 → 返回全局接管文本（会话级失效即回落全局，符合「会话级 > 全局」）；
 * ③再否则返回 lastNonEmpty（注册时捕获的最近一次非空文本）。
 * 首次发生回落时留痕一次（闭包布尔量，不每次组装都写审计）。
 *
 * @param onSection 可选：把该段的注销函数交回调用方（写后重同步需要单独注销它）。
 * @returns true=已注册。
 */
function applySessionSystemSection(
  scope: any,
  root: string,
  id: string,
  onSection?: (dispose: () => void) => void,
): boolean {
  const initial = sessionSystemTextFor(root, id)
  if (initial.trim().length === 0) return false
  let lastNonEmpty = initial
  let fallbackAudited = false
  const dispose = scope.systemPrompt.section({
    name: OVERRIDE_SECTION,
    order: 0,
    complete: true,
    // 不变量：本函数永不返回空串（见上方注释）
    text: () => {
      const own = sessionSystemTextFor(root, id)
      if (own.trim().length > 0) {
        lastNonEmpty = own
        return own
      }
      const global = readOverride(root)
      if (global.enabled && global.text.trim().length > 0) {
        if (!fallbackAudited) {
          fallbackAudited = true
          audit(root, { kind: 'session-system-empty-at-assemble', session: id, fallback: 'global-override' })
        }
        return global.text
      }
      if (!fallbackAudited) {
        fallbackAudited = true
        audit(root, { kind: 'session-system-empty-at-assemble', session: id, fallback: 'last-nonempty' })
      }
      return lastNonEmpty
    },
  })
  if (typeof dispose === 'function' && typeof onSection === 'function') onSection(dispose as () => void)
  return true
}

/**
 * 单独注册会话级 system 段（写后重同步用）。调用方必须先注销旧段，避免同名 complete 段叠加。
 */
function registerSessionSystemForAgent(
  agent: { ctx: { inject: (svcs: string[], cb: (scope: any) => void) => any } },
  root: string,
  id: string,
  onSection?: (dispose: () => void) => void,
): unknown {
  return agent.ctx.inject(['systemPrompt'], (scope: any) => {
    applySessionSystemSection(scope, root, id, onSection)
  })
}

/**
 * 按 agent 作用域注册四段（同名段遮蔽全局；cwd 每次组装实时读取 ⇒ 位置转移自动跟随）：
 * ①discipline（order −2000，interpolate:false）②user-prompt（order −1990）
 * ③layered（order −1980）④system（complete，order 0）——④ 仅在注册时文本非空才挂。
 * 空/缺失 agent.id ⇒ 四段全部走全局回退（不读 sessions/）。
 * @param onSystemSection 可选：把会话 system 段的注销函数交回调用方（apply 的写后重同步需要）。
 */
export function registerDisciplineForAgent(
  agent: {
    id?: string
    ctx: { inject: (svcs: string[], cb: (scope: any) => void) => any }
    session?: { header?: { cwd?: string } }
  },
  root: string,
  onSystemSection?: (dispose: () => void) => void,
): unknown {
  const id = String((agent as { id?: unknown })?.id ?? '')
  return agent.ctx.inject(['systemPrompt'], (scope: any) => {
    scope.systemPrompt.section({
      name: DISCIPLINE_SECTION,
      order: DISCIPLINE_ORDER,
      interpolate: false,
      text: () => sessionDisciplineTextFor(root, id, agent?.session?.header?.cwd ?? null),
    })
    scope.systemPrompt.section({
      name: USER_PROMPT_SECTION,
      order: USER_PROMPT_ORDER,
      interpolate: false,
      text: () => sessionUserPromptTextFor(root, id),
    })
    scope.systemPrompt.section({
      name: SESSION_LAYERED_SECTION,
      order: SESSION_LAYERED_ORDER,
      interpolate: false,
      text: () => sessionLayeredTextFor(root, id),
    })
    applySessionSystemSection(scope, root, id, onSystemSection)
  })
}

// ── 装配读取（只读视图数据面）────────────────────────────────────

// 一手证据（0.2.0-rc.2）：dsh-system-prompt 自带这两个段名（包内注册常量）。
// 其余官方段名清单随 dev-mount 冒烟实取快照扩充（见 memory/agent-log.md 流水）。
export const OUR_SECTION_PREFIX = 'dsh-custom:'
export const VERIFIED_OFFICIAL_SECTIONS = new Set(['harness:identity', 'deployment:persona'])

export type SectionOrigin = 'ours' | 'official' | 'other'

export function classifySectionName(name: string): SectionOrigin {
  const n = String(name ?? '')
  if (n.startsWith(OUR_SECTION_PREFIX)) return 'ours'
  if (VERIFIED_OFFICIAL_SECTIONS.has(n)) return 'official'
  return 'other'
}

export interface SectionView {
  name: string
  origin: SectionOrigin
  chars: number
  text: string
}

export interface AssemblyView {
  sections: SectionView[]
  contexts: Array<{ name: string; chars: number }>
  tools: string[]
  variables: string[]
  rendered: string | null
  rendererAvailable: boolean
  renderNote: string | null
  generatedAt: string
  scopeLabel: string
}

export function buildAssemblyView(
  asm: any,
  rendered: string | null,
  rendererAvailable: boolean,
  renderNote: string | null = null,
  scopeLabel: string = '全局（未附着会话作用域）',
): AssemblyView {
  const sections: SectionView[] = (asm?.sections ?? []).map((s: any) => {
    const name = String(s?.name ?? '')
    const text = String(s?.text ?? '')
    return { name, origin: classifySectionName(name), chars: text.length, text }
  })
  return {
    sections,
    contexts: (asm?.contexts ?? []).map((c: any) => ({ name: String(c?.name ?? ''), chars: String(c?.text ?? '').length })),
    tools: (asm?.tools ?? []).map((t: any) => String(t?.name ?? '')).filter((n: string) => n.length > 0),
    variables: Object.keys(asm?.variables ?? {}),
    rendered,
    rendererAvailable,
    renderNote,
    generatedAt: new Date().toISOString(),
    scopeLabel,
  }
}

// ── 宿主渲染器加载（分层解析；逐级留痕，全失败降级为原文）────────────

export interface RendererModule {
  renderPrompt: (assembly: unknown) => string
}
export type RendererLoader = () => Promise<RendererModule | null>

const RENDERER_SPEC = '@deepseek-ai/dsh-system-prompt'
const dynImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>

async function importRendererAt(from: string | URL): Promise<{ mod: RendererModule; path: string }> {
  const req = createRequire(from)
  const abs = req.resolve(RENDERER_SPEC)
  const mod = (await dynImport(pathToFileURL(abs).href)) as RendererModule
  return { mod, path: abs }
}

/**
 * #决策 2026-10-17 15:46 分层解析宿主渲染器：裸 import 在宿主内必失败——插件包经 junction 加载时
 * Node 把 import.meta.url 归一到 realpath（D:\DeepSeek\dsh-custom\…），裸说明符解析不到 profile 安装树。
 * 顺序：host-argv（宿主进程脚本的安装树，与运行中服务同源）→ ctx-baseUrl（profile 解析链）
 * → loader.internal.resolveSync（宿主内部 API 兜底）→ 模块自身位置 → 裸说明符。
 * 逐级失败落 audit（renderer-resolve-fail 带明细）；成功落 renderer-resolve（策略+路径）。
 */
export function makeRendererLoader(ctx: unknown, root: string | null): RendererLoader {
  let cached: Promise<RendererModule | null> | null = null
  return () =>
    (cached ??= (async () => {
      const c = ctx as { baseUrl?: unknown; loader?: { internal?: { resolveSync?: (...args: any[]) => any; version?: string } } } | null
      const tries: Array<{ strategy: string; run: () => Promise<{ mod: RendererModule; path: string }> }> = []
      const hostScript =
        typeof process.argv[1] === 'string' && process.argv[1].length > 0 && !process.argv[1].startsWith('-') ? process.argv[1] : null
      if (hostScript !== null) tries.push({ strategy: 'host-argv', run: () => importRendererAt(hostScript) })
      const baseUrl = typeof c?.baseUrl === 'string' ? c.baseUrl : null
      if (baseUrl !== null) {
        tries.push({
          strategy: 'ctx-baseUrl',
          run: () => importRendererAt(new URL('dsh-custom.resolve-probe.js', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)),
        })
      }
      const internal = c?.loader?.internal
      if (internal && typeof internal.resolveSync === 'function') {
        tries.push({
          strategy: 'loader-internal',
          run: async () => {
            const base = baseUrl ?? import.meta.url
            const resolved = internal.version === 'v2'
              ? internal.resolveSync(base, { specifier: RENDERER_SPEC, attributes: {} })
              : internal.resolveSync(RENDERER_SPEC, base, {})
            const url = typeof (resolved as { url?: unknown })?.url === 'string' ? String((resolved as { url: string }).url) : null
            if (url === null) throw new Error('resolveSync 未返回 url')
            const mod = (await dynImport(url)) as RendererModule
            return { mod, path: url }
          },
        })
      }
      tries.push({ strategy: 'module-url', run: () => importRendererAt(import.meta.url) })
      tries.push({ strategy: 'bare-import', run: async () => ({ mod: (await dynImport(RENDERER_SPEC)) as RendererModule, path: RENDERER_SPEC }) })

      const failures: string[] = []
      for (const t of tries) {
        try {
          const loaded = await t.run()
          if (typeof loaded.mod?.renderPrompt !== 'function') {
            failures.push(`${t.strategy}: 无 renderPrompt 导出`)
            continue
          }
          if (root !== null) audit(root, { kind: 'renderer-resolve', strategy: t.strategy, path: loaded.path, ok: true })
          return loaded.mod
        } catch (e) {
          const code = (e as { code?: unknown })?.code
          failures.push(`${t.strategy}: ${String(code ?? (e as { message?: unknown })?.message ?? e)}`)
        }
      }
      const detail = failures.join(' ｜ ')
      if (root !== null) audit(root, { kind: 'renderer-resolve-fail', detail })
      console.warn(`[dsh-custom] 宿主渲染器解析失败（渲染视图降级为原文）：${detail}`)
      return null
    })())
}

/**
 * #决策 2026-10-17 15:58 容错渲染（降级第二级）：离线全局视图拿不到请求期变量值
 * （如 `{{model}}` 在无会话上下文的 assemble 中注册但无值），宿主严格渲染随之抛错。
 * 容错语义＝与宿主同构的段级渲染，但未解析的 `{{name}}` 以原文保留并回报清单；
 * 严格渲染成功时绝不走此路径（优先保证与宿主逐字节一致）。
 */
export function renderPromptTolerant(assembly: any): { text: string; unresolved: string[] } {
  const variables = (assembly?.variables ?? {}) as Record<string, unknown>
  const unresolved = new Set<string>()
  const interp = (input: any): string => {
    const text = String(input?.text ?? '')
    if (input?.interpolate === false) return text
    return text.replace(/\{\{([^{}]*)\}\}/g, (raw: string, name: string) => {
      if (Object.hasOwn(variables, name) && variables[name] !== undefined) return String(variables[name])
      unresolved.add(`{{${name}}}`)
      return raw
    })
  }
  const sections = (assembly?.sections ?? []).map(interp).filter((t: string) => t.length > 0)
  return { text: sections.join('\n\n'), unresolved: [...unresolved] }
}

export async function readAssembly(
  svc: { assemble: (context?: unknown) => Promise<unknown> },
  loader?: RendererLoader,
  root?: string | null,
  scopeLabel?: string,
): Promise<AssemblyView> {
  const asm: any = await svc.assemble()
  let rendered: string | null = null
  let rendererAvailable = false
  let renderNote: string | null = null
  const useLoader: RendererLoader =
    loader ??
    (async () => {
      try {
        const mod = (await dynImport(RENDERER_SPEC)) as RendererModule
        return typeof mod?.renderPrompt === 'function' ? mod : null
      } catch (e) {
        // 无 ctx 环境（如离线测试）时的兜底路径：失败可预期，仍留痕（#决策 2026-10-17 D2）
        console.warn('[dsh-custom] 渲染器不可用（无 ctx 环境，渲染视图降级为原文）：', String((e as { message?: unknown })?.message ?? e))
        return null
      }
    })
  try {
    const mod = await useLoader()
    if (mod !== null) {
      rendererAvailable = true
      try {
        rendered = String(mod.renderPrompt(asm)) // 严格渲染＝宿主请求期同法（逐字节）
      } catch (strictError) {
        const detail = String((strictError as { message?: unknown })?.message ?? strictError)
        const fallback = renderPromptTolerant(asm)
        rendered = fallback.text
        renderNote =
          `严格渲染被运行时变量阻止（离线全局视图无会话上下文）；已容错渲染为近似文本：` +
          (fallback.unresolved.length > 0 ? `未解析变量 ${fallback.unresolved.join('、')} 以原文呈现` : '无未解析变量')
        if (root !== undefined && root !== null) audit(root, { kind: 'render-tolerate', reason: detail, unresolved: fallback.unresolved })
        console.warn('[dsh-custom] 严格渲染失败，已容错渲染：', detail)
      }
    }
  } catch (e) {
    console.warn('[dsh-custom] renderPrompt 调用失败（渲染视图降级为原文）：', String((e as { message?: unknown })?.message ?? e))
  }
  return buildAssemblyView(asm, rendered, rendererAvailable, renderNote, scopeLabel)
}

// ── 状态读取（存储 + 护栏计数）────────────────────────────────────

export interface GuardStats {
  denied: number
  touched: number
}

// 本包版本（关于页展示用；读 package.json 一次并缓存）
let cachedPluginVersion: string | null = null
function readPluginVersion(): string {
  if (cachedPluginVersion === null) {
    try {
      const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { version?: unknown }
      cachedPluginVersion = typeof pkg.version === 'string' ? pkg.version : ''
    } catch {
      cachedPluginVersion = ''
    }
  }
  return cachedPluginVersion
}

export interface StatusView {
  root: string
  version?: string
  files: Array<{ name: string; hash: string | null; mtime: string | null; bytes: number | null }>
  externalChanges: ExternalChange[]
  guard: GuardStats
  note: string
}

export function collectStatus(root: string, stats: GuardStats): StatusView {
  const changes = detectExternalChanges(root)
  const files = TRACKED.map((name) => {
    let mtime: string | null = null
    let bytes: number | null = null
    try {
      const st = statSync(join(root, name))
      mtime = st.mtime.toISOString()
      bytes = st.size
    } catch (e) {
      // 文件不存在（ENOENT）属常态：hash 也会是 null；其余失败须可见（#决策 2026-10-17 D2）
      const code = (e as { code?: unknown })?.code
      if (code !== 'ENOENT') console.warn(`[dsh-custom] 存储文件状态读取失败（${String(code ?? e)}）：${name}`)
    }
    return { name, hash: hashOfFile(join(root, name)), mtime, bytes }
  })
  return {
    root,
    version: readPluginVersion(),
    files,
    externalChanges: changes,
    guard: { denied: stats.denied, touched: stats.touched },
    note: 'P0 保守子集：模型写存储＝拦截＋提示＋留痕（语义 b 的确认放行随 P2 交付）',
  }
}

// ── HTTP 数据面（同源 /api/dsh-custom/*）──────────────────────────

function jsonResponse(res: any, code: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

function readJsonBody(req: any, limit = 1024 * 1024): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new Error(`请求体过大（>${String(limit)} 字节）`))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.trim().length === 0) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(raw)
        resolve(parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {})
      } catch (e) {
        reject(new Error(`请求体不是 JSON：${String((e as { message?: unknown })?.message ?? e)}`))
      }
    })
    req.on('error', (e: unknown) => reject(e instanceof Error ? e : new Error(String(e))))
  })
}

export interface AgentsView {
  list: () => Array<{ id: string; cwd: string | null; model: string | null; title: string | null }>
  resolve: (id: string) => { agent: unknown; cwd: string | null; model: string | null; title: string | null } | null
}

export function makeApi(
  root: string,
  getService: () => { assemble: (context?: unknown) => Promise<unknown> } | null,
  stats: GuardStats,
  loader?: RendererLoader,
  onAccess?: () => void,
  agentsView?: AgentsView,
  onSessionChanged?: (id: string) => void,
  bootState?: { concludeOnPass: boolean | null } | null,
): (req: any, res: any) => void {
  const handlePut = (req: any, res: any, run: (body: Record<string, unknown>) => unknown): void => {
    readJsonBody(req)
      .then((body) => jsonResponse(res, 200, { ok: true, value: run(body) }))
      .catch((e: unknown) => {
        if (e instanceof MtimeConflictError) {
          jsonResponse(res, 409, { ok: false, error: e.message, conflict: e.current })
          return
        }
        jsonResponse(res, 400, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
      })
  }
  /** P1-6 乐观锁守卫：body.expectedMtime 存在且与当前不符→抛 MtimeConflictError（所有写路径共用）。 */
  const guardMtime = (body: Record<string, unknown>, filePath: string, label: string): void => {
    const expected = body.expectedMtime
    if (expected === undefined) return // 旧客户端兼容：不带基线＝不检查
    if (expected === null) {
      if (!mtimeMatches(filePath, null)) throw new MtimeConflictError({ [label]: mtimeOfFileOrNull(filePath) }, label)
      return
    }
    if (typeof expected !== 'string') throw new Error('expectedMtime 必须是字符串或 null')
    if (!mtimeMatches(filePath, expected)) throw new MtimeConflictError({ [label]: mtimeOfFileOrNull(filePath) }, label)
  }
  /** 会话级覆盖落盘后通知注入层重同步（未接线时静默跳过；失败只告警，不影响本次保存结果）。 */
  const notifySessionChanged = (id: string): void => {
    if (onSessionChanged === undefined) return
    try {
      onSessionChanged(id)
    } catch (e) {
      console.warn('[dsh-custom] 会话级段重同步失败：', String((e as { message?: unknown })?.message ?? e))
    }
  }
  const access = (): void => {
    if (onAccess === undefined) return
    try {
      onAccess()
    } catch (e) {
      console.warn('[dsh-custom] 状态同步失败：', String((e as { message?: unknown })?.message ?? e))
    }
  }
  return (req: any, res: any) => {
    access()
    const method = String(req?.method ?? 'GET').toUpperCase()
    const pathname = String(req?.url ?? '').split('?')[0].replace(/\/+$/, '') || '/'
    if (pathname === '/api/dsh-custom/assembly') {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const svc = getService()
      if (!svc) {
        jsonResponse(res, 503, { ok: false, error: 'systemPrompt 服务尚不可用（宿主未提供或尚未就绪）' })
        return
      }
      const sessionId = new URL(String(req?.url ?? '/'), 'http://x').searchParams.get('session')
      if (sessionId !== null && sessionId.length > 0) {
        // P2+：会话级实取——与真实请求同法：assemble({ agent, scope: agent })（#决策 2026-10-17 18:2x）
        const found = agentsView?.resolve(sessionId) ?? null
        if (found === null) {
          jsonResponse(res, 404, { ok: false, error: '会话不存在或未活跃（请先在对应会话中发一条消息激活，再刷新）' })
          return
        }
        const scoped = { assemble: () => svc.assemble({ agent: found.agent, scope: found.agent }) }
        const label = `会话 ${sessionId.replace(/^session-/, '').slice(0, 8)}${found.title ? ` · ${found.title}` : ''}`
        readAssembly(scoped, loader, root, label)
          .then((value) => jsonResponse(res, 200, { ok: true, value }))
          .catch((e: unknown) => jsonResponse(res, 500, { ok: false, error: String((e as { message?: unknown })?.message ?? e) }))
        return
      }
      readAssembly(svc, loader, root)
        .then((value) => jsonResponse(res, 200, { ok: true, value }))
        .catch((e: unknown) => jsonResponse(res, 500, { ok: false, error: String((e as { message?: unknown })?.message ?? e) }))
      return
    }
    if (pathname === '/api/dsh-custom/sessions') {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      jsonResponse(res, 200, { ok: true, value: { sessions: agentsView?.list() ?? [] } })
      return
    }
    if (pathname === '/api/dsh-custom/stats') {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      try {
        const raw = readCachedFile(join(root, 'audit.jsonl'))?.text ?? ''
        const entries: Array<Record<string, unknown>> = []
        let guardDeny = 0
        let externalChange = 0
        for (const line of raw.split('\n')) {
          if (!line.trim()) continue
          try {
            const j = JSON.parse(line) as Record<string, unknown>
            entries.push(j)
            if (j.kind === 'guard-deny') guardDeny += 1
            if (j.kind === 'external-change') externalChange += 1
          } catch { /* 坏行跳过，不阻塞统计 */ }
        }
        const backups = listAllSnapshots(root)
        const sessions = agentsView?.list() ?? []
        jsonResponse(res, 200, {
          ok: true,
          value: {
            guardDeny,
            externalChange,
            snapshots: backups.length,
            sessions: sessions.length,
            audit: entries.slice(-20),
          },
        })
      } catch (e: unknown) {
        jsonResponse(res, 500, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
      }
      return
    }
    // 会话对话（P1-3，#决策 13）：只读视图，过滤注入并给出隐藏计数
    const sessionConvMatch = /^\/api\/dsh-custom\/sessions\/([^/]+)\/conversation$/.exec(pathname)
    if (sessionConvMatch !== null) {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      let csid = ''
      try { csid = decodeURIComponent(sessionConvMatch[1]) } catch { csid = sessionConvMatch[1] }
      const found = agentsView?.resolve(csid) ?? null
      if (found === null) {
        jsonResponse(res, 404, { ok: false, error: '会话不存在或未活跃（对话读取需要活跃会话）' })
        return
      }
      try {
        const session = (found.agent as { session?: unknown } | null)?.session as { snapshotEvents?: unknown } | undefined
        const events = typeof session?.snapshotEvents === 'function' ? (session.snapshotEvents as () => unknown[])() : null
        if (!Array.isArray(events)) throw new Error('该宿主的会话对象不提供事件读取')
        jsonResponse(res, 200, { ok: true, value: conversationViewOf(events) })
      } catch (e: unknown) {
        jsonResponse(res, 500, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
      }
      return
    }
    const sessionOverrideMatch = /^\/api\/dsh-custom\/sessions\/([^/]+)\/override$/.exec(pathname)
    if (sessionOverrideMatch !== null) {
      let sid = ''
      try { sid = decodeURIComponent(sessionOverrideMatch[1]) } catch { sid = sessionOverrideMatch[1] }
      if (method === 'GET') {
        try {
          const segments = readSessionOverride(root, sid)
          const mtimes: Record<string, string | null> = {}
          const dir = sessionDir(root, sid)
          for (const seg of SESSION_SEGMENTS) mtimes[seg] = mtimeOfFileOrNull(join(dir, seg + '.md'))
          jsonResponse(res, 200, { ok: true, value: { segments, mtimes } })
        } catch (e: unknown) {
          jsonResponse(res, 400, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
        }
        return
      }
      if (method === 'PUT') {
        handlePut(req, res, (body) => {
          const segments = (body.segments ?? {}) as Record<string, string | null>
          const expected = body.expectedMtimes
          if (expected !== undefined) {
            if (expected === null || typeof expected !== 'object') throw new Error('expectedMtimes 必须是对象')
            const dir = sessionDir(root, sid)
            const conflicts: Record<string, string | null> = {}
            for (const seg of SESSION_SEGMENTS) {
              if (!(seg in segments)) continue
              const raw = (expected as Record<string, unknown>)[seg]
              if (raw === undefined) continue
              let exp: string | null
              if (raw === null) exp = null
              else if (typeof raw === 'string') exp = raw
              else throw new Error(`expectedMtimes.${seg} 必须是字符串或 null`)
              const p = join(dir, seg + '.md')
              if (!mtimeMatches(p, exp)) conflicts[seg] = mtimeOfFileOrNull(p)
            }
            if (Object.keys(conflicts).length > 0) throw new MtimeConflictError(conflicts, '该会话的提示词段')
          }
          const result = writeSessionOverride(root, sid, segments)
          notifySessionChanged(sid)
          return result
        })
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    const sessionRollbackMatch = /^\/api\/dsh-custom\/sessions\/([^/]+)\/rollback$/.exec(pathname)
    if (sessionRollbackMatch !== null) {
      if (method !== 'POST') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      let sid = ''
      try { sid = decodeURIComponent(sessionRollbackMatch[1]) } catch { sid = sessionRollbackMatch[1] }
      handlePut(req, res, (body) => {
        const target: 'official' | 'previous' = String(body.target ?? 'official') === 'previous' ? 'previous' : 'official'
        const result = rollbackSession(root, sid, target)
        notifySessionChanged(sid)
        return result
      })
      return
    }
    if (pathname === '/api/dsh-custom/status') {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      try {
        jsonResponse(res, 200, { ok: true, value: collectStatus(root, stats) })
      } catch (e: unknown) {
        jsonResponse(res, 500, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
      }
      return
    }
    if (pathname === '/api/dsh-custom/discipline') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: readDiscipline(root) })
        return
      }
      if (method === 'PUT') {
        handlePut(req, res, (body) => {
          if (typeof body.text !== 'string') throw new Error('text 必须是字符串')
          guardMtime(body, join(root, 'discipline.md'), '前置纪律')
          return saveDiscipline(root, body.text)
        })
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    // ── P4：审计流（⑦区数据面：audit.jsonl 尾部 N 条）──
    if (pathname === '/api/dsh-custom/audit') {
      if (method === 'GET') {
        try {
          const f = readCachedFile(join(root, 'audit.jsonl'))
          const lines = (f?.text ?? '').split('\n').filter((l) => l.trim().length > 0)
          const limit = Math.min(100, Math.max(1, Number(new URL(String(req?.url ?? '/'), 'http://x').searchParams.get('limit') ?? 50)))
          const tail = lines.slice(-limit).map((l) => {
            try {
              return JSON.parse(l)
            } catch {
              return { kind: 'unparsable', raw: l.slice(0, 120) }
            }
          })
          jsonResponse(res, 200, { ok: true, value: { total: lines.length, entries: tail.reverse() } })
        } catch {
          jsonResponse(res, 200, { ok: true, value: { total: 0, entries: [] } })
        }
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    // ── P4/P5：我的提示词（user-prompt）──
    if (pathname === '/api/dsh-custom/user-prompt') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: readUserPrompt(root) })
        return
      }
      if (method === 'PUT') {
        handlePut(req, res, (body) => {
          if (typeof body.text !== 'string') throw new Error('text 必须是字符串')
          guardMtime(body, join(root, 'user-prompt.md'), '我的提示词')
          return saveUserPrompt(root, body.text, body.enabled !== false)
        })
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    // ── P4/P5：渐进加载层管理 ──
    if (pathname === '/api/dsh-custom/layered') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: listLayered(root) })
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    {
      const mSec = pathname.match(/^\/api\/dsh-custom\/layered\/([^/]+)$/)
      if (mSec !== null) {
        const secName = decodeURIComponent(mSec[1])
        if (method === 'GET') {
          const v = readLayeredSection(root, secName)
          if (v === null) jsonResponse(res, 404, { ok: false, error: '分节不存在' })
          else jsonResponse(res, 200, { ok: true, value: v })
          return
        }
        if (method === 'PUT') {
          handlePut(req, res, (body) => {
            if (typeof body.text !== 'string') throw new Error('text 必须是字符串')
            const v = saveLayeredSection(root, secName, body.text)
            if (v === null) throw new Error('分节不存在')
            return v
          })
          return
        }
        if (method === 'DELETE') {
          const r = deleteLayeredSection(root, secName)
          if (!r.ok) { jsonResponse(res, 403, { ok: false, error: r.error }); return }
          jsonResponse(res, 200, { ok: true, value: { deleted: true } })
          return
        }
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const mAct = pathname.match(/^\/api\/dsh-custom\/layered\/([^/]+)\/(reset|toggle)$/)
      if (mAct !== null && method === 'POST') {
        handlePut(req, res, (body) => {
          const secName = decodeURIComponent(mAct[1])
          const v = mAct[2] === 'reset' ? resetLayeredSection(root, secName) : toggleLayeredSection(root, secName, body.enabled !== false)
          if (v === null) throw new Error('分节不存在')
          return v
        })
        return
      }
    }
    if (pathname === '/api/dsh-custom/governance') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: { ...readGovernance(root), boot: bootState ?? null } })
        return
      }
      if (method === 'PUT') {
        readJsonBody(req)
          .then((body) => {
            const r = saveGovernance(root, body)
            if ('error' in r) { jsonResponse(res, r.status, { ok: false, error: r.error }); return }
            jsonResponse(res, 200, { ok: true, value: r.view })
          })
          .catch((e: unknown) => jsonResponse(res, 400, { ok: false, error: String((e as { message?: unknown })?.message ?? e) }))
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (pathname === '/api/dsh-custom/governance/allowlist') {
      if (method === 'POST') {
        readJsonBody(req)
          .then((body) => {
            const r = governanceAllowlistAdd(root, body.pattern, body.note)
            if ('error' in r) { jsonResponse(res, r.status, { ok: false, error: r.error }); return }
            jsonResponse(res, 200, { ok: true, value: r.view })
          })
          .catch((e: unknown) => jsonResponse(res, 400, { ok: false, error: String((e as { message?: unknown })?.message ?? e) }))
        return
      }
      if (method === 'DELETE') {
        const q = new URLSearchParams(String(req?.url ?? '').split('?')[1] ?? '')
        const r = governanceAllowlistRemove(root, q.get('pattern'))
        if ('error' in r) { jsonResponse(res, r.status, { ok: false, error: r.error }); return }
        jsonResponse(res, 200, { ok: true, value: r.view })
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (pathname === '/api/dsh-custom/backups/detail') {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const q = new URLSearchParams(String(req?.url ?? '').split('?')[1] ?? '')
      const detailSession = q.get('sessionId') ?? ''
      const detail = backupDetail(root, q.get('name') ?? '', detailSession.length > 0 ? detailSession : null)
      if (!detail) {
        jsonResponse(res, 404, { ok: false, error: '快照不存在或名称非法' })
        return
      }
      jsonResponse(res, 200, { ok: true, value: detail })
      return
    }
    if (pathname === '/api/dsh-custom/settings') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: readInjectSettings(root) })
        return
      }
      if (method === 'PUT') {
        handlePut(req, res, (body) => saveSettings(root, { injectEnabled: body.injectEnabled }))
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (pathname === '/api/dsh-custom/scope') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: readScope(root) })
        return
      }
      if (method === 'PUT') {
        handlePut(req, res, (body) => saveScope(root, body.rules))
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (pathname === '/api/dsh-custom/agents') {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      jsonResponse(res, 200, { ok: true, value: agentsCoexistence() })
      return
    }
    if (pathname === '/api/dsh-custom/override') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: readOverride(root) })
        return
      }
      if (method === 'PUT') {
        const svc = getService()
        if (!svc) {
          jsonResponse(res, 503, { ok: false, error: 'systemPrompt 服务尚不可用（无法做干跑校验）' })
          return
        }
        readJsonBody(req)
          .then(async (body) => {
            if (typeof body.text !== 'string') throw new Error('text 必须是字符串')
            guardMtime(body, join(root, 'override.md'), '整段接管文本')
            const asm = (await svc.assemble()) as { variables?: Record<string, unknown> } | null
            let render: ((a: unknown) => string) | null = null
            if (loader) {
              try {
                const mod = await loader()
                if (mod !== null) render = (a: unknown) => String(mod.renderPrompt(a))
              } catch (e) {
                console.warn('[dsh-custom] 干跑渲染器不可用，改用解析级校验：', String((e as { message?: unknown })?.message ?? e))
              }
            }
            const err = validateOverrideText(body.text, (asm?.variables ?? {}) as Record<string, unknown>, render)
            if (err !== null) {
              jsonResponse(res, 422, { ok: false, error: `干跑校验未通过：${err}` })
              return
            }
            if (readOverride(root).text === body.text) {
              // P1-10 幂等：接管文本未变→不重写、不建快照（防重复提交刷快照）
              audit(root, { kind: 'save-noop', target: 'override' })
              access()
              jsonResponse(res, 200, { ok: true, value: readOverride(root), skipped: true })
              return
            }
            snapshot(root, 'save-override')
            writeFileSync(join(root, 'override.md'), body.text, 'utf8')
            forgetCachedFile(join(root, 'override.md'))
            recordHashes(root, ['override.md'])
            audit(root, { kind: 'override-saved', bytes: Buffer.byteLength(body.text, 'utf8') })
            access()
            jsonResponse(res, 200, { ok: true, value: readOverride(root) })
          })
          .catch((e: unknown) => {
            if (e instanceof MtimeConflictError) {
              jsonResponse(res, 409, { ok: false, error: e.message, conflict: e.current })
              return
            }
            jsonResponse(res, 400, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
          })
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (pathname === '/api/dsh-custom/override/enable') {
      if (method !== 'PUT') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const svc = getService()
      if (!svc) {
        jsonResponse(res, 503, { ok: false, error: 'systemPrompt 服务尚不可用' })
        return
      }
      readJsonBody(req)
        .then(async (body) => {
          if (body.enabled !== true) {
            saveSettings(root, { overrideEnabled: false })
            access()
            audit(root, { kind: 'override-disabled' })
            jsonResponse(res, 200, { ok: true, value: readOverride(root) })
            return
          }
          if (readOverride(root).text.trim().length === 0) {
            jsonResponse(res, 409, { ok: false, error: '接管文本为空：请先保存「取材于当前」的非空文本再启用（空文本不放行，避免模型收到空提示词）' })
            return
          }
          saveSettings(root, { overrideEnabled: true })
          access()
          try {
            await svc.assemble() // 启用探测：complete 独占校验（多于一个 complete=组装失败）
            audit(root, { kind: 'override-enabled' })
            jsonResponse(res, 200, { ok: true, value: readOverride(root) })
          } catch (e) {
            const msg = String((e as { message?: unknown })?.message ?? e)
            saveSettings(root, { overrideEnabled: false })
            access()
            const m = /multiple complete prompt sections are active:\s*(.+)$/.exec(msg)
            if (m !== null) {
              const others = m[1]
                .split(',')
                .map((s) => s.trim().replace(/"/g, ''))
                .filter((n) => n.length > 0 && n !== OVERRIDE_SECTION)
              audit(root, { kind: 'override-conflict', others })
              jsonResponse(res, 409, {
                ok: false,
                error: `互斥冲突：作用域内已存在其它 complete 接管段（${others.length > 0 ? others.join('、') : '未识别名单'}）——请先停用对方再启用本接管（已自动回退为关闭）`,
                conflict: others,
              })
            } else {
              audit(root, { kind: 'override-conflict', others: [msg.slice(0, 200)] })
              jsonResponse(res, 409, { ok: false, error: `启用探测失败（已自动回退为关闭）：${msg}` })
            }
          }
        })
        .catch((e: unknown) => jsonResponse(res, 400, { ok: false, error: String((e as { message?: unknown })?.message ?? e) }))
      return
    }
    if (pathname === '/api/dsh-custom/backups') {
      if (method === 'GET') {
        jsonResponse(res, 200, { ok: true, value: { entries: listAllSnapshots(root) } })
        return
      }
      if (method === 'POST') {
        // 手动快照（2026-10-19 旅程补缺）：与自动快照同管道（审计/prune 一并生效）
        try {
          const dir = snapshot(root, 'manual')
          jsonResponse(res, 200, { ok: true, value: { dir, entries: listAllSnapshots(root) } })
        } catch (e) {
          jsonResponse(res, 500, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
        }
        return
      }
      if (method === 'DELETE') {
        // 单条快照删除（2026-10-19）：名字白名单＋存在性校验；审计 backup-deleted
        const q = new URLSearchParams(String(req?.url ?? '').split('?')[1] ?? '')
        const name = q.get('name') ?? ''
        if (!/^[0-9A-Za-z._-]+$/.test(name)) {
          jsonResponse(res, 400, { ok: false, error: '非法的快照名' })
          return
        }
        const scope = q.get('scope') === 'session' ? 'session' : 'global'
        const sid = q.get('sessionId') ?? ''
        const dir = scope === 'session' ? (sid.length > 0 ? join(sessionDir(root, sid), 'backups', name) : '') : join(root, 'backups', name)
        if (dir === '') {
          jsonResponse(res, 400, { ok: false, error: '会话快照删除需要 sessionId' })
          return
        }
        if (!existsSync(dir)) {
          jsonResponse(res, 404, { ok: false, error: '快照不存在' })
          return
        }
        try {
          rmSync(dir, { recursive: true, force: true })
          audit(root, { kind: 'backup-deleted', scope, name, ...(scope === 'session' ? { session: sid } : {}) })
          jsonResponse(res, 200, { ok: true, value: { deleted: name, entries: listAllSnapshots(root) } })
        } catch (e) {
          jsonResponse(res, 500, { ok: false, error: String((e as { message?: unknown })?.message ?? e) })
        }
        return
      }
      jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (pathname === '/api/dsh-custom/backups/restore') {
      if (method !== 'PUT') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      handlePut(req, res, (body) => {
        if (typeof body.name !== 'string') throw new Error('name 必须是字符串')
        const sessionId = typeof body.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : null
        if (String(body.scope ?? 'global') === 'session') {
          if (sessionId === null) throw new Error('会话快照恢复需要 sessionId')
          const result = restoreSessionBackup(root, sessionId, body.name)
          notifySessionChanged(sessionId)
          access()
          return result
        }
        const result = restoreBackup(root, body.name)
        access()
        return result
      })
      return
    }
    if (pathname === '/api/dsh-custom/backups/export') {
      if (method !== 'GET') {
        jsonResponse(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const q = new URLSearchParams(String(req?.url ?? '').split('?')[1] ?? '')
      const sessionIdParam = q.get('sessionId') ?? ''
      const data = snapshotExport(root, q.get('name') ?? '', sessionIdParam.length > 0 ? sessionIdParam : null)
      if (!data) {
        jsonResponse(res, 404, { ok: false, error: '快照不存在、名称非法或超出导出上限（2MB）' })
        return
      }
      jsonResponse(res, 200, { ok: true, value: data })
      return
    }
    jsonResponse(res, 404, { ok: false, error: 'not found' })
  }
}

// ── 插件装载 ─────────────────────────────────────────────────────

export function apply(ctx: any): () => void {
  const root = storageRoot()
  const info = ensureStorage(root)
  // C7（2026-10-19）：concludeOnPass 是引擎「注册面 boot 快照」——本插件与引擎同批启动，此处记录文件值；
  // 页面用「当前值 ≠ 启动值」显示持久「待重启」徽标（重启后快照刷新、徽标消失）。仅供提示，不参与判定。
  const bootState: { concludeOnPass: boolean | null } = { concludeOnPass: null }
  try { bootState.concludeOnPass = readGovernance(root).concludeOnPass } catch { /* 读取失败=不显示徽标 */ }
  const changes = detectExternalChanges(root)
  const stats: GuardStats = { denied: 0, touched: 0 }
  audit(root, { kind: 'boot', created: info.created.length, externalChanges: changes.length })
  console.log(
    `[dsh-custom] P0 运行时已装载 | 存储=${root} | 新建=${info.created.length} | 检测到会话外改动=${changes.length}`,
  )
  console.log('[dsh-custom] 护栏：模型对存储区写入＝拦截＋提示＋留痕（P0 保守子集；语义 b 确认放行随 P2）')

  let service: { assemble: (context?: unknown) => Promise<unknown>; section: (section: unknown) => () => void } | null = null

  // P2：深改接管段动态注册（#决策 2026-10-17 18:0x：启用且文本非空才 wire；空文本不放行=防模型收到空提示词）
  let overrideWired: (() => void) | null = null
  const syncOverride = (): void => {
    if (service === null) return
    const shouldWire = readInjectSettings(root).overrideEnabled && readOverride(root).text.trim().length > 0
    if (shouldWire && overrideWired === null) {
      try {
        overrideWired = registerOverride(service, root)
      } catch (e) {
        overrideWired = null
        console.warn('[dsh-custom] 深改接管段注册失败：', String((e as { message?: unknown })?.message ?? e))
      }
    } else if (!shouldWire && overrideWired !== null) {
      try {
        overrideWired()
      } catch (e) {
        console.warn('[dsh-custom] 深改接管段注销失败：', String((e as { message?: unknown })?.message ?? e))
      }
      overrideWired = null
    }
  }
  ctx.effect(() => () => {
    if (overrideWired !== null) {
      try {
        overrideWired()
      } catch (e) {
        console.warn('[dsh-custom] 深改接管段清理失败：', String((e as { message?: unknown })?.message ?? e))
      }
      overrideWired = null
    }
  }, 'dsh-custom: override cleanup')

  ctx.inject(['systemPrompt'], (scoped: any) => {
    service = scoped.systemPrompt
    scoped.effect(() => registerDiscipline(scoped.systemPrompt, root), 'dsh-custom: discipline section')
    audit(root, { kind: 'sysprompt-attached', section: DISCIPLINE_SECTION, order: DISCIPLINE_ORDER })
    // P5：我的提示词段（装配序：常驻核心(-2000)→我的提示词(-1990)→官方(0)；空/关=空文本自动剔除）
    scoped.effect(
      () =>
        scoped.systemPrompt.section({
          name: USER_PROMPT_SECTION,
          order: USER_PROMPT_ORDER,
          interpolate: false,
          text: () => userPromptTextFor(root),
        }),
      'dsh-custom: user-prompt section',
    )
    audit(root, { kind: 'sysprompt-attached', section: USER_PROMPT_SECTION, order: USER_PROMPT_ORDER })
    syncOverride()
  })

  // P1b：按 agent 作用域注册同名段（遮蔽全局；命中工作区规则即覆盖，cwd 实时读取 ⇒ 位置转移自动跟随）
  // 附：会话级视图数据源（agentsView，真实请求同法 assemble({agent, scope: agent})）
  // 2026-10-19 P1-2：标题/模型改接宿主真源（0.2.1-rc.2 源码实证，与官方 api-session-controller 同法）——
  //   title = sessionProjections.stateOf(s,'title') → sessionTitle.get(s).title → 旧 header.title；
  //   model = sessionProjections.stateOf(s,'modelSelection').pending??lastUsed → session.requestHeader().config
  //           → agentDefaultModel.currentSelection() → 旧 header.model。
  // 每级来源独立降级（服务缺失/旧宿主/读取抛错都跳过该级），单会话读取失败不影响整表。
  let agentsRef: any = null
  let sessionTitleRef: any = null
  let sessionProjectionsRef: any = null
  let agentDefaultModelRef: any = null
  ctx.inject(['sessionTitle'], (c: any) => { sessionTitleRef = c.sessionTitle })
  ctx.inject(['sessionProjections'], (c: any) => { sessionProjectionsRef = c.sessionProjections })
  ctx.inject(['agentDefaultModel'], (c: any) => { agentDefaultModelRef = c.agentDefaultModel })

  const routeLabelOf = (selection: any): string | null => {
    const provider = typeof selection?.provider === 'string' ? selection.provider.trim() : ''
    const model = typeof selection?.model === 'string' ? selection.model.trim() : ''
    if (provider.length > 0 && model.length > 0) return provider + '/' + model
    return model.length > 0 ? model : null
  }
  const agentModelLabelOf = (agent: any): string | null => {
    const session = agent?.session
    if (session !== null && session !== undefined) {
      try {
        const state = sessionProjectionsRef?.stateOf?.(session, 'modelSelection')
        const picked = routeLabelOf(state?.pending ?? state?.lastUsed)
        if (picked !== null) return picked
      } catch { /* 投影不可用 → 下一级 */ }
      try {
        const logged = routeLabelOf(session?.requestHeader?.()?.config)
        if (logged !== null) return logged
      } catch { /* 无请求头（空白会话）→ 下一级 */ }
    }
    try {
      const byDefault = routeLabelOf(agentDefaultModelRef?.currentSelection?.())
      if (byDefault !== null) return byDefault
    } catch { /* 默认模型服务不可用 → 下一级 */ }
    const legacy = typeof agent?.session?.header?.model === 'string' ? agent.session.header.model : agent?.model
    return typeof legacy === 'string' && legacy.trim().length > 0 ? legacy.trim() : null
  }
  const agentTitleOf = (agent: any): string | null => {
    const session = agent?.session
    if (session !== null && session !== undefined) {
      try {
        const projected = sessionProjectionsRef?.stateOf?.(session, 'title')
        if (typeof projected === 'string' && projected.trim().length > 0) return projected.trim()
      } catch { /* 投影不可用 → 下一级 */ }
      try {
        const snapshot = sessionTitleRef?.get?.(session)
        const title = typeof snapshot === 'string' ? snapshot : snapshot?.title
        if (typeof title === 'string' && title.trim().length > 0) return title.trim()
      } catch { /* 标题服务不可用 → 下一级 */ }
    }
    const legacy = typeof agent?.session?.header?.title === 'string' ? agent.session.header.title : agent?.title
    return typeof legacy === 'string' && legacy.trim().length > 0 ? legacy.trim() : null
  }
  const agentsView: AgentsView = {
    list: () =>
      ((agentsRef?.list() ?? []) as any[])
        .map((a) => ({
          id: String(a?.id ?? ''),
          cwd: typeof a?.session?.header?.cwd === 'string' ? a.session.header.cwd : null,
          model: agentModelLabelOf(a),
          title: agentTitleOf(a),
        }))
        .filter((x) => x.id.length > 0),
    resolve: (id: string) => {
      const agent = agentsRef?.get(id) ?? null
      if (agent === null || agent === undefined) return null
      return {
        agent,
        cwd: typeof agent?.session?.header?.cwd === 'string' ? agent.session.header.cwd : null,
        model: agentModelLabelOf(agent),
        title: agentTitleOf(agent),
      }
    },
  }
  const scopedDisciplineFibers = new Map<unknown, unknown>()
  // 会话 system 段（complete）单独持注销句柄：「挂不挂」由注册时刻的文本决定，写后必须重同步。
  // 两种句柄都只影响 system 段：①首次注册拿「段级」注销函数（inject fiber 与另三段共用，不能整体 dispose）；
  // ②写后重同步新建的 fiber 只含 system 段，注销用 fiber.dispose（不留空 fiber）。
  const sessionSystemFibers = new Map<string, () => void>()
  const dropSessionSystem = (id: string): void => {
    const old = sessionSystemFibers.get(id)
    if (old === undefined) return
    sessionSystemFibers.delete(id)
    try {
      old()
    } catch (e) {
      console.warn('[dsh-custom] 会话 system 段注销失败：', String((e as { message?: unknown })?.message ?? e))
    }
  }
  const trackSessionSystem = (id: string, dispose: () => void): void => {
    if (id.length === 0) return
    dropSessionSystem(id)
    sessionSystemFibers.set(id, dispose)
  }
  const installScopedDiscipline = (agent: any): void => {
    if (scopedDisciplineFibers.has(agent)) return
    const id = String((agent as { id?: unknown })?.id ?? '')
    try {
      scopedDisciplineFibers.set(
        agent,
        registerDisciplineForAgent(agent, root, (dispose) => trackSessionSystem(id, dispose)),
      )
    } catch (e) {
      console.warn('[dsh-custom] 作用域纪律段注册失败：', String((e as { message?: unknown })?.message ?? e))
    }
  }
  /**
   * 会话级保存/回滚后的写后重同步：discipline/user/layered 的 text 是函数（每次组装实时求值），
   * **不需要**重同步；只有 system 段是 complete 且「挂/摘」在注册时定死 —— 这里按当前文本重新决定。
   * 未活跃会话不必处理：它下次创建时 installScopedDiscipline 会按当时文件重新判定。
   */
  const syncSessionSystem = (id: string): void => {
    const agent = agentsRef?.get(id) ?? null
    if (agent === null || agent === undefined) return
    dropSessionSystem(id)
    if (sessionSystemTextFor(root, id).trim().length === 0) {
      audit(root, { kind: 'session-system-cleared', session: id })
      return
    }
    try {
      // #决策 2026-10-19 P1：注销句柄不得依赖宿主返回值。
      // 主句柄＝段级 dispose（section() 的返回值，不依赖 inject 返回什么）；次句柄＝fiber.dispose（若存在，
      // 顺手清掉这条只含 system 段的空 fiber）。只认 fiber 的话，宿主 inject 返回 undefined 时清空就摘不掉段，
      // text() 会回落 lastNonEmpty ⇒ 用户清空后模型继续收到旧文本（P0 症状复发）。
      let sectionDispose: (() => void) | null = null
      const fiber = registerSessionSystemForAgent(agent, root, id, (d) => {
        sectionDispose = d
      })
      const fiberDispose = (fiber as { dispose?: unknown })?.dispose
      const hasFiberDispose = typeof fiberDispose === 'function'
      const hasSectionDispose = typeof sectionDispose === 'function'
      if (hasSectionDispose || hasFiberDispose) {
        sessionSystemFibers.set(id, () => {
          // 先摘段（主路径），再收空 fiber；两个各自兜错，任一失败不影响另一个。
          // 段级句柄在注销时按引用再读一次：宿主若异步回调 section 注册，也能拿到迟到的句柄。
          if (typeof sectionDispose === 'function') {
            try {
              sectionDispose()
            } catch (e) {
              console.warn('[dsh-custom] 会话 system 段注销失败（段级句柄）：', String((e as { message?: unknown })?.message ?? e))
            }
          }
          if (hasFiberDispose) {
            try {
              void (fiber as { dispose: () => unknown }).dispose()
            } catch (e) {
              console.warn('[dsh-custom] 会话 system 段清理失败（fiber 句柄）：', String((e as { message?: unknown })?.message ?? e))
            }
          }
        })
      } else {
        // 段级与 fiber 句柄都拿不到＝真正的风险场景：段会常驻，下次保存可能叠加同名 complete 段
        console.warn('[dsh-custom] 会话 system 段已注册但段级/fiber 句柄都拿不到（下次保存可能叠加同名段）')
      }
      audit(root, { kind: 'session-system-applied', session: id })
      // #决策 2026-10-19 D6：全局深改同时开着时，会话级 complete 段会遮蔽全局接管段（同名段作用域遮蔽），
      // 留一条痕便于实机取证「为什么看到的是会话文本而不是全局接管文本」。
      if (readInjectSettings(root).overrideEnabled && readOverride(root).text.trim().length > 0) {
        audit(root, { kind: 'session-system-shadows-global', session: id })
      }
    } catch (e) {
      console.warn('[dsh-custom] 会话 system 段重注册失败：', String((e as { message?: unknown })?.message ?? e))
    }
  }
  ctx.inject(['agents'], (agentsCtx: any) => {
    agentsRef = agentsCtx.agents
    for (const agent of agentsCtx.agents.list()) installScopedDiscipline(agent)
    agentsCtx.on('agent/created', ({ agent }: { agent: unknown }) => installScopedDiscipline(agent))
    agentsCtx.on('agent/disposed', ({ agent }: { agent: unknown }) => {
      dropSessionSystem(String((agent as { id?: unknown })?.id ?? ''))
      const fiber = scopedDisciplineFibers.get(agent)
      if (fiber === undefined) return
      scopedDisciplineFibers.delete(agent)
      Promise.resolve((fiber as { dispose: () => unknown }).dispose()).catch((e: unknown) => {
        console.warn('[dsh-custom] 作用域纪律段清理失败：', String((e as { message?: unknown })?.message ?? e))
      })
    })
  })

  const rendererLoader = makeRendererLoader(ctx, root)

  ctx.inject(['webServer'], (scoped: any) => {
    const api = makeApi(root, () => service, stats, rendererLoader, syncOverride, agentsView, syncSessionSystem, bootState)
    scoped.effect(
      () => scoped.webServer.register({ kind: 'prefix', path: '/api/dsh-custom', handler: api }),
      'dsh-custom: api routes',
    )
    audit(root, { kind: 'api-mounted', path: '/api/dsh-custom' })
    console.log('[dsh-custom] 数据面已挂载：/api/dsh-custom/{assembly,status}')
  })

  const dispose = ctx.on(
    'tools/pre-execute',
    async (exec: { name?: string; arguments?: unknown }, next: () => Promise<unknown>) => {
      const d = guardDecision(exec?.name ?? '', exec?.arguments, root)
      if (d.action === 'deny') {
        stats.denied++
        audit(root, { kind: 'guard-deny', tool: exec?.name, reason: 'P0 保守子集：模型写存储' })
        console.log(`[dsh-custom] 护栏拦截：${exec?.name}`)
        return { kind: 'deny', reason: d.reason }
      }
      if (d.touches) {
        stats.touched++
        audit(root, { kind: 'storage-touch', tool: exec?.name })
      }
      return next()
    },
  )
  return dispose
}
