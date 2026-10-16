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

// ⑤ T2：失败阶梯**按任务分桶**——换任务即归零（修掉"跨任务累计"）
{
  let task = 't1'
  const def = buildGateToolDefinition({
    runCmd: async () => ({ code: 1, stdout: '', stderr: '', timedOut: false }),
    log: () => {},
    onStats: () => {},
    taskId: () => task,
    acceptance: { list: () => [], register: () => ({ count: 0 }), clear: () => {}, markPassed: () => {}, evaluate: () => ({ ok: true, detail: '' }) },
  })
  const args = { level: 'L1', v: 'x', cmd: 'do-something', claimedExit: 0 }
  const r1 = await def.execute(args, {})
  const r2 = await def.execute(args, {}) // 同一任务第 2 次失败 ⇒ 阶梯 2
  task = 't2'
  const r3 = await def.execute(args, {}) // 换任务 ⇒ 阶梯归零
  t('T2a 首失败 status 仍为 mismatch', 'mismatch', r1.status)
  t('T2b 同任务第2次 ⇒ 阶梯2', true, r2.message.includes('阶梯 2'))
  t('T2c 换任务后不再有阶梯前缀', false, r3.message.includes('阶梯'))
}

// ⑥ 批5·assert-only pass 也触发 concludeTurn（闭环宿主终结；旧形态仅 cmd 路径有 conclude 块）
{
  let ctCalled = 0
  const logs = []
  const def = buildGateToolDefinition({
    runCmd: async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }),
    log: (e) => logs.push(e),
    onStats: () => {},
    concludeOnPass: true,
    acceptance: { list: () => [], register: () => ({ count: 0 }), clear: () => {}, markPassed: () => {}, evaluate: async () => ({ ok: true, detail: '' }) },
  })
  const r = await def.execute({ level: 'L1', v: 'x', assert: 'exists:D:\\tmp\\a.txt' }, { concludeTurn: () => { ctCalled++ } })
  t('CJ1 assert-only pass ⇒ concludeTurn 被调', 1, ctCalled)
  t('CJ2 返回值标记 concludedTurn', true, r.concludedTurn === true)
  t('CJ3 落 gate-conclude marked', true, logs.some((e) => e.kind === 'gate-conclude' && e.status === 'marked'))
}

// ⑦ 洞修复：assert-only pass 也必须复核**已登记断言（含 pinned）**——登记断言未过 ⇒ assertion-fail（不闭环）
{
  const mkDef = (registeredOk) =>
    buildGateToolDefinition({
      runCmd: async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }),
      log: () => {},
      onStats: () => {},
      acceptance: {
        list: () => [{ assertion: { kind: 'exists', path: 'D:\\tmp\\never.txt' }, source: 'pinned' }],
        register: () => ({ count: 0 }),
        clear: () => {},
        markPassed: () => {},
        evaluate: async (a) => (a.path === 'D:\\tmp\\never.txt' ? { ok: registeredOk, detail: registeredOk ? '' : 'pinned 未满足' } : { ok: true, detail: '' }),
      },
    })
  const r1 = await mkDef(false).execute({ level: 'L1', v: 'x', assert: 'exists:D:\\tmp\\a.txt' }, {})
  t('P2a 已登记断言未过 ⇒ assertion-fail（assert-only 不再绕过）', 'assertion-fail', r1.status)
  t('P2b 该路径不闭环', false, r1.closed === true)
  const r2 = await mkDef(true).execute({ level: 'L1', v: 'x', assert: 'exists:D:\\tmp\\a.txt' }, {})
  t('P2c 登记断言全过 ⇒ 仍 pass', 'pass', r2.status)
}

// ⑧ 同族不变量：cmd 路径亦须复核**已登记断言（含 pinned）**——登记断言未过 ⇒ assertion-fail（不闭环）
{
  const def = buildGateToolDefinition({
    runCmd: async () => ({ code: 0, stdout: 'ok', stderr: '', timedOut: false }),
    log: () => {},
    onStats: () => {},
    acceptance: {
      list: () => [{ assertion: { kind: 'exists', path: 'D:\\tmp\\never2.txt' }, source: 'pinned' }],
      register: () => ({ count: 0 }),
      clear: () => {},
      markPassed: () => {},
      evaluate: async () => ({ ok: false, detail: 'pinned 未满足' }),
    },
  })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, {})
  t('P3a cmd 通过但已登记断言未过 ⇒ assertion-fail', 'assertion-fail', r.status)
  t('P3b 该路径不闭环', false, r.closed === true)
}

console.log(`gate-assert: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
