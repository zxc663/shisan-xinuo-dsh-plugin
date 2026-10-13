// v0.3 Config 化单测——规则包结构校验/fail-closed/行为可重复验证（改 rules→行为变，非仅文件变）/内置-外置等价。
// 运行：node tests/config-rules.test.mjs
import { compileRules, loadRulesFile, judgeL3With, judgeL3, CORE_DISCIPLINE, planGate } from '../src/shisan-xinuo-core.ts'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
// 语料单源=tests/rule-corpus.mjs（与跨引擎回归共用）
import { CONFIG_CORPUS as corpus, CONFIG_CONTENT_EXCEPTIONS as contentExceptions } from './rule-corpus.mjs'

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const TD = join(REPO, 'tmp', 'config-test')

let pass = 0, fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

rmSync(TD, { recursive: true, force: true })
mkdirSync(TD, { recursive: true })
const wf = (name, obj) => { const f = join(TD, name); writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f }

// ── 1 结构校验 ──
{
  const { patterns, errors } = compileRules({ version: 1, l3Domains: [{ domain: '自定义域', pattern: 'deploy-to-prod' }] })
  t('compile: 合法定义编译成功', 1, patterns.length)
  t('compile: 无错误', 0, errors.length)
  t('compile: 默认 flags=i', 'i', patterns[0].re.flags)
  t('compile: 默认 noExempt=false', false, patterns[0].noExempt)
}
{
  const { patterns, errors } = compileRules({ version: 1, l3Domains: [
    { domain: '好域', pattern: 'abc' },
    { domain: '坏正则', pattern: '(' },
    { domain: '', pattern: 'x' },
    { domain: '坏flags', pattern: 'x', flags: 'gi' },
  ] })
  t('compile: 坏正则条目跳过', 1, patterns.length)
  t('compile: 坏条目记 3 错', 3, errors.length)
}
t('compile: l3Domains 空=无效', true, compileRules({ version: 1, l3Domains: [] }).errors.some((e) => e.includes('非空数组')))
t('compile: 缺 l3Domains=无效', true, compileRules({ version: 1 }).errors.length > 0)
t('compile: 根非对象=无效', true, compileRules('nope').errors.length > 0)
t('compile: version=2 记错', true, compileRules({ version: 2, l3Domains: [{ domain: 'x', pattern: 'y' }] }).errors.some((e) => e.includes('version')))

// ── 2 fail-closed 装载 ──
{
  const r = loadRulesFile(join(TD, 'missing.json'))
  // 审计后修订：内置默认条目数随版本增长（9→11），断言改为"≥9 且走了回退"（防再被计数漂移误伤）
  t('load: 文件缺失→内置默认', true, r.valid === false && r.domains >= 9 && r.reason === '文件不存在')
}
{
  const r = loadRulesFile(wf('bad.json', '{not json'))
  t('load: 坏 JSON→内置默认', true, r.valid === false && r.reason.includes('JSON'))
}
{
  const r = loadRulesFile(wf('empty-domains.json', { version: 1, l3Domains: [] }))
  t('load: 空域表→内置默认（防护不静默解除）', true, r.valid === false)
  t('load: 回退后 rm -rf 仍拦', '数据删除', judgeL3With(r.rules, 'rm -rf /x'))
}
{
  const r = loadRulesFile(wf('valid.json', { version: 1, l3Domains: [{ domain: '部署红线', pattern: 'deploy-to-prod' }] }))
  t('load: 有效文件装载', true, r.valid && r.domains === 1)
}

// ── 3 行为可重复验证（Config 面真改行为，非仅文件变）──
{
  const custom = compileRules({ version: 1, l3Domains: [{ domain: '部署红线', pattern: 'deploy-to-prod' }] })
  const rules = { patterns: custom.patterns, exempts: [] }
  t('behavior: 自定义域拦新命令', '部署红线', judgeL3With(rules, 'deploy-to-prod --go live'))
  t('behavior: 内置默认不拦同命令', null, judgeL3('deploy-to-prod --go live'))
  t('behavior: 自定义规则下 rm 不再拦（删域生效）', null, judgeL3With(rules, 'rm -rf /x'))
  t('behavior: planGate 跟随注入 judge', 'refuse', planGate('deploy-to-prod --go', (c) => judgeL3With(rules, c)).action)
}
{
  // noExempt 域：豁免不适用
  const custom = compileRules({ version: 1, l3Domains: [{ domain: '危险X', pattern: 'danger-op', noExempt: true }], readonlyExempts: [{ pattern: '--dry-run' }] })
  const rules = { patterns: custom.patterns, exempts: custom.exempts }
  t('behavior: noExempt 域不吃豁免', '危险X', judgeL3With(rules, 'danger-op --dry-run'))
  // 可豁免域：豁免命中放行
  const custom2 = compileRules({ version: 1, l3Domains: [{ domain: '危险Y', pattern: 'danger-op' }], readonlyExempts: [{ pattern: '--dry-run' }] })
  const rules2 = { patterns: custom2.patterns, exempts: custom2.exempts }
  t('behavior: 可豁免域吃豁免', null, judgeL3With(rules2, 'danger-op --dry-run'))
}

// ── 4 随仓 content 与内置默认等价（镜像漂移防线）──
{
  const repoRules = loadRulesFile(join(REPO, 'content', 'rules.json'))
  t('repo: content/rules.json 装载有效', true, repoRules.valid)
  let mismatches = 0
  for (const [cmd, expect] of corpus) {
    if (judgeL3(cmd) !== expect) mismatches++
    if (!contentExceptions.has(cmd) && judgeL3With(repoRules.rules, cmd) !== expect) mismatches++
  }
  t('repo: content 与内置默认在 37 例语料上判定一致', 0, mismatches)
  t('repo: content 路径 dry-run（无豁免）拦 rm', '数据删除', judgeL3With(repoRules.rules, 'rm -rf /var --dry-run'))
  const disciplineContent = readFileSync(join(REPO, 'content', 'discipline.md'), 'utf8')
  t('repo: discipline.md 与 CORE_DISCIPLINE 逐字镜像', true, disciplineContent.trim() === CORE_DISCIPLINE.trim())
}

console.log(cases.join('\n'))
console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
