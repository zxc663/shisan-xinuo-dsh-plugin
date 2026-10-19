// F14 单测——状态行中文字段解析器（state/clarify/approval 按 §0 映射表）。
import { extractStatusFields } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

// 整行
t('整行全字段', { state: 'new', clarify: 'none', approval: 'not_required' },
  extractStatusFields('Context: state=新任务 L=L2-S clarify=无 approval=无需'))
t('续接+待澄清', { state: 'resume', clarify: 'pending', approval: 'not_required' },
  extractStatusFields('Context: state=续接 L=L1 clarify=待澄清 approval=无需'))
t('单次+已澄清', { state: 'single', clarify: 'resolved' },
  extractStatusFields('Context: state=单次 L=L1 clarify=已澄清'))
t('待批准', { approval: 'pending' }, extractStatusFields('approval=待批准'))
t('已批准', { approval: 'granted' }, extractStatusFields('approval=已批准'))
t('已拒绝', { approval: 'denied' }, extractStatusFields('approval=已拒绝'))
t('豁免带理由', { approval: 'waived' }, extractStatusFields('approval=豁免:文档明确授权'))
t('豁免无理由', { approval: 'waived' }, extractStatusFields('approval=豁免'))
// 缺失与干扰
t('无状态行=空对象', {}, extractStatusFields('普通回复，无字段'))
t('空串=空对象', {}, extractStatusFields(''))
t('正文提及"待澄清"字样但非字段=不误报', {}, extractStatusFields('这个需求有点待澄清的味道'))
t('字段词序任意', { state: 'new', clarify: 'pending' }, extractStatusFields('clarify=待澄清，state=新任务'))

console.log(cases.join('\n'))
console.log(`\n=== status-fields: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
