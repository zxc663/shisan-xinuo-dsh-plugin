// 收尾批回归（P1-10 幂等）：内容未变 → 不重写、不建快照、不碰 mtime；审计留 save-noop；
// 会话分段逐段去重（只写变化段）；API 级 PUT 重复提交同样被跳过。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  apply,
  backupDetail,
  deleteLayeredSection,
  ensureStorage,
  listLayered,
  mtimeOfFileOrNull,
  readLayeredSection,
  restoreBackup,
  saveDiscipline,
  saveLayeredSection,
  saveUserPrompt,
  sessionDir,
  snapshot,
  snapshotExport,
  toggleLayeredSection,
  writeSessionOverride,
  readSessionOverride,
} from '../src/dsh-custom.ts'

let pass = 0
let fail = 0
const lines = []
function t(name, expect, actual) {
  const e = JSON.stringify(expect)
  const a = JSON.stringify(actual)
  if (e === a) {
    pass++
    lines.push(`PASS ${name}`)
  } else {
    fail++
    lines.push(`FAIL ${name}\n  expect=${e}\n  actual=${a}`)
  }
}

function callApi(api, method, url, body) {
  return new Promise((done) => {
    const payload = JSON.stringify(body ?? {})
    const req = {
      method,
      url,
      on: (ev, cb) => {
        if (ev === 'data') setTimeout(() => cb(Buffer.from(payload)), 0)
        else if (ev === 'end') setTimeout(() => cb(), 3)
      },
    }
    const res = {
      code: 0,
      writeHead(c) { this.code = c },
      end(b) { done({ code: this.code, body: JSON.parse(String(b)) }) },
    }
    api(req, res)
  })
}

function bootHost() {
  const home = mkdtempSync(join(tmpdir(), 'dshc-p49-'))
  const prevHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const sections = []
  const scope = {
    sections,
    systemPrompt: {
      section(cfg) { sections.push(cfg); return () => {} },
      assemble: async () => ({ variables: {} }), // override 干跑校验用（无 renderer 走解析级检查）
    },
    effect(fn) { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } },
    fiber(cb) { cb(scope); return { dispose() {} } },
  }
  const agentsApi = { list: () => [], get: () => null, on: () => () => {} }
  const routes = []
  const ctx = {
    effect(fn) { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } },
    inject(svcs, cb) {
      const name = svcs[0]
      if (name === 'systemPrompt') { cb(scope); return { dispose() {} } }
      if (name === 'agents') { cb({ agents: agentsApi, on: () => () => {} }); return { dispose() {} } }
      if (name === 'webServer') {
        cb({ webServer: { register: (route) => { routes.push(route); return () => {} } }, effect: (fn) => { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } } })
        return { dispose() {} }
      }
      return { dispose() {} }
    },
    on: () => () => {},
  }
  const origLog = console.log
  console.log = () => {}
  try { apply(ctx) } finally { console.log = origLog }
  return {
    root: join(home, 'dsh-custom'),
    api: routes[0].handler,
    restore() {
      if (prevHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = prevHome
      rmSync(home, { recursive: true, force: true })
    },
  }
}

const snapCount = (root) => {
  try { return readdirSync(join(root, 'backups')).filter((n) => /^\d{4}-\d{2}-\d{2}T/.test(n)).length } catch { return 0 }
}
const noopCount = (root) => {
  try { return readFileSync(join(root, 'audit.jsonl'), 'utf8').split('\n').filter((l) => l.includes('"save-noop"')).length } catch { return 0 }
}

// ══════════════════════════════════════════════════════════════════
// 1. 函数级：saveDiscipline / saveUserPrompt 去重
// ══════════════════════════════════════════════════════════════════
{
  const root = mkdtempSync(join(tmpdir(), 'dshc-p49-fn-'))
  try {
    ensureStorage(root)
    saveDiscipline(root, '纪律A')
    const n1 = snapCount(root)
    const m1 = mtimeOfFileOrNull(join(root, 'discipline.md'))
    saveDiscipline(root, '纪律A')
    t('discipline: 同内容第二次保存不建快照', n1, snapCount(root))
    t('discipline: mtime 未被触碰', m1, mtimeOfFileOrNull(join(root, 'discipline.md')))
    t('discipline: 有 save-noop 留痕', 1, noopCount(root))
    saveDiscipline(root, '纪律B')
    t('discipline: 内容变化正常建快照', n1 + 1, snapCount(root))

    saveUserPrompt(root, '提示词U', true)
    const n2 = snapCount(root)
    saveUserPrompt(root, '提示词U', true)
    t('user-prompt: 内容与开关均同 → 不建快照', n2, snapCount(root))
    saveUserPrompt(root, '提示词U', false)
    t('user-prompt: 仅开关变化 → 建快照（真实变更）', n2 + 1, snapCount(root))

    // 会话分段逐段去重
    const id = 'session-dedup'
    const r1 = writeSessionOverride(root, id, { discipline: 'D1', user: 'U1' })
    t('会话: 首写 written=两段', ['discipline', 'user'], r1.written.slice().sort())
    t('会话: 首写无旧状态 → 无快照（无可保护对象）', null, r1.snapshot)
    const r2 = writeSessionOverride(root, id, { discipline: 'D1' })
    t('会话: 同内容重写 written=[]', [], r2.written)
    t('会话: 同内容重写 snapshot=null', null, r2.snapshot)
    const r3 = writeSessionOverride(root, id, { discipline: 'D1', user: 'U2' })
    t('会话: 仅变化段写入（user）', ['user'], r3.written)
    t('会话: 变更时有旧状态 → 建快照', true, typeof r3.snapshot === 'string')
    const r4 = writeSessionOverride(root, id, { discipline: '' })
    t('会话: 清空变化段正常删除', ['discipline'], r4.written)
    t('会话: 删除后文件不存在', null, readSessionOverride(root, id).discipline)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// 2. API 级：PUT 重复提交被跳过（discipline / override）
// ══════════════════════════════════════════════════════════════════
{
  const host = bootHost()
  try {
    const p1 = await callApi(host.api, 'PUT', '/api/dsh-custom/discipline', { text: 'API纪律' })
    t('API discipline: 首写 200', 200, p1.code)
    const n1 = snapCount(host.root)
    const p2 = await callApi(host.api, 'PUT', '/api/dsh-custom/discipline', { text: 'API纪律' })
    t('API discipline: 重复写 200', 200, p2.code)
    t('API discipline: 不建快照', n1, snapCount(host.root))
    t('API discipline: save-noop 留痕', 1, noopCount(host.root))

    const o1 = await callApi(host.api, 'PUT', '/api/dsh-custom/override', { text: 'OV-DEDUP' })
    t('API override: 首写 200', 200, o1.code)
    const n2 = snapCount(host.root)
    const o2 = await callApi(host.api, 'PUT', '/api/dsh-custom/override', { text: 'OV-DEDUP' })
    t('API override: 重复写 200', 200, o2.code)
    t('API override: 响应带 skipped 标记', true, o2.body.skipped === true)
    t('API override: 不建快照', n2, snapCount(host.root))
    t('API override: save-noop 留痕', 2, noopCount(host.root))
  } finally {
    host.restore()
  }
}

// ══════════════════════════════════════════════════════════════════
// 3. P1-7 免迁移硬化：非规范 id 目录名加短哈希（防 a/b 与 ab 撞车）；规范 id 目录名不变
// ══════════════════════════════════════════════════════════════════
{
  const root = mkdtempSync(join(tmpdir(), 'dshc-p49-p17-'))
  try {
    ensureStorage(root)
    const d1 = sessionDir(root, 'a/b')
    const d2 = sessionDir(root, 'ab')
    t('P1-7: a/b 与 ab 不再撞车', true, d1 !== d2)
    t('P1-7: 同 id 确定性稳定', d1, sessionDir(root, 'a/b'))
    t('P1-7: 非规范 id 落 -x 短哈希后缀', true, /-x[0-9a-f]{8}$/.test(d1))
    t('P1-7: 规范 id 目录名不变（零迁移）', join(root, 'sessions', 'session-abc'), sessionDir(root, 'session-abc'))
    writeSessionOverride(root, 'a/b', { discipline: 'X' })
    t('P1-7: 非规范 id 读写闭环', 'X', readSessionOverride(root, 'a/b').discipline)
    t('P1-7: 净化撞名 id 互不影响', null, readSessionOverride(root, 'ab').discipline)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// 4. 备份完整性（2026-10-19）：layered 内容与启停表随快照；恢复对称；旧格式兼容
// ══════════════════════════════════════════════════════════════════
{
  const root = mkdtempSync(join(tmpdir(), 'dshc-p49-layered-backup-'))
  try {
    ensureStorage(root)
    saveLayeredSection(root, 'my-sec.md', '自建v1')
    saveLayeredSection(root, 'goal-mode.md', '改写出厂A')
    toggleLayeredSection(root, 'goal-mode.md', false)
    const snap = snapshot(root, 'test-layered-backup')
    t('备份: 快照含自建分节', '自建v1', readFileSync(join(snap, 'layered', 'my-sec.md'), 'utf8'))
    t('备份: 快照含出厂改写', '改写出厂A', readFileSync(join(snap, 'layered', 'goal-mode.md'), 'utf8'))
    const st0 = JSON.parse(readFileSync(join(snap, 'layered-state.json'), 'utf8'))
    t('备份: 快照含启停表且记停用', false, st0.enabled['goal-mode.md'])

    // 变更：改写 → 删除 → 重新启用
    saveLayeredSection(root, 'my-sec.md', '自建v2')
    deleteLayeredSection(root, 'my-sec.md')
    toggleLayeredSection(root, 'goal-mode.md', true)
    t('变更后: 自建已删', null, readLayeredSection(root, 'my-sec.md'))
    t('变更后: goal-mode 已启用', true, listLayered(root).sections.find((s) => s.name === 'goal-mode.md').enabled)

    const rb = restoreBackup(root, basename(snap))
    t('恢复: 自建分节回来了', '自建v1', readLayeredSection(root, 'my-sec.md')?.text)
    t('恢复: 出厂改写回 A', '改写出厂A', readLayeredSection(root, 'goal-mode.md')?.text)
    t('恢复: 启停表回停用', false, listLayered(root).sections.find((s) => s.name === 'goal-mode.md').enabled)
    t('恢复: restored 含 layered 键', true, rb.restored.some((r) => r.startsWith('layered/')))

    const detail = backupDetail(root, basename(snap))
    t('详情: 列出 layered 分节', true, detail.files.some((f) => f.file === 'layered/my-sec.md'))
    const exp = snapshotExport(root, basename(snap))
    t('导出: 含 layered 分节内容', '自建v1', exp.files['layered/my-sec.md'])

    // 旧格式兼容：手工造无 layered/ 的快照 → 恢复不炸、不动现层
    const legacyName = '2026-01-01T00-00-00-000'
    mkdirSync(join(root, 'backups', legacyName), { recursive: true })
    writeFileSync(join(root, 'backups', legacyName, 'discipline.md'), '旧格式纪律', 'utf8')
    const rb2 = restoreBackup(root, legacyName)
    t('旧格式: 只恢复根文件', ['discipline.md'], rb2.restored)
    t('旧格式: 现有 layered 未被动', '自建v1', readLayeredSection(root, 'my-sec.md')?.text)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

console.log(lines.join('\n'))
console.log(`\n=== p49-final-batch: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)