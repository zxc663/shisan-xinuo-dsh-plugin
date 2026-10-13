// 生成器单测（B3b）：大小写折叠差分 / 上游护栏镜像 / 映射序与计数 / YAML 形状 / --check CLI / 坏规则 fail loud。
// 运行：node tests/gen-permission-rules.test.mjs
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { foldAsciiCase, assertSafeRegexStructure, generateRulesYaml, buildRulePlan } from '../scripts/gen-permission-rules.mjs'
import { flattenCorpus } from './rule-corpus.mjs'

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const TD = join(REPO, 'tmp', 'gen-rules-test')
const rulesJson = JSON.parse(readFileSync(join(REPO, 'content', 'rules.json'), 'utf8'))

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) {
    pass++
    cases.push(`PASS ${name}`)
  } else {
    fail++
    cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`)
  }
}

// ── 1 折叠差分：全语料（含大小写变体）× 全部模式，原式（i）与折叠式（无标志）判定必须一致 ──
{
  const entries = [...rulesJson.l3Domains, ...rulesJson.readonlyExempts]
  const variants = []
  for (const { cmd } of flattenCorpus()) {
    variants.push(cmd, cmd.toUpperCase())
  }
  let mismatches = 0
  let compileErrors = 0
  for (const entry of entries) {
    const flags = entry.flags ?? 'i'
    const folded = foldAsciiCase(entry.pattern)
    let reOrig
    let reFolded
    try {
      reOrig = new RegExp(entry.pattern, flags)
      reFolded = new RegExp(folded, flags.replace('i', ''))
    } catch {
      compileErrors++
      continue
    }
    for (const v of variants) {
      if (reOrig.test(v) !== reFolded.test(v)) {
        mismatches++
        if (mismatches <= 3) console.log('FOLD-MISMATCH:', JSON.stringify(entry.pattern.slice(0, 60)), 'vs', JSON.stringify(v.slice(0, 60)))
      }
    }
  }
  t('fold: 全部模式编译成功', 0, compileErrors)
  t(`fold: 差分 0 不一致（${entries.length} 模式 × ${variants.length} 变体）`, 0, mismatches)
  t('fold: 字母→成对类', '[rR][mM]', foldAsciiCase('rm'))
  t('fold: 字符类区间展开', '[a-zA-Z]', foldAsciiCase('[a-z]'))
  t('fold: 字符类单字母成对', '[aAbB]', foldAsciiCase('[ab]'))
  t('fold: 转义序列保留', '(?<![\\-\\w])x\\d', foldAsciiCase('(?<![\\-\\w])x\\d').replace('[xX]', 'x'))
  t('fold: 折叠结果可编译（u）', true, entries.every((e) => { try { new RegExp(foldAsciiCase(e.pattern), 'u'); return true } catch { return false } }))
}

// ── 2 上游护栏镜像：拒已知坏形态；放行现行全部模式 ──
{
  const rejects = (p) => {
    try {
      assertSafeRegexStructure(p)
      return false
    } catch {
      return true
    }
  }
  t('guard: (a+)+ 被拒', true, rejects('(a+)+'))
  t('guard: (a|aa)+ 被拒', true, rejects('(a|aa)+'))
  t('guard: 旧形态 rm\\s+(?:-\\S+\\s+)*\\S 被拒（简改动机实证）', true, rejects('rm\\s+(?:-\\S+\\s+)*\\S'))
  t('guard: 旧形态 (?:-\\w+\\s+)* 被拒', true, rejects('(?:-\\w+\\s+)*["\']'))
  t('guard: 独立量词链放行（\\d+）', false, rejects('\\d+\\.\\d+\\.\\d+'))
  t('guard: 仿行锚定组放行（^|\\s）', false, rejects('(?:^|\\s)-n(?:\\s|$)'))
  const allSafe = [...rulesJson.l3Domains, ...rulesJson.readonlyExempts].every((e) => !rejects(foldAsciiCase(e.pattern)))
  t('guard: 现行全部模式（折叠后）放行', true, allSafe)
}

// ── 3 规则计划：序与计数（不可豁免域 ask → 豁免 allow → 其余域 ask）──
{
  const plan = buildRulePlan(rulesJson)
  t('plan: 不可豁免 ask=2', 2, plan.noExemptAsks.length)
  t('plan: 不可豁免域=编码执行/解码执行', ['编码执行', '解码执行'], plan.noExemptAsks.map((d) => d.domain))
  t('plan: 豁免 allow=8', 8, plan.exemptionAllows.length)
  t('plan: 其余域 ask=9', 9, plan.normalAsks.length)
  t('plan: 总数=19', 19, plan.total)
}

// ── 4 生成物：确定性 / 头部 provenance / 规则序 / 可编译 / 可解析为 JSON 字符串 ──
{
  const y1 = generateRulesYaml(rulesJson, { sourcePath: 'content/rules.json', sourceHash: 'deadbeefdeadbeef' })
  const y2 = generateRulesYaml(rulesJson, { sourcePath: 'content/rules.json', sourceHash: 'deadbeefdeadbeef' })
  t('yaml: 确定性（两次生成逐字节一致）', true, y1 === y2)
  t('yaml: 头部含 provenance（生成器/上游/版本）', true,
    y1.includes('gen-permission-rules.mjs') && y1.includes('PerryLink/dsh-permission-rules') && y1.includes('v0.7.15'))
  t('yaml: 头部含来源哈希', true, y1.includes('sha256=deadbeefdeadbeef'))
  t('yaml: 头部声明 patternMode: regex 依赖', true, y1.includes('patternMode: regex'))
  const ruleBlocks = y1.split('  - match: ').slice(1)
  t('yaml: 规则数=19', 19, ruleBlocks.length)
  const actions = ruleBlocks.map((b) => (/action: (\w+)/.exec(b) ?? [])[1])
  t('yaml: 规则序=2 ask → 8 allow → 9 ask', true,
    JSON.stringify(actions) === JSON.stringify([...Array(2).fill('ask'), ...Array(8).fill('allow'), ...Array(9).fill('ask')]))
  let compileOk = 0
  for (const b of ruleBlocks) {
    const m = /command: ("(?:[^"\\]|\\.)*")/.exec(b)
    if (!m) continue
    const pattern = JSON.parse(m[1])
    try {
      new RegExp(pattern, 'u')
      compileOk++
    } catch {
      /* 计数不通过 */
    }
  }
  t('yaml: 全部 command 模式可编译（u）', 19, compileOk)
  const allFolded = [...rulesJson.l3Domains, ...rulesJson.readonlyExempts].every((e) => y1.includes(JSON.stringify(foldAsciiCase(e.pattern))))
  t('yaml: 每条模式均为折叠形态', true, allFolded)
  t('yaml: 抽查 rm 子句为折叠形态（JSON 转义后）', true, y1.includes('[rR][mM]\\\\s+\\\\S'))
}

// ── 5 CLI：--out / --check（一致=0；改动=1）+ 坏规则 fail loud（exit 2）──
{
  rmSync(TD, { recursive: true, force: true })
  mkdirSync(TD, { recursive: true })
  const script = join(REPO, 'scripts', 'gen-permission-rules.mjs')
  const outFile = join(TD, 'rules.yaml')
  const r1 = spawnSync(process.execPath, [script, '--out', outFile], { cwd: REPO, encoding: 'utf8' })
  t('cli: --out 生成成功（exit 0）', 0, r1.status)
  const r2 = spawnSync(process.execPath, [script, '--check', outFile], { cwd: REPO, encoding: 'utf8' })
  t('cli: --check 一致（exit 0）', 0, r2.status)
  appendFileSync(outFile, '\n# drift\n')
  const r3 = spawnSync(process.execPath, [script, '--check', outFile], { cwd: REPO, encoding: 'utf8' })
  t('cli: --check 不一致（exit 1）', 1, r3.status)
  const badRules = join(TD, 'bad-rules.json')
  writeFileSync(badRules, JSON.stringify({ version: 1, l3Domains: [{ domain: '坏域', pattern: '(?:-\\S+\\s+)*x' }] }))
  const r4 = spawnSync(process.execPath, [script, '--rules', badRules, '--out', join(TD, 'bad.yaml')], { cwd: REPO, encoding: 'utf8' })
  t('cli: 坏模式 fail loud（exit 2）', 2, r4.status)
  t('cli: 坏模式报错提及护栏', true, String(r4.stderr).includes('护栏'))
  rmSync(TD, { recursive: true, force: true })
}

console.log(cases.join('\n'))
console.log(`\n=== gen-permission-rules.test: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
