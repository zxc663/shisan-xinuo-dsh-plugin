// P1/P7 新增证据：① `assert` 由插件内联求值、**绝不过 shell**（反证：runCmd 未被调用）；
// ② `assert` 未过 ⇒ assertion-fail（不改判为 mismatch）；③ 沙箱/ACL 拒绝 ⇒ channel-unavailable（不计入验证不符）。
import { buildGateToolDefinition } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const t = (name, expected, actual) => {
  if (JSON.stringify(expected) === JSON.stringify(actual)) pass++
  else {
    fail++
    console.error(`FAIL ${name}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)
  }
}

const mk = (runCmdImpl, evaluateImpl) => {
  let calls = 0
  const def = buildGateToolDefinition({
    runCmd: async (...a) => {
      calls++
      return runCmdImpl(...a)
    },
    log: () => {},
    onStats: () => {},
    acceptance: {
      list: () => [],
      register: () => ({ count: 0 }),
      clear: () => {},
      markPassed: () => {},
      evaluate: evaluateImpl ?? (() => ({ ok: true, detail: '' })),
    },
  })
  return { def, calls: () => calls }
}

// ① assert 走内联求值 ⇒ runCmd 调用次数必须为 0（这是"不过 shell"的反证）
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }))
  const r = await g.def.execute({ level: 'L1', v: 'x', assert: 'not_exists:D:\\tmp\\a.txt' }, {})
  t('P1a assert 通过 ⇒ status=pass', 'pass', r.status)
  t('P1b assert 通过 ⇒ closed=true', true, r.closed)
  t('P1c **runCmd 未被调用（不过 shell）**', 0, g.calls())
  t('P1d 证据强度=强', 'strong', r.evidence)
  t('P1e 消息声明内联求值', true, r.message.includes('内联求值'))
}

// ② assert 未过 ⇒ assertion-fail（不是 mismatch），且仍未调 shell
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }), () => ({ ok: false, detail: '目标仍存在' }))
  const r = await g.def.execute({ level: 'L1', v: 'x', assert: 'not_exists:D:\\tmp\\a.txt' }, {})
  t('P1f assert 未过 ⇒ assertion-fail', 'assertion-fail', r.status)
  t('P1g 未过 ⇒ closed=false', false, r.closed)
  t('P1h 未过仍不过 shell', 0, g.calls())
  t('P1i 未过附要求结构', true, r.message.includes('合格判据的要求'))
}

// ③ 沙箱/ACL 拒绝 ⇒ channel-unavailable（环境故障，不计入验证不符）
{
  const g = mk(async () => ({ code: null, stdout: '', stderr: 'SetNamedSecurityInfoW failed: Access is denied', timedOut: false }))
  const r = await g.def.execute({ level: 'L1', v: 'x', cmd: 'echo hi', claimedExit: 0 }, {})
  t('P7a 沙箱拒绝 ⇒ channel-unavailable', 'channel-unavailable', r.status)
  t('P7b 明示非验证未过', true, r.message.includes('不是你的验证未通过'))
  t('P7c 给出 assert 出路', true, r.message.includes('assert'))
}

// ④ 两样都不给 ⇒ error 且指向 assert
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }))
  const r = await g.def.execute({ level: 'L1', v: 'x' }, {})
  t('P1j 空参数 ⇒ error', 'error', r.status)
  t('P1k 提示用 assert', true, r.message.includes('assert'))
}

console.log(`gate-assert: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
