// T1 discipline_gate 单测——真值判定三态/L3 拒跑/注入式 execute 全路径（正/负/边界）。
// 运行：node tests/gate-tool.test.mjs
import { planGate, judgeGateToolResult, gateToolMessage, buildGateToolDefinition } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

// ── planGate：L3 侧门封堵（gate 不得成为绕过 L3 的通道）──
t('plan: 安全命令放行', 'run', planGate('node tests/x.test.mjs').action)
t('plan: rm -rf 拒跑', 'refuse', planGate('rm -rf D:/x').action)
t('plan: rm -rf 域=数据删除', '数据删除', planGate('rm -rf D:/x').domain)
t('plan: git push --force 拒跑', 'refuse', planGate('git push --force origin main').action)
t('plan: Remove-Item 拒跑', 'refuse', planGate('Remove-Item D:/x').action)
t('plan: 只读豁免仍放行（cat /etc/xxx）', 'run', planGate('cat /etc/hosts').action)

// ── judgeGateToolResult 三态 ──
t('judge: 0/0=pass', { match: true, verdict: 'pass' }, judgeGateToolResult(0, 0))
t('judge: 1/1=honest-fail（诚实但验证未过）', { match: true, verdict: 'honest-fail' }, judgeGateToolResult(1, 1))
t('judge: 0/1=mismatch（谎报成功）', { match: false, verdict: 'mismatch' }, judgeGateToolResult(0, 1))
t('judge: 2/2 非0非1 也算 honest-fail', { match: true, verdict: 'honest-fail' }, judgeGateToolResult(2, 2))

// ── message 文案含关键信息 ──
for (const [vn, ce, re] of [['mismatch', 0, 1], ['honest-fail', 1, 1], ['pass', 0, 0], ['refused', 0, null], ['error', 0, null]]) {
  const m = gateToolMessage(vn, ce, re, '测试域')
  t(`msg: ${vn} 含状态词`, true, m.startsWith(vn.toUpperCase()) || m.startsWith('PASS') || m.startsWith('HONEST'))
}
t('msg: mismatch 含双方值', true, gateToolMessage('mismatch', 0, 1).includes('exit=1') && gateToolMessage('mismatch', 0, 1).includes('claimedExit=0'))

// ── execute 全路径（注入 runCmd，不打真实进程）──
async function runExecute(args, runCmdImpl, verdicts = [], logs = []) {
  const def = buildGateToolDefinition({
    runCmd: runCmdImpl,
    log: (e) => logs.push(e),
    onStats: (v) => verdicts.push(v),
  })
  const r = await def.execute(args, {})
  return { r, verdicts, logs }
}

// 1) pass 路径：宿主真跑 exit 0
{
  const { r, verdicts, logs } = await runExecute(
    { level: 'L1', v: '改名', cmd: 'echo ok', claimedExit: 0, files: 'a.txt' },
    async () => ({ code: 0, stdout: 'ok', stderr: '', timedOut: false }),
  )
  t('exec: pass 状态', 'pass', r.status)
  t('exec: pass 判定回调', ['pass'], verdicts)
  t('exec: 落日志 kind', 'gate-tool', logs[0]?.kind)
  t('exec: 落日志真值', 0, logs[0]?.realExit)
  t('exec: 落日志 match', true, logs[0]?.match)
  t('exec: 消息可读', true, typeof r.message === 'string' && r.message.includes('PASS'))
}

// 2) mismatch 路径：模型声称 0 实测 1
{
  const { r, verdicts, logs } = await runExecute(
    { level: 'L2-S', v: '修bug', cmd: 'npm test', claimedExit: 0 },
    async () => ({ code: 1, stdout: '', stderr: '2 failing', timedOut: false }),
  )
  t('exec: mismatch 状态', 'mismatch', r.status)
  t('exec: mismatch 打回文案', true, r.message.includes('不得宣告完成'))
  t('exec: mismatch 日志 realExit', 1, logs[0]?.realExit)
  t('exec: mismatch 回调', ['mismatch'], verdicts)
}

// 3) honest-fail 路径
{
  const { r } = await runExecute(
    { level: 'L1', v: 'x', cmd: 'exit 3', claimedExit: 3 },
    async () => ({ code: 3, stdout: '', stderr: '', timedOut: false }),
  )
  t('exec: honest-fail 状态', 'honest-fail', r.status)
  t('exec: honest-fail 也要求修复', true, r.message.includes('不得宣告完成'))
}

// 4) refused 路径：L3 命中不执行（runCmd 若被调会抛错证伪）
{
  const { r, verdicts, logs } = await runExecute(
    { level: 'L2-F', v: 'x', cmd: 'rm -rf /tmp/x', claimedExit: 0 },
    async () => { throw new Error('MUST NOT RUN') },
  )
  t('exec: L3 拒跑状态', 'refused', r.status)
  t('exec: L3 拒跑未执行命令', true, !r.stderrTail && r.message.includes('L3'))
  t('exec: 拒跑日志含域', '数据删除', logs[0]?.domain)
  t('exec: 拒跑回调', ['refused'], verdicts)
}

// 5) timeout 路径
{
  const { r, logs } = await runExecute(
    { level: 'L1', v: 'x', cmd: 'ping -t localhost', claimedExit: 0 },
    async () => ({ code: null, stdout: '', stderr: '', timedOut: true }),
  )
  t('exec: 超时=error 状态', 'error', r.status)
  t('exec: 超时文案含超时', true, r.message.includes('超时'))
  t('exec: 超时日志 error 字段', 'timeout', logs[0]?.error)
}

// 6) 空命令边界
{
  const { r } = await runExecute(
    { level: 'L1', v: 'x', cmd: '   ', claimedExit: 0 },
    async () => { throw new Error('MUST NOT RUN') },
  )
  t('exec: 空命令=error', 'error', r.status)
}

// 7) 超长输入截断（遥测白名单配套）
{
  const { logs } = await runExecute(
    { level: 'L1', v: 'x'.repeat(500), cmd: 'echo hi', claimedExit: 0 },
    async () => ({ code: 0, stdout: 'hi', stderr: '', timedOut: false }),
  )
  t('exec: v 截断 ≤200', true, logs[0].v.length <= 200)
}

console.log(cases.join('\n'))
console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
