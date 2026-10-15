// B7 装配测试：assert 通道走**真实求值链**（evaluate=生产 evaluateAssertion，不桩）。
// 回归锚点：装配层曾把 spec 字符串直接喂给要断言对象的 evaluate（A1）——桩测试全绿而真机 0 成功（32 次失败/0 成功）。
// 覆盖：A1 对象接线 / assert-only pass 触发 onClosed(true)（回合桶放行前提，旧形态漏调）/
//       A2 同给 cmd 不再被吞、assert 未过即时短路且明示 cmd 未执行 / 非法规格 ⇒ error。
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { buildGateToolDefinition, evaluateAssertion } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const t = (name, expected, actual) => {
  if (JSON.stringify(expected) === JSON.stringify(actual)) pass++
  else {
    fail++
    console.error(`FAIL ${name}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)
  }
}

// 真实装配：evaluate 不桩——直接用 core 的 evaluateAssertion（与生产 acceptanceBridge 同一求值函数；
// 仅注入放行 judge 与间谍 runCmd，保证测试密闭、不真跑 shell）。
const mk = (runCmdImpl) => {
  const state = { runCmdCalls: 0, closedCalls: [] }
  const spyRun = async (...a) => {
    state.runCmdCalls++
    return runCmdImpl(...a)
  }
  const def = buildGateToolDefinition({
    runCmd: spyRun,
    log: () => {},
    onStats: () => {},
    judge: () => null,
    acceptance: {
      list: () => [],
      register: () => ({ count: 0 }),
      clear: () => {},
      markPassed: () => {},
      evaluate: (a, ctx) => evaluateAssertion(a, { judge: () => null, runCmd: spyRun }),
    },
    onClosed: (closed) => { state.closedCalls.push(closed) },
  })
  return { def, state }
}

const dir = mkdtempSync(join(tmpdir(), 'sx-wiring-'))
const existing = join(dir, 'exists.txt')
writeFileSync(existing, 'hello-wiring', 'utf8')

// ① A1 回归：assert=exists(真实存在的文件) ⇒ 真实 evaluateAssertion 收到**断言对象**并求值 ⇒ pass
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }))
  const r = await g.def.execute({ level: 'L1', v: 'x', assert: `exists:${existing}` }, {})
  t('W1a 真实链 exists ⇒ pass', 'pass', r.status)
  t('W1b closed=true', true, r.closed)
  t('W1c onClosed(true) 被调（旧形态漏调 ⇒ 收口仍被打回的根因之一）', 1, g.state.closedCalls.length)
  t('W1d 断言结果随返回携带', 1, (r.assertions ?? []).length)
  t('W1e 不过 shell（间谍 runCmd 0 次）', 0, g.state.runCmdCalls)
}

// ② A1 反向：assert=not_exists(真实存在的文件) ⇒ assertion-fail（真实求值，非桩绿灯）
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }))
  const r = await g.def.execute({ level: 'L1', v: 'x', assert: `not_exists:${existing}` }, {})
  t('W2a 真实链 not_exists(存在) ⇒ assertion-fail', 'assertion-fail', r.status)
  t('W2b closed=false', false, r.closed)
  t('W2c 附合格判据要求', true, r.message.includes('合格判据的要求'))
}

// ③ A2 回归：同给 cmd+assert（assert 过）⇒ cmd **被真实执行**（不再被吞），两路合并 pass
{
  const g = mk(async () => ({ code: 0, stdout: 'ok', stderr: '', timedOut: false }))
  const r = await g.def.execute({ level: 'L2-S', v: 'x', cmd: 'echo hi', claimedExit: 0, assert: `exists:${existing}` }, {})
  t('W3a 同给 ⇒ pass', 'pass', r.status)
  t('W3b cmd 被真实执行（≥1 次）', true, g.state.runCmdCalls >= 1)
  t('W3c closed=true（assert 证据补强弱 cmd）', true, r.closed)
}

// ④ A2 短路：同给 cmd+assert（assert 未过）⇒ 即时 assertion-fail，cmd **未执行**且返回明示
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }))
  const r = await g.def.execute({ level: 'L2-S', v: 'x', cmd: 'echo hi', claimedExit: 0, assert: `not_exists:${existing}` }, {})
  t('W4a assert 未过 ⇒ assertion-fail', 'assertion-fail', r.status)
  t('W4b cmd 未执行（间谍 0 次）', 0, g.state.runCmdCalls)
  t('W4c 返回明示 cmd 未执行', true, r.message.includes('未执行'))
}

// ⑤ 非法 assert 规格 ⇒ error（不再伪装成 assertion-fail 假象）
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }))
  const r = await g.def.execute({ level: 'L1', v: 'x', assert: 'bogus-spec-no-colon' }, {})
  t('W5a 解析不出 ⇒ error', 'error', r.status)
  t('W5b 提示合法形态', true, r.message.includes('not_exists'))
}

// ⑥ path_contains 真实内容比对（证明 path/substr 字段按对象正确接线）
{
  const g = mk(async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }))
  const rOk = await g.def.execute({ level: 'L1', v: 'x', assert: `path_contains:${existing}::wiring` }, {})
  const rBad = await g.def.execute({ level: 'L1', v: 'x', assert: `path_contains:${existing}::not-there` }, {})
  t('W6a path_contains 命中 ⇒ pass', 'pass', rOk.status)
  t('W6b path_contains 不中 ⇒ assertion-fail', 'assertion-fail', rBad.status)
}

rmSync(dir, { recursive: true, force: true })
console.log(`gate-assert-wiring: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
