#!/usr/bin/env node
/**
 * B3b 全量语义回归：我方 content 判定（judgeL3With）与上游引擎（dsh-permission-rules）
 * 在「生成文件」上的首命中裁决逐条对照（离线导入上游导出面：parseRulesDocument/compileRules/matchRules，无需起真机）。
 *
 * 用法：
 *   node scripts/regression-permission-rules.mjs                     # 引擎默认取 permtest 档安装位（本机）
 *   node scripts/regression-permission-rules.mjs --engine <包目录>    # 显式指定 dsh-permission-rules 安装目录
 *   node scripts/regression-permission-rules.mjs --json <out.json>   # 落盘明细（报告引用）
 *   --require-engine                                                 # 找不到引擎时 exit 2（默认 SKIP exit 0，CI 友好）
 * 环境变量 SHISANUO_PERMISSION_RULES_DIR 作为引擎路径兜底（与 e1-run 的 SHISANUO_* 口径一致）。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { generateRulesYaml } from './gen-permission-rules.mjs'
import { loadRulesFile, judgeL3With } from '../src/shisan-xinuo-core.ts'
import { flattenCorpus, BUILTIN_ONLY_EXPECT } from '../tests/rule-corpus.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const get = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const engineDir = resolve(
  get('--engine') ?? process.env.SHISANUO_PERMISSION_RULES_DIR ?? 'D:/ai本地模型/dsh/headless-home/profiles/permtest/node_modules/dsh-permission-rules',
)
const engineEntry = join(engineDir, 'lib', 'index.js')
if (!existsSync(engineEntry)) {
  const msg = `SKIP：未找到上游引擎 dsh-permission-rules（查找 ${engineEntry}）`
  if (args.includes('--require-engine')) {
    console.error(`${msg}（--require-engine 强制要求）`)
    process.exit(2)
  }
  console.log(msg)
  console.log('提示：用 --engine <包目录> 或环境变量 SHISANUO_PERMISSION_RULES_DIR 指定安装位后重跑。')
  process.exit(0)
}
const engine = await import(pathToFileURL(engineEntry).href)
const { parseRulesDocument, compileRules, matchRules } = engine

const rulesPath = join(REPO, 'content', 'rules.json')
const rulesJson = JSON.parse(readFileSync(rulesPath, 'utf8'))
const yaml = generateRulesYaml(rulesJson, { sourcePath: 'content/rules.json' })
const doc = parseRulesDocument(yaml)
const ruleset = compileRules(doc, { patternMode: 'regex', maxRules: 256, maxGlobStars: 2, caseInsensitivePaths: true })
const ours = loadRulesFile(rulesPath).rules

const WORKSPACE = 'D:/tmp/b3b'

function upstreamVerdict(cmd) {
  const hit = matchRules(ruleset, 'pwsh', { command: cmd }, WORKSPACE, { platform: 'win32', env: {}, agents: ['main'] })
  if (!hit || hit.rule.action === 'allow') return { blocked: false, action: hit ? hit.rule.action : null, domain: null }
  const tags = hit.rule.tags ?? []
  const domain = tags[1] === 'l3-domain' && typeof tags[2] === 'string' ? tags[2] : null
  return { blocked: true, action: hit.rule.action, domain }
}

const cases = flattenCorpus()
const mismatches = []
const domainMismatches = []
const annotationMismatches = []
const suiteStats = {}
let oursBlocked = 0
let upBlocked = 0

for (const c of cases) {
  const oursDomain = judgeL3With(ours, c.cmd) // string | null
  const up = upstreamVerdict(c.cmd)
  const stat = (suiteStats[c.suite] ??= { total: 0, oursBlocked: 0, upBlocked: 0 })
  stat.total++
  if (oursDomain !== null) {
    oursBlocked++
    stat.oursBlocked++
  }
  if (up.blocked) {
    upBlocked++
    stat.upBlocked++
  }
  if ((oursDomain !== null) !== up.blocked) {
    mismatches.push({ suite: c.suite, cmd: c.cmd, ours: oursDomain, upstream: up })
  } else if (oursDomain !== null && up.domain !== null && oursDomain !== up.domain) {
    domainMismatches.push({ suite: c.suite, cmd: c.cmd, ours: oursDomain, upstream: up.domain })
  }
  if (!BUILTIN_ONLY_EXPECT.has(c.cmd)) {
    const ok =
      c.expect === true
        ? oursDomain !== null
        : c.expect === false
          ? oursDomain === null
          : c.expect === null
            ? oursDomain === null
            : oursDomain === c.expect
    if (!ok) annotationMismatches.push({ suite: c.suite, cmd: c.cmd, expect: c.expect, ours: oursDomain })
  }
}

console.log('=== B3b 语义回归：我方 content 判定 vs 上游引擎（生成文件 · patternMode=regex）===')
console.log(`引擎：${engineDir}`)
console.log(`用例：${cases.length}（${Object.keys(suiteStats).join(' / ')}）`)
console.log(`我方拦截 ${oursBlocked} 例｜上游拦截 ${upBlocked} 例`)
for (const [suite, s] of Object.entries(suiteStats)) {
  console.log(`  ${suite}: ${s.total} 例（我方拦 ${s.oursBlocked} / 上游拦 ${s.upBlocked}）`)
}
console.log(`阻断判定不一致：${mismatches.length}`)
for (const m of mismatches.slice(0, 20)) console.log(`  MISMATCH [${m.suite}] ${JSON.stringify(m.cmd.slice(0, 70))} ours=${m.ours} upstream=${JSON.stringify(m.upstream)}`)
console.log(`域不一致（双方均拦截时）：${domainMismatches.length}`)
for (const m of domainMismatches.slice(0, 20)) console.log(`  DOMAIN [${m.suite}] ${JSON.stringify(m.cmd.slice(0, 70))} ours=${m.ours} upstream=${m.upstream}`)
console.log(`注解自检（除 BUILTIN_ONLY ${BUILTIN_ONLY_EXPECT.size} 例）：不一致 ${annotationMismatches.length}`)
for (const m of annotationMismatches.slice(0, 20)) console.log(`  ANNOT [${m.suite}] ${JSON.stringify(m.cmd.slice(0, 70))} expect=${JSON.stringify(m.expect)} ours=${m.ours}`)
const pass = mismatches.length === 0 && domainMismatches.length === 0 && annotationMismatches.length === 0
console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`)

const jsonOut = get('--json')
if (jsonOut) {
  writeFileSync(
    resolve(jsonOut),
    JSON.stringify({ engine: engineDir, total: cases.length, oursBlocked, upBlocked, suiteStats, mismatches, domainMismatches, annotationMismatches }, null, 2),
    'utf8',
  )
  console.log(`明细已落盘：${resolve(jsonOut)}`)
}
process.exit(pass ? 0 : 1)
