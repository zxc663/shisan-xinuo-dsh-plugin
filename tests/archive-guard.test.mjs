// F13 单测——留档核查（有副作用回合不得旧式「未建承载」声明；未写 memory/ 且未声明=静默跳过）。
import { judgeArchiveGap } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (expect === actual) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${expect}\n  actual=${actual}`) }
}

t('只读回合=ok（hostLevel≤1 免建）', 'ok', judgeArchiveGap({ lastText: '单次：未建承载', hostLevel: 1, toolCalls: 3, memoryTouched: false }))
t('零工具=ok', 'ok', judgeArchiveGap({ lastText: '单次：未建承载', hostLevel: 2, toolCalls: 0, memoryTouched: false }))
t('副作用+旧式声明=legacy-claim', 'legacy-claim', judgeArchiveGap({ lastText: '【改动】tmp/x.txt。单次：未建承载', hostLevel: 2, toolCalls: 4, memoryTouched: false }))
t('副作用+不建承载变体=legacy-claim（已留档亦不豁免该声明）', 'legacy-claim', judgeArchiveGap({ lastText: '本轮不建承载，小改完成', hostLevel: 2, toolCalls: 2, memoryTouched: true }))
t('副作用+正文提留档=ok', 'ok', judgeArchiveGap({ lastText: '【留档】流水已写 memory/agent-log.md', hostLevel: 2, toolCalls: 4, memoryTouched: false }))
t('副作用+本回合写过 memory=ok', 'ok', judgeArchiveGap({ lastText: '完成。', hostLevel: 2, toolCalls: 4, memoryTouched: true }))
t('副作用+未触memory且未声明=silent-skip', 'silent-skip', judgeArchiveGap({ lastText: '【交付】完成；【改动】a.txt', hostLevel: 2, toolCalls: 4, memoryTouched: false }))
t('跳过声明（含留档字样）=ok', 'ok', judgeArchiveGap({ lastText: '跳过留档：无承载处，纯临时验证', hostLevel: 2, toolCalls: 2, memoryTouched: false }))

console.log(cases.join('\n'))
console.log(`\n=== archive-guard: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
