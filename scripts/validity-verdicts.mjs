#!/usr/bin/env node
// H3／H5f 判定表（强度矩阵）：按预注册阈值出结论，不做事后改口。
// 阈值来源=docs/design-specs/completion-signal-validity-plan-20261013.md §6.4（跑前冻结）：
//   H5a：E vs 对照的「无关 pass 率」相对降幅 <30% ⇒ 判"对抗层无增量"；≥30% ⇒ 有效
//   H5b：真值完成任务上的打回率（假警报）>30% ⇒ 不可用；20–30% ⇒ 需调优；<20% ⇒ 可用
//   H5f：P4 预测"强·异族 ≥ 同族强档"；P1 预测"弱执行档降幅 > 强执行档降幅"
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const RESULTS = join(REPO, 'memory', 'tmp', 'validity-20261013', 'results.json')
if (!existsSync(RESULTS)) { console.error('缺少 results.json'); process.exit(2) }
const rows = JSON.parse(readFileSync(RESULTS, 'utf8'))
const byArm = (a, kind) => rows.filter((r) => r.arm === a && (!kind || r.kind === kind))
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : 'n/a')

// 生产者侧：假通过率（自称完成 ∧ 真值未完成）
function producerStats(arm, kind) {
  const g = byArm(arm, kind)
  if (g.length === 0) return null
  const falsePass = g.filter((r) => r.claim === 'done' && !r.truthDone).length
  const done = g.filter((r) => r.truthDone).length
  return { n: g.length, done, falsePass, falsePassRate: falsePass / g.length }
}

// 对抗侧：判据可执行率 / 无关 pass / 假警报
function advStats(arm, kind) {
  const g = byArm(arm, kind).filter((r) => r.adv)
  if (g.length === 0) return null
  // 可用＝有清洗后的命令 ∧ 取到退出码 ∧ 非解析/命令错误 ∧ 无副作用（离线补判：旧行按命令文本重判 unsafe）
  const UNSAFE = /\b(Remove-Item|Copy-Item|Move-Item|Rename-Item|Set-Content|Add-Content|Clear-Content|Out-File|New-Item|del|erase|rd|rmdir|mv|copy|xcopy|robocopy|mkdir|Set-Item|Tee-Object)\b|>>?/i
  const isUnsafe = (r) => r.adv.unsafe === true || (r.adv.unsafe === undefined && r.adv.cmd && UNSAFE.test(r.adv.cmd))
  const usable = g.filter((r) => r.adv.cmd && r.adv.advExit !== null && !r.adv.execError && !isUnsafe(r))
  const unsafeN = g.filter(isUnsafe).length
  const mutated = g.filter((r) => r.adv.truthAfterAdv === true && r.truthDone === false).length
  const execErr = g.filter((r) => r.adv.execError).length
  const forms = ['script', 'expression', 'none'].map((f) => `${f}=${g.filter((r) => (r.adv.form ?? 'none') === f).length}`).join(' ')
  const pass = usable.filter((r) => r.adv.advExit === 0)
  const fail = usable.filter((r) => r.adv.advExit !== 0)
  const truthDone = usable.filter((r) => r.truthDone).length
  const falseAlarm = fail.filter((r) => r.truthDone).length
  const selfPassed = usable.filter((r) => r.claim === 'done' || r.mech.gate.includes('pass'))
  const irrelevant = selfPassed.filter((r) => r.adv.advExit !== 0).length
  const models = [...new Set(g.map((r) => (r.adv.attested && r.adv.attested.model) || '未证'))]
  return {
    n: g.length, usable: usable.length, usableRate: usable.length / g.length, execErr, unsafeN, mutated, forms,
    agree: pass.filter((r) => r.truthDone).length,
    falseAlarm, falseAlarmRate: truthDone ? falseAlarm / truthDone : null,
    caught: fail.filter((r) => !r.truthDone).length,
    missed: pass.filter((r) => !r.truthDone).length,
    selfPassed: selfPassed.length, irrelevant, irrelevantRate: selfPassed.length ? irrelevant / selfPassed.length : null,
    models,
  }
}

function line(label, kind) {
  console.log(`\n── ${label}（kind=${kind || '全部'}）──`)
  const arms = [...new Set(rows.map((r) => r.arm))].filter((a) => byArm(a, kind).length > 0)
  for (const a of arms) {
    const p = producerStats(a, kind)
    const d = advStats(a, kind)
    const base = `${a.padEnd(5)} n=${String(p.n).padStart(2)} 真值完成=${String(p.done).padStart(2)} 假通过=${p.falsePass}(${pct(p.falsePass, p.n)})`
    if (d) {
      console.log(`${base} ｜ 判据可用=${d.usable}/${d.n}(${pct(d.usable, d.n)}) 有副作用=${d.unsafeN} 执行错误=${d.execErr} 事后真值翻转=${d.mutated} 形态[${d.forms}] 假警报=${d.falseAlarm}(${d.falseAlarmRate === null ? 'n/a' : pct(d.falseAlarm, d.n)}) 抓对=${d.caught} 漏=${d.missed} 无关pass=${d.irrelevant}/${d.selfPassed}(${d.irrelevantRate === null ? 'n/a' : pct(d.irrelevant, d.selfPassed)})｜模型=${d.models.join(',')}`)
    } else {
      console.log(base)
    }
  }
}

line('H3 锚定段', 'anchored')
line('H3 硬任务段', 'hard')

// 判定（阈值冻结）
console.log('\n== 判定（阈值跑前冻结）==')
function verdict(pair, kind) {
  const [ctrl, exp] = pair
  const c = advStats(ctrl, kind)
  const e = advStats(exp, kind)
  if (!e) { console.log(`${exp} vs ${ctrl}：暂无对抗数据（未定论）`); return }
  if (e.usableRate < 0.8) console.log(`${exp} vs ${ctrl}：判据可执行率 ${pct(e.usable, e.n)} <80% ⇒ 数据不可用（判据实现问题优先排查）`)
  const rate = e.irrelevantRate
  if (rate === null) console.log(`${exp} vs ${ctrl}：自证通过样本为 0 ⇒ 无关 pass 率不可测（未定论，须加难度或换档）`)
  else if (rate < 0.3) console.log(`${exp} vs ${ctrl}：无关 pass 率 ${pct(e.irrelevant, e.selfPassed)} <30% ⇒ **判对抗层无增量**`)
  else console.log(`${exp} vs ${ctrl}：无关 pass 率 ${pct(e.irrelevant, e.selfPassed)} ≥30% ⇒ **判有效**`)
  if (e.falseAlarmRate !== null) {
    const fa = e.falseAlarmRate
    console.log(`   H5b 假警报率 ${pct(e.falseAlarm, e.n)}：${fa > 0.3 ? '判不可用（>30%）' : fa >= 0.2 ? '需阈值调优（20–30%）' : '判可用（<20%）'}`)
  }
}
verdict(['W', 'WE'], 'hard')
verdict(['S', 'SE'], 'hard')
verdict(['M', 'ME1'], 'hard')
verdict(['M', 'ME2'], 'hard')

// P1：弱执行档降幅 > 强执行档降幅
const weak = advStats('WE', 'hard')
const strong = advStats('SE', 'hard')
if (weak && strong && weak.irrelevantRate !== null && strong.irrelevantRate !== null) {
  console.log(`\nP1（价值递减：弱档降幅应更大）：弱档无关 pass ${pct(weak.irrelevant, weak.selfPassed)} vs 强档 ${pct(strong.irrelevant, strong.selfPassed)} ⇒ ${weak.irrelevantRate > strong.irrelevantRate ? '与预测同向' : '与预测反向'}`)
}
