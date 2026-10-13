// B3 旁路封堵单测——下游裁决判定/指纹归一·记录·匹配（含包装态）/TTL/gate 集成拒跑（全注入）。
// 运行：node tests/bypass-guard.test.mjs
import { isBlockedDecision, normalizeCmdFingerprint, recordDeniedFingerprint, matchDeniedFingerprint, buildGateToolDefinition } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

// ── isBlockedDecision（形状=实测：deny/ask→{kind,reason}；allow→{kind:'allow'}）──
t('blocked: deny=true', true, isBlockedDecision({ kind: 'deny', reason: 'x' }))
t('blocked: ask=true', true, isBlockedDecision({ kind: 'ask', reason: 'x' }))
t('blocked: reject=true', true, isBlockedDecision({ kind: 'reject' }))
t('blocked: block=true', true, isBlockedDecision({ kind: 'block' }))
t('blocked: allow=false', false, isBlockedDecision({ kind: 'allow' }))
t('blocked: undefined=false', false, isBlockedDecision(undefined))
t('blocked: 空对象=false', false, isBlockedDecision({}))

// ── 归一 ──
t('norm: 折叠空白+小写', 'echo x y', normalizeCmdFingerprint('  Echo   X  Y  '))

// ── 记录（短串不录）──
{
  const store = new Map()
  recordDeniedFingerprint(store, 'rm x', 1000)
  t('record: 短串不录', 0, store.size)
  recordDeniedFingerprint(store, 'echo B1-DENY-MARKER-probe3', 1000)
  t('record: 长串录入', 1, store.size)
  t('record: 值=时间戳', 1000, [...store.values()][0])
}

// ── 匹配（原样/包装态/大小写/无关/缺 TTL）──
{
  const store = new Map()
  recordDeniedFingerprint(store, 'echo B1-DENY-MARKER-probe3', 1000)
  t('match: 原样命中', true, matchDeniedFingerprint(store, 'echo B1-DENY-MARKER-probe3', 1001, 600000) !== null)
  t('match: 包装态命中（powershell 包壳）', true, matchDeniedFingerprint(store, 'powershell -Command "& { $r=(echo B1-DENY-MARKER-probe3 2>&1); Write-Output $r }"', 1002, 600000) !== null)
  t('match: 大小写不敏感', true, matchDeniedFingerprint(store, 'ECHO   b1-deny-marker-probe3', 1003, 600000) !== null)
  t('match: 无关命令不命中', null, matchDeniedFingerprint(store, 'echo hello world', 1004, 600000))
}
{
  const store = new Map()
  recordDeniedFingerprint(store, 'echo B1-DENY-MARKER-ttl', 1000)
  t('ttl: 过期不命中', null, matchDeniedFingerprint(store, 'echo B1-DENY-MARKER-ttl', 601001, 600000))
  t('ttl: 过期条目被清理', 0, store.size)
}

// ── 审计 F-08：词边界收敛——同前缀不同目标不误封；包装态仍命中 ──
{
  const store = new Map()
  recordDeniedFingerprint(store, 'rm -rf /tmp/target', 1000)
  t('f08: 原命令命中', true, matchDeniedFingerprint(store, 'rm -rf /tmp/target', 1001, 600000) !== null)
  t('f08: target-2026-backup 不误封', null, matchDeniedFingerprint(store, 'rm -rf /tmp/target-2026-backup', 1002, 600000))
  t('f08: target2 不误封', null, matchDeniedFingerprint(store, 'yes | rm -rf /tmp/target2', 1003, 600000))
  t('f08: 包装态仍命中', true, matchDeniedFingerprint(store, 'powershell -Command "& { rm -rf /tmp/target }"', 1004, 600000) !== null)
}

// ── gate 集成：指纹域 → refused（旁路封堵的收口面）──
{
  const logs = []
  const def = buildGateToolDefinition({
    runCmd: async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }),
    log: (e) => logs.push(e),
    onStats: () => {},
    judge: (c) => (c.toLowerCase().includes('marker') ? '上游拒绝指纹(旁路封堵)' : null),
  })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo B1-DENY-MARKER-x', claimedExit: 0 }, {})
  t('gate: 指纹域 → refused', 'refused', r.status)
  t('gate: 消息含域名', true, r.message.includes('上游拒绝指纹'))
  t('gate: 落账 refused', true, logs.some((l) => l.kind === 'gate-tool' && l.status === 'refused'))
}

for (const c of cases) console.log(c)
console.log(`\n=== bypass-guard.test: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
