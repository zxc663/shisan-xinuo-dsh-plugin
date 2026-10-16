// tally 双命令单测——出数正确性 + 对账抓植入差错（正/攻击样本双向）。
// 运行：node tests/tally.test.mjs（内部调 scripts/tally.mjs 真实子进程，非 mock）
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const TALLY = join(REPO, 'scripts', 'tally.mjs')
const TD = join(REPO, 'tmp', 'tally-test')

let pass = 0, fail = 0
const cases = []
function t(name, ok, detail = '') {
  if (ok) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name} ${detail}`) }
}

rmSync(TD, { recursive: true, force: true })
mkdirSync(TD, { recursive: true })

// ── 夹具：一段结构完整的日志（A/B 臂 + pre-execute + behavior 三态 + gate-ok/missing + gate-tool）──
const good = [
  { ts: '2026-10-13T01:00:00.000Z', kind: 'arm', mode: 'B' },
  { ts: '2026-10-13T01:00:01.000Z', kind: 'pre-execute', tool: 'shell', cmd: 'echo hi', l3: null },
  { ts: '2026-10-13T01:00:02.000Z', kind: 'behavior', turn: 1, hasText: true, restated: true, levelDeclared: true, gate: 'ok', gateQuality: 'qualified' },
  { ts: '2026-10-13T01:00:02.100Z', kind: 'gate-ok', turn: 1, tail: 'GATE: {...}' },
  { ts: '2026-10-13T01:00:03.000Z', kind: 'behavior', turn: 2, hasText: true, restated: false, levelDeclared: true, gate: 'missing', gateQuality: 'none' },
  { ts: '2026-10-13T01:00:03.100Z', kind: 'gate-missing', turn: 2, toolCalls: 3, tail: 'done' },
  { ts: '2026-10-13T01:00:04.000Z', kind: 'behavior', turn: 3, hasText: false, restated: false, levelDeclared: false, gate: 'skip', gateQuality: 'none' },
  { ts: '2026-10-13T01:00:05.000Z', kind: 'gate-tool', status: 'pass', level: 'L1', v: '改名', cmd: 'echo ok', claimedExit: 0, realExit: 0, match: true, stdoutTail: 'ok', stderrTail: '', summary: '交付摘要：改名完成' },
  { ts: '2026-10-13T01:00:06.000Z', kind: 'gate-tool', status: 'mismatch', level: 'L2-S', v: '修bug', cmd: 'npm t', claimedExit: 0, realExit: 1, match: false },
]
const goodFile = join(TD, 'good.jsonl')
writeFileSync(goodFile, good.map((l) => JSON.stringify(l)).join('\n') + '\n')

function run(args) {
  try {
    const out = execFileSync('node', [TALLY, ...args], { encoding: 'utf8', env: { ...process.env, TALLY_SNAPSHOT: join(TD, 'snap.json') } })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }
  }
}

// 1) 出数正确性
{
  const { code, out } = run(['--report', '--json', `--file=${goodFile}`])
  const agg = JSON.parse(out)
  t('report: exit 0', code === 0)
  t('report: 行数', 9, agg.lines)
  t('report: B 臂=1', 1, agg.arm.B)
  t('report: gateOk=1/missing=1/skip=1', '1/1/1', `${agg.behavior.gateOk}/${agg.behavior.gateMissing}/${agg.behavior.gateSkip}`)
  t('report: gate-tool pass=1 mismatch=1', '1/1', `${agg.gateTool.pass}/${agg.gateTool.mismatch}`)
  t('report: 复述率分母=hasText(2)', 2, agg.behavior.hasText)
}

// 2) 干净日志 --check（无快照）应 PASS
{
  const { code, out } = run(['--check', '--no-snapshot', `--file=${goodFile}`])
  t('check: 干净日志 PASS', code === 0, out)
}

// 3) 攻击样本 A：白名单外字段（植入 token 字段→泄漏面）
{
  const f = join(TD, 'atkA.jsonl')
  const lines = [...good, { ts: '2026-10-13T01:00:07.000Z', kind: 'pre-execute', tool: 'shell', cmd: 'x', l3: null, apiKey: 'sk-LEAKED' }]
  writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const { code, out } = run(['--check', '--no-snapshot', `--file=${f}`])
  t('attack: 白名单外字段被抓', code === 1 && out.includes('白名单外字段') && out.includes('apiKey'), out)
}

// 4) 攻击样本 B：伪造 gate-ok（无对应 behavior 行——植入「收口证据」）
{
  const f = join(TD, 'atkB.jsonl')
  const lines = [...good, { ts: '2026-10-13T01:00:07.000Z', kind: 'gate-ok', turn: 99, tail: 'GATE: {fake}' }]
  writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const { code, out } = run(['--check', '--no-snapshot', `--file=${f}`])
  t('attack: 伪造 gate-ok 被抓', code === 1 && out.includes('turn=99'), out)
}

// 5) 攻击样本 C：behavior.gate 枚举外值（伪造「合格」判定形态）
{
  const f = join(TD, 'atkC.jsonl')
  const lines = [...good, { ts: '2026-10-13T01:00:07.000Z', kind: 'behavior', turn: 5, hasText: true, restated: true, levelDeclared: true, gate: 'excellent', gateQuality: 'qualified' }]
  writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const { code, out } = run(['--check', '--no-snapshot', `--file=${f}`])
  t('attack: gate 枚举外值被抓', code === 1 && out.includes('非法值') && out.includes('excellent'), out)
}

// 6) 攻击样本 D：未知 kind（新日志类型未登记白名单）
{
  const f = join(TD, 'atkD.jsonl')
  const lines = [...good, { ts: '2026-10-13T01:00:07.000Z', kind: 'secret-exfil', payload: 'x' }]
  writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const { code, out } = run(['--check', '--no-snapshot', `--file=${f}`])
  t('attack: 未知 kind 被抓', code === 1 && out.includes('未知 kind'), out)
}

// 7) 攻击样本 E：cmd 超 200 截断帽（超长命令入日志=未来泄漏面）
{
  const f = join(TD, 'atkE.jsonl')
  const lines = [...good, { ts: '2026-10-13T01:00:07.000Z', kind: 'pre-execute', tool: 'shell', cmd: 'x'.repeat(300), l3: null }]
  writeFileSync(f, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const { code, out } = run(['--check', '--no-snapshot', `--file=${f}`])
  t('attack: 超长 cmd 被抓', code === 1 && out.includes('截断帽'), out)
}

// 8) 快照对账三段式（对账铁律）：freeze→PASS→同件篡改→FAIL→行数倒退→FAIL→合法追加→PASS
{
  const f = join(TD, 'snaplog.jsonl')
  writeFileSync(f, good.map((l) => JSON.stringify(l)).join('\n') + '\n')
  run(['--report', '--freeze', `--file=${f}`])
  const c1 = run(['--check', `--file=${f}`])
  t('snapshot: freeze 后 check PASS', c1.code === 0, c1.out)

  const tampered = good.map((l) => (l.kind === 'behavior' && l.turn === 1 ? { ...l, restated: false } : l))
  writeFileSync(f, tampered.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const c2 = run(['--check', `--file=${f}`])
  t('snapshot: 同行数篡改既有条目被抓', c2.code === 1 && c2.out.includes('不一致'), c2.out)

  writeFileSync(f, good.slice(0, 7).map((l) => JSON.stringify(l)).join('\n') + '\n')
  const c3 = run(['--check', `--file=${f}`])
  t('snapshot: 行数倒退（删历史）被抓', c3.code === 1 && c3.out.includes('倒退'), c3.out)

  const grown = [...good, { ts: '2026-10-13T01:00:08.000Z', kind: 'behavior', turn: 4, hasText: true, restated: true, levelDeclared: true, gate: 'skip', gateQuality: 'none' }]
  writeFileSync(f, grown.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const c4 = run(['--check', `--file=${f}`])
  t('snapshot: 合法追加不误报', c4.code === 0, c4.out)
}

console.log(cases.join('\n'))
console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
