#!/usr/bin/env node
/**
 * 十三希诺 → dsh-permission-rules 规则生成器（B3b · 拦截换芯）
 *
 * 把 content/rules.json（我方唯一规则源）译为上游引擎可执行的 `.dsh/rules.yaml`。
 * 三个工艺要点：
 *  1) 上游 regex 模式编译为 `new RegExp(source, 'u')`——**没有 `i` 标志**；
 *     生成时对模式做 ASCII 大小写折叠（`a` → `[aA]`，字符类/区间等价展开），保住我方 flags=i 语义。
 *  2) 上游加载期有反灾难回溯（ReDoS）结构护栏：组内含无界量词、再对该组做无界量词会被拒载；
 *     生成期用镜像护栏预检（fail loud）。内容面两条旧形态已按等价形态简改（映射表见 docs/b3b-*.md）。
 *  3) 规则序（上游为首条命中生效）= 不可豁免域 ask → 只读/无害豁免 allow → 其余域 ask，
 *     复刻我方引擎「命中→查豁免；noExempt 域不查豁免」的语义。
 *
 * 用法（零依赖，CI 可跑；跨引擎实评 = scripts/regression-permission-rules.mjs）：
 *   node scripts/gen-permission-rules.mjs                  # 生成到 stdout
 *   node scripts/gen-permission-rules.mjs --out <path>     # 生成到文件
 *   node scripts/gen-permission-rules.mjs --check <path>   # 与现有文件逐字节比对（exit 1=不一致）
 *   --rules <path> 覆盖规则源（默认 <repo>/content/rules.json）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── ASCII 大小写折叠（上游 regex 模式无 flags，用显式字符类保住 flags=i 语义）──

const isAsciiLetter = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
const swapCase = (c) => (c >= 'a' && c <= 'z' ? c.toUpperCase() : c.toLowerCase())

/**
 * 把一个 JS 正则源改写为「显式大小写不敏感」的等价源（仅 ASCII 字母）。
 * 规则：转义序列整体保留（\d \S \b \. 等）；字符类内单字母成对（a → aA），
 * 字母区间展开（[a-z] → [a-zA-Z]）；其余字符原样。
 */
export function foldAsciiCase(pattern) {
  let out = ''
  let i = 0
  let inClass = false
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === '\\') {
      out += i + 1 < pattern.length ? pattern.slice(i, i + 2) : ch
      i += 2
      continue
    }
    if (!inClass) {
      if (ch === '[') {
        inClass = true
        out += ch
        i += 1
        continue
      }
      out += isAsciiLetter(ch) ? `[${ch}${swapCase(ch)}]` : ch
      i += 1
      continue
    }
    // 字符类内部
    if (ch === ']') {
      inClass = false
      out += ch
      i += 1
      continue
    }
    if (isAsciiLetter(ch) && pattern[i + 1] === '-' && isAsciiLetter(pattern[i + 2] ?? '')) {
      const end = pattern[i + 2]
      out += `${ch}-${end}${swapCase(ch)}-${swapCase(end)}`
      i += 3
      continue
    }
    out += isAsciiLetter(ch) ? `${ch}${swapCase(ch)}` : ch
    i += 1
  }
  return out
}

// ── 上游加载期 ReDoS 结构护栏的生成期预检 ──
// 逻辑镜像自 dsh-permission-rules v0.7.15（Apache-2.0）src/glob.ts#assertSafeRegexStructure；
// 权威校验仍在上游加载期与 scripts/regression-permission-rules.mjs 实跑，此处=生成即失败（fail loud）。

export function assertSafeRegexStructure(pattern) {
  const stack = []
  let i = 0
  const markUnbounded = () => {
    const top = stack[stack.length - 1]
    if (top !== undefined) top.unbounded = true
  }
  const reject = (message) => {
    throw new Error(
      `模式 ${JSON.stringify(pattern)} 被拒：${message}（上游加载期同款护栏——请改写为等价形态：去掉组内无界量词或给外层量词加上界）`,
    )
  }
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === '[') {
      i += 1
      while (i < pattern.length && pattern[i] !== ']') {
        if (pattern[i] === '\\') i += 1
        i += 1
      }
      i += 1
      continue
    }
    if (ch === '(') {
      stack.push({ start: i, unbounded: false })
      i += 1
      continue
    }
    if (ch === ')') {
      const group = stack.pop()
      if (group === undefined) {
        i += 1
        continue
      }
      const q = quantifierAt(pattern, i + 1)
      if (q !== undefined) {
        if (q.unbounded) {
          if (group.unbounded) reject(`量词 ${q.text} 套在含无界量词的组上`)
          if (hasAmbiguousAlternation(pattern, group.start + 1, i)) {
            reject(`被量化的组 ${JSON.stringify(pattern.slice(group.start, q.end + 1))} 存在重叠字面量分支`)
          }
          markUnbounded()
        }
        i = q.end + 1
        continue
      }
      if (group.unbounded) markUnbounded()
      i += 1
      continue
    }
    if (ch === '*' || ch === '+') {
      markUnbounded()
      i += 1
      continue
    }
    if (ch === '{') {
      const parsed = parseBraceQuantifier(pattern, i)
      if (parsed !== undefined) {
        if (parsed.unbounded) markUnbounded()
        i = parsed.end + 1
        continue
      }
      i += 1
      continue
    }
    i += 1
  }
}

function quantifierAt(pattern, index) {
  const ch = pattern[index]
  if (ch === '*' || ch === '+') return { text: ch, end: index, unbounded: true }
  if (ch === '?') return { text: ch, end: index, unbounded: false }
  if (ch === '{') return parseBraceQuantifier(pattern, index)
  return undefined
}

function parseBraceQuantifier(pattern, start) {
  const close = pattern.indexOf('}', start + 1)
  if (close < 0) return undefined
  const body = pattern.slice(start + 1, close)
  if (!/^\d+(,\d*)?$/.test(body)) return undefined
  const unbounded = body.includes(',') && body.endsWith(',')
  return { text: pattern.slice(start, close + 1), end: close, unbounded }
}

function hasAmbiguousAlternation(pattern, start, end) {
  const branches = []
  let depth = 0
  let branchStart = start
  let hasPipe = false
  for (let i = start; i < end; i += 1) {
    const ch = pattern[i]
    if (ch === '\\') {
      i += 1
      continue
    }
    if (ch === '[') {
      while (i < end && pattern[i] !== ']') {
        if (pattern[i] === '\\') i += 1
        i += 1
      }
      continue
    }
    if (ch === '(') {
      depth += 1
      continue
    }
    if (ch === ')') {
      depth -= 1
      continue
    }
    if (ch === '|' && depth === 0) {
      hasPipe = true
      branches.push(pattern.slice(branchStart, i))
      branchStart = i + 1
    }
  }
  if (!hasPipe) return false
  branches.push(pattern.slice(branchStart, end))
  for (let a = 0; a < branches.length; a += 1) {
    for (let b = a + 1; b < branches.length; b += 1) {
      if (literalPrefixOf(branches[a], branches[b])) return true
    }
  }
  return false
}

function literalPrefixOf(x, y) {
  const literal = /^[^*+?()|[\]{}^$.\\]+$/
  if (!literal.test(x) || !literal.test(y)) return false
  const min = Math.min(x.length, y.length)
  return x.slice(0, min) === y.slice(0, min)
}

// ── 生成 ──

/** 校验一条模式并折叠大小写；任何拒绝都抛错（生成期 fail loud，不产出坏文件）。 */
function translatePattern(pattern, flags, label) {
  if (typeof pattern !== 'string' || pattern === '') throw new Error(`${label}.pattern 非法（须为非空字符串）`)
  if (flags !== undefined) {
    if (typeof flags !== 'string' || !/^[imsu]*$/.test(flags)) throw new Error(`${label}.flags 非法（仅 imsu，禁 g）`)
    const unsupported = [...flags].filter((f) => f !== 'i')
    if (unsupported.length > 0) {
      throw new Error(
        `${label}.flags=「${flags}」含生成器不支持的标志 ${unsupported.join('')}——上游 regex 模式只能表达无标志语义；` +
          '请改用无需该标志的等价模式（如去掉行首尾锚点依赖、把 --dry-run 类位置约束写进模式本体）',
      )
    }
  }
  const folded = foldAsciiCase(pattern)
  assertSafeRegexStructure(folded)
  try {
    new RegExp(folded, 'u')
  } catch (e) {
    throw new Error(`${label} 折叠后无法编译：${String(e).slice(0, 120)}`)
  }
  return folded
}

/** 规则计划：规则序与计数（供生成与测试共用）。 */
export function buildRulePlan(rulesJson) {
  const r = rulesJson
  if (!r || typeof r !== 'object') throw new Error('规则包根不是对象')
  if (r.version !== 1) throw new Error(`规则包 version 必须为 1（实际 ${JSON.stringify(r.version)}）`)
  if (!Array.isArray(r.l3Domains) || r.l3Domains.length === 0) {
    throw new Error('l3Domains 必须是非空数组（fail-closed：拒绝生成空规则文件）')
  }
  const domains = r.l3Domains.map((d, i) => {
    if (!d || typeof d !== 'object' || typeof d.domain !== 'string' || d.domain.trim() === '') {
      throw new Error(`l3Domains[${i}].domain 非法`)
    }
    return {
      domain: d.domain,
      pattern: translatePattern(d.pattern, d.flags, `l3Domains[${i}]（${d.domain}）`),
      noExempt: d.noExempt === true,
    }
  })
  const exempts = (Array.isArray(r.readonlyExempts) ? r.readonlyExempts : []).map((e, i) => ({
    pattern: translatePattern(e?.pattern, e?.flags, `readonlyExempts[${i}]`),
  }))
  return {
    noExemptAsks: domains.filter((d) => d.noExempt),
    exemptionAllows: exempts,
    normalAsks: domains.filter((d) => !d.noExempt),
    total: domains.length + exempts.length,
  }
}

/** 生成 `.dsh/rules.yaml` 全文（确定性输出：同输入=同字节）。 */
export function generateRulesYaml(rulesJson, opts = {}) {
  const { sourcePath = 'content/rules.json', sourceHash = null } = opts
  const plan = buildRulePlan(rulesJson)
  const q = (s) => JSON.stringify(s)
  const L = []
  L.push('# yaml-language-server: $schema=https://raw.githubusercontent.com/PerryLink/dsh-permission-rules/main/docs/rules-format.schema.json')
  L.push('# 本文件由十三希诺生成器生成（scripts/gen-permission-rules.mjs）——请勿手改；改规则请改 content/rules.json 后重新生成。')
  L.push('# 引擎：dsh-permission-rules（上游：PerryLink/dsh-permission-rules · Apache-2.0 · 本项目实测 v0.7.15）')
  L.push('# 必须配合引擎配置：patternMode: regex（profile cordis 覆盖行见 docs/b3b-generator-and-semantic-regression-20261013.md）')
  L.push(`# 来源：${sourcePath}${sourceHash ? `（sha256=${sourceHash}）` : ''}`)
  L.push('# 规则序（首条命中生效）：不可豁免域 ask → 只读/无害豁免 allow → 其余域 ask——复刻我方「命中→查豁免、noExempt 域不查豁免」语义')
  L.push('rules:')
  const pushAsk = (d, noExempt) => {
    L.push(`  - match: { params: { command: ${q(d.pattern)} } }`)
    L.push('    action: ask')
    L.push(`    reason: ${q(`[十三希诺纪律] L3 危险操作命中（${d.domain}）：需要用户明确确认后才能继续。`)}`)
    L.push(`    description: ${q(`十三希诺 L3 域=${d.domain}${noExempt ? '（不可豁免）' : ''}`)}`)
    L.push(`    tags: ${JSON.stringify(['shisan-xinuo', 'l3-domain', d.domain])}`)
  }
  for (const d of plan.noExemptAsks) pushAsk(d, true)
  plan.exemptionAllows.forEach((e, idx) => {
    L.push(`  - match: { params: { command: ${q(e.pattern)} } }`)
    L.push('    action: allow')
    L.push(`    reason: ${q('[十三希诺] 只读/无害豁免命中（放行）')}`)
    L.push(`    description: ${q(`十三希诺只读/无害豁免（第 ${idx + 1} 条）`)}`)
    L.push(`    tags: ${JSON.stringify(['shisan-xinuo', 'exemption'])}`)
  })
  for (const d of plan.normalAsks) pushAsk(d, false)
  L.push('')
  return L.join('\n')
}

// ── CLI ──

function main() {
  const args = process.argv.slice(2)
  const get = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const rulesPath = resolve(get('--rules') ?? join(REPO, 'content', 'rules.json'))
  const outPath = get('--out')
  const checkPath = get('--check')
  const raw = readFileSync(rulesPath, 'utf8')
  let json
  try {
    json = JSON.parse(raw)
  } catch (e) {
    console.error(`规则包 JSON 解析失败：${rulesPath}\n${String(e)}`)
    process.exit(2)
  }
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16)
  const relPath = (() => {
    const rel = relative(REPO, rulesPath)
    return rel.startsWith('..') ? rulesPath : rel
  })()
  let yaml
  let total
  try {
    yaml = generateRulesYaml(json, { sourcePath: relPath, sourceHash: hash })
    total = buildRulePlan(json).total
  } catch (e) {
    console.error(`生成失败：${String(e instanceof Error ? e.message : e)}`)
    process.exit(2)
  }
  if (checkPath) {
    let existing = null
    try {
      existing = readFileSync(resolve(checkPath), 'utf8')
    } catch {
      existing = null
    }
    if (existing === null) {
      console.error(`--check：目标不存在或不可读：${checkPath}`)
      process.exit(1)
    }
    if (existing === yaml) {
      console.log(`--check OK：${checkPath} 与生成结果逐字节一致（${total} 条规则，${yaml.length} 字节）`)
      process.exit(0)
    }
    console.error(`--check 不一致：${checkPath}（${existing.length} 字节）≠ 生成结果（${yaml.length} 字节）——请重新生成`)
    process.exit(1)
  }
  if (outPath) {
    writeFileSync(resolve(outPath), yaml, 'utf8')
    console.log(`已生成：${resolve(outPath)}（${total} 条规则，${yaml.length} 字节）`)
    return
  }
  process.stdout.write(yaml)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
