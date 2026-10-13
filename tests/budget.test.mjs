// v0.4 T2 预算器单测——装载 fail-open/白名单补全/判级信号提取/随仓策略校验。
// 运行：node tests/budget.test.mjs
import { loadBudgetFile, completeAllowList, extractDeclaredLevel, BUDGET_ALWAYS_ALLOW } from '../src/shisan-xinuo-core.ts'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const TD = join(REPO, 'tmp', 'budget-test')

let pass = 0, fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

rmSync(TD, { recursive: true, force: true })
mkdirSync(TD, { recursive: true })
const wf = (name, obj) => { const f = join(TD, name); writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f }

// ── loadBudgetFile fail-open ──
t('load: 文件缺失→null 不裁剪', true, loadBudgetFile(join(TD, 'nope.json')).budget === null)
t('load: 坏 JSON→null', true, loadBudgetFile(wf('bad.json', '{oops')).budget === null)
t('load: version 错→null', true, loadBudgetFile(wf('v2.json', { version: 2, levels: { L1: '*' } })).budget === null)
t('load: 缺 levels→null', true, loadBudgetFile(wf('nolevels.json', { version: 1 })).budget === null)
t('load: 全部级无效（空数组）→null', true, loadBudgetFile(wf('empty.json', { version: 1, levels: { L1: { allow: [] }, L2: { deny: [] } } })).budget === null)
{
  const r = loadBudgetFile(wf('ok.json', { version: 1, levels: { L1: { allow: ['read'] }, L2: '*', L3: { deny: ['pwsh'] } } }))
  t('load: 有效文件装载', true, r.valid && r.budget !== null)
  t('load: 保留三级', 3, Object.keys(r.budget.levels).length)
  t('load: deny 级保留', ['pwsh'], r.budget.levels.L3.deny)
}

// ── completeAllowList ──
t('complete: 并入 always-allow 且去重', ['read', 'subagent', 'discipline_gate', 'pwsh', 'write', 'edit'], completeAllowList(['read', 'subagent']))
t('complete: undefined 透传', undefined, completeAllowList(undefined))
t('complete: always 集含纪律五件', true, ['discipline_gate', 'read', 'pwsh', 'write',edit_ok()].every((x) => BUDGET_ALWAYS_ALLOW.includes(x)))
function edit_ok() { return 'edit' }

// ── extractDeclaredLevel ──
t('level: 状态行键值形态', 'L1', extractDeclaredLevel('Context: state=读档 L=L1 confirm=无需'))
t('level: 大写键值 L2-S', 'L2-S', extractDeclaredLevel('判级：L=L2-S 直接做'))
t('level: 独立标记不再触发（审计 F-05 收窄）', null, extractDeclaredLevel('这是 L2-F 任务'))
t('level: 独立 L3 提及不再触发（审计 F-05 收窄）', null, extractDeclaredLevel('命中 L3 停点'))
t('level: 误触发样本消除（L1 交换机提及）', null, extractDeclaredLevel('L1 接入层交换机重启'))
t('level: 无标记', null, extractDeclaredLevel('普通文本没有级别'))
t('level: 干扰词不误报', null, extractDeclaredLevel('LGPL licensed library'))

// ── 随仓 content/budget.json ──
{
  const r = loadBudgetFile(join(REPO, 'content', 'budget.json'))
  t('repo: budget.json 装载有效', true, r.valid)
  t('repo: L1 为白名单', true, Array.isArray(r.budget.levels.L1.allow))
  t('repo: L2-F 为全量', '*', r.budget.levels['L2-F'])
  const completed = completeAllowList(r.budget.levels.L1.allow)
  t('repo: L1 补全后含纪律五件', true, BUDGET_ALWAYS_ALLOW.every((x) => completed.includes(x)))
}

console.log(cases.join('\n'))
console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
