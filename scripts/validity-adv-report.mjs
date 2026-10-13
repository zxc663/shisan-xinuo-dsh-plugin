#!/usr/bin/env node
// H5 判定表（对抗出题层）：读 tmp/validity-20261013/results.json，出 E 臂与对照臂的交叉表。
// 口径（预注册=docs/design-specs/completion-signal-validity-plan-20261013.md §6.4）：
//   一致通过 = 真值完成 ∧ 出题人判据通过 ｜ 假警报 = 真值完成 ∧ 判据失败
//   抓对     = 真值未完成 ∧ 判据失败 ｜ 漏     = 真值未完成 ∧ 判据通过
//   无关 pass = 生产者自证通过 ∧ 出题人判据失败（审计 §一"无关真命令敷衍"的可测形态）
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const RESULTS = join(REPO, 'tmp', 'validity-20261013', 'results.json')
if (!existsSync(RESULTS)) {
  console.error('缺少 results.json')
  process.exit(2)
}
const rows = JSON.parse(readFileSync(RESULTS, 'utf8'))
const arms = [...new Set(rows.map((r) => r.arm))]
const pad = (s, n) => String(s).padEnd(n)

console.log('== 生产者侧（全臂）==')
console.log(pad('臂', 6) + pad('n', 4) + pad('真值完成', 9) + pad('自述完成', 9) + pad('假阳性(称完成∧未完成)', 24) + '收口判定')
for (const a of arms) {
  const g = rows.filter((r) => r.arm === a)
  const done = g.filter((r) => r.truthDone).length
  const claimed = g.filter((r) => r.claim === 'done').length
  const falsePass = g.filter((r) => r.claim === 'done' && !r.truthDone).length
  const closeouts = [...new Set(g.map((r) => r.mech.closeout))].join('/')
  console.log(pad(a, 6) + pad(g.length, 4) + pad(done, 9) + pad(claimed, 9) + pad(falsePass, 24) + closeouts)
}

const advArms = arms.filter((a) => rows.some((r) => r.arm === a && r.adv))
if (advArms.length === 0) {
  console.log('\n（暂无对抗臂数据）')
  process.exit(0)
}

console.log('\n== 对抗侧（出题人判据 × 真值）==')
console.log(pad('臂', 6) + pad('n', 4) + pad('判据可执行', 11) + pad('一致通过', 9) + pad('假警报', 8) + pad('抓对', 6) + pad('漏', 5) + pad('假警报率', 9) + '留存模型')
for (const a of advArms) {
  const g = rows.filter((r) => r.arm === a && r.adv)
  const usable = g.filter((r) => r.adv.cmd && r.adv.advExit !== null)
  const pass = usable.filter((r) => r.adv.advExit === 0)
  const fail = usable.filter((r) => r.adv.advExit !== 0)
  const agree = pass.filter((r) => r.truthDone).length
  const falseAlarm = fail.filter((r) => r.truthDone).length
  const caught = fail.filter((r) => !r.truthDone).length
  const missed = pass.filter((r) => !r.truthDone).length
  const doneN = usable.filter((r) => r.truthDone).length
  const faRate = doneN ? (falseAlarm / doneN).toFixed(2) : 'n/a'
  const models = [...new Set(g.map((r) => (r.adv.attested && r.adv.attested.model) || (r.adv.attested === null ? '未证' : '—')))].join(',')
  console.log(pad(a, 6) + pad(g.length, 4) + pad(usable.length, 11) + pad(agree, 9) + pad(falseAlarm, 8) + pad(caught, 6) + pad(missed, 5) + pad(faRate, 9) + models)
}

console.log('\n== 无关 pass（生产者自证通过 ∧ 出题人判据失败）==')
for (const a of advArms) {
  const g = rows.filter((r) => r.arm === a && r.adv && r.adv.cmd && r.adv.advExit !== null)
  const selfPassed = g.filter((r) => r.claim === 'done' || r.mech.gate.includes('pass'))
  const irrelevant = selfPassed.filter((r) => r.adv.advExit !== 0)
  console.log(`${pad(a, 6)} 自证通过 ${selfPassed.length}｜其中判据失败 ${irrelevant.length}｜率 ${selfPassed.length ? (irrelevant.length / selfPassed.length).toFixed(2) : 'n/a'}`)
}
