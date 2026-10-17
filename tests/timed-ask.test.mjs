// P4 F6（缩围版）单测——timed ask 工具检测（宿主原生 timeout 参数；插件=检测+指引，零包装层）。
// 依据 docs/design-specs/p1-host-probes-20261017.md 探针1：宿主 dsh-tool-ask-user 提供 timed
// ask_user_question（timeout=-1 无限或 1..2147483 秒，默认 120；超时=pending 可续答）。
import { isTimedAskSchema } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

t('timed: ask_user_question 带 timeout 参数=true', true,
  isTimedAskSchema({ name: 'ask_user_question', description: 'x', parameters: { questions: {}, timeout: { type: 'number' } } }))
t('timed: legacy 版无 timeout=false', false,
  isTimedAskSchema({ name: 'ask_user_question', description: 'x', parameters: { questions: {} } }))
t('timed: 其他工具名=false（只检 ask）', false,
  isTimedAskSchema({ name: 'bash', description: 'x', parameters: { timeout: { type: 'number' } } }))
t('timed: null 安全', false, isTimedAskSchema(null))
t('timed: parameters null 安全', false, isTimedAskSchema({ name: 'ask_user_question', description: 'x', parameters: null }))

console.log(cases.join('\n'))
console.log(`\n=== timed-ask: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
