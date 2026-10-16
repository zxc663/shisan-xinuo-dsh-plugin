#!/usr/bin/env node
// tally 双命令（release-plan v0.2：「出数-对账铁律」——出数必须可被独立对账复算抓差错）
//   node scripts/tally.mjs --report            出数：exec-log 聚合指标（人类可读 + --json）
//   node scripts/tally.mjs --report --freeze   出数并冻结快照到 logs/tally-report.last.json
//   node scripts/tally.mjs --check             对账：白名单校验+结构不变量+快照复算，抓植入差错（exit 1=发现违规）
//   node scripts/tally.mjs --check --no-snapshot 跳过快照比对（首次运行前或日志合法增长后需先 --freeze）
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const DEFAULT_LOG = join(repo, 'logs', 'exec-log.jsonl')
const SNAPSHOT = process.env.TALLY_SNAPSHOT ?? join(repo, 'logs', 'tally-report.last.json')

// ── 遥测字段白名单（release-plan §四：v0.2 起生效；新增字段须先改此表再落日志）──
// B2（2026-10-16）：每条记录带 instanceId（进程实例）+ sid（最近活跃会话）——混多会话日志可归属可复算
const COMMON = new Set(['ts', 'kind', 'instanceId', 'sid'])
const FIELD_WHITELIST = {
  arm: ['mode'],
  'pre-execute': ['tool', 'cmd', 'l3'],
  'l3-detected': ['tool', 'domain', 'cmd', 'decision'],
  'l3-intercept': ['tool', 'domain', 'cmd'],
  behavior: ['turn', 'hasText', 'restated', 'levelDeclared', 'gate', 'gateQuality', 'textClaim'],
  'gate-ok': ['turn', 'via', 'tail'],
  'gate-missing': ['turn', 'toolCalls', 'gateVerdict', 'unproven', 'tail'],
  'gate-tool': ['status', 'domain', 'level', 'v', 'cmd', 'claimedExit', 'realExit', 'match', 'files', 'exempt', 'stdoutTail', 'stderrTail', 'error', 'assertions', 'evidence'],
  rules: ['source', 'valid', 'domains', 'reason'],
  discipline: ['source', 'valid', 'reason'],
  'tools-inventory': ['count', 'names'],
  'tools-wire': ['count', 'chars'],
  'sandbox-mode': ['mode', 'enforcement'],
  'gate-steer': ['turn', 'toolCalls', 'mode', 'assertions', 'assertionsOpen'],
  // ── B2/B3 遥测（审计 F-04：补齐与引擎写入面的一致性；tests/tally-whitelist.test.mjs 机检防再脱节）──
  'task-auto': ['count', 'sourceKind', 'raw', 'mark'],
  'task-carryover': ['count', 'prior'],
  'task-register': ['status', 'mark', 'count', 'goal', 'mode', 'preservedAuto', 'reason'],
  pinned: ['count', 'marks'],
  'assertion-unresolved': ['turn', 'count', 'gate'],
  'bypass-blocked': ['cmd', 'fingerprint'],
  'upstream-block': ['tool', 'cmd', 'upstreamKind', 'l3'],
  'gate-conclude': ['status', 'cmd', 'error', 'ctType'],
  'probe-conclude': ['status', 'error'],
  'guard-deny': ['tool', 'cmd', 'reason'],
  'auto-closeout': ['turn', 'count', 'result', 'table'],
  // F2 零工具调用盲区（SHISANUO_ZEROTOOL_GUARD=1 时落账）
  'zerotool-claim': ['turn', 'tail'],
  // F8 跨回合熔断
  'gate-steer-capped': ['turn', 'used', 'cap', 'mode'],
  // C5 失败阶梯
  'gate-fail-ladder': ['status', 'n', 'cmd'],
  // C6 v 描述锚定性
  'gate-v-unanchored': ['status', 'v', 'cmd'],
  // C7 争议标记
  'gate-disputed': ['status', 'reason', 'goal'],
  // C8 争议→补交配对
  'task-amend-after-dispute': ['count', 'goal'],
  // C3 判级低报（第一档：只记录）
  'gate-level-understated': ['declared', 'host', 'cmd'],
  // A1 弱证据通过（不闭环）
  'gate-pass-weak': ['status', 'evidence', 'cmd'],
  // C2 只读回合免收口
  'gate-skip-readonly': ['turn', 'toolCalls', 'hostLevel'],
  // C3 第二档 低报度量
  'level-divergence': ['turn', 'declared', 'host', 'toolCalls'],
  // C9 只读工具目录
  'tools-catalog': ['level', 'visible'],
  // 批3 方向 A：段指纹（启动基线 + 每请求漂移核对）
  'section-fingerprint': ['sha256', 'bytes', 'changed'],
  'section-drift': ['expected', 'actual'],
  // C14 skill 类注入体积（度量；裁剪不在插件面）
  'skill-catalog-cost': ['sourceKind', 'chars'],
  // C16 成本提示（实验）
  'cost-hint': ['turn', 'toolCalls'],
  // 批3 方向 A：跳过治理（熔断跳过落 notice + 三问质询，不静默）
  'skip-notice': ['turn', 'mode', 'used', 'cap'],
  'probe-notice': ['status'],
  // 批3 方向 A：启动自检（段/装载/收口链/段指纹）
  'self-check': ['sections', 'disciplineValid', 'gateTool', 'taskTool', 'catalog', 'concludeOnPass', 'fingerprint', 'missing'],
  // B 组：任务级作用域
  'task-open': ['id', 'level', 'trigger'],
}
// names：`tools-inventory` 落的是全量工具名（代码侧已 slice 300）——帽取 320 容纳该既有字段；`budget-leak` 侧自带 240 截断
const CAPS = { cmd: 200, v: 200, files: 300, exempt: 300, stdoutTail: 300, stderrTail: 300, tail: 300, names: 320 }

function parseArgs(argv) {
  const a = { mode: 'report', file: DEFAULT_LOG, json: false, freeze: false, noSnapshot: false }
  for (const x of argv) {
    if (x === '--report') a.mode = 'report'
    else if (x === '--check') a.mode = 'check'
    else if (x === '--freeze') a.freeze = true
    else if (x === '--json') a.json = true
    else if (x === '--no-snapshot') a.noSnapshot = true
    else if (x.startsWith('--file=')) a.file = x.slice(7)
    else { console.error(`unknown arg: ${x}`); process.exit(2) }
  }
  return a
}

function readLines(file) {
  if (!existsSync(file)) return { lines: [], raw: [] }
  const raw = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '')
  const lines = []
  for (const l of raw) {
    try { lines.push(JSON.parse(l)) } catch { lines.push({ __badLine: l }) }
  }
  return { lines, raw }
}

function aggregate(lines) {
  const byKind = {}
  for (const l of lines) byKind[l.kind] = (byKind[l.kind] ?? 0) + 1
  const arm = { A: 0, B: 0, C: 0 }
  const l3 = { detected: 0, intercepted: 0 }
  const behavior = { turns: 0, hasText: 0, restated: 0, levelDeclared: 0, gateOk: 0, gateOkTool: 0, gateOkAuto: 0, gateFail: 0, gateMissing: 0, gateSkip: 0, qualified: 0, hollow: 0 }
  const gateTool = { calls: 0, pass: 0, 'honest-fail': 0, mismatch: 0, refused: 0, error: 0, 'assertion-fail': 0, 'channel-unavailable': 0 }
  for (const l of lines) {
    if (l.kind === 'arm' && (l.mode === 'A' || l.mode === 'B' || l.mode === 'C')) arm[l.mode]++
    else if (l.kind === 'l3-detected') l3.detected++
    else if (l.kind === 'l3-intercept') l3.intercepted++
    else if (l.kind === 'behavior') {
      behavior.turns++
      if (l.hasText) behavior.hasText++
      if (l.restated) behavior.restated++
      if (l.levelDeclared) behavior.levelDeclared++
      if (l.gate === 'ok') behavior.gateOk++
      else if (l.gate === 'ok-tool') behavior.gateOkTool++
      else if (l.gate === 'ok-auto') behavior.gateOkAuto++
      else if (l.gate === 'gate-fail') behavior.gateFail++
      else if (l.gate === 'missing') behavior.gateMissing++
      else behavior.gateSkip++
      if (l.gateQuality === 'qualified') behavior.qualified++
      else if (l.gateQuality === 'hollow') behavior.hollow++
    } else if (l.kind === 'gate-tool') {
      gateTool.calls++
      const s = l.status
      if (s in gateTool && s !== 'calls') gateTool[s]++
    }
  }
  return { lines: lines.length, byKind, arm, l3, behavior, gateTool }
}

function checkWhitelist(lines) {
  const v = []
  lines.forEach((l, i) => {
    if (!l || typeof l !== 'object' || l.__badLine !== undefined) {
      v.push(`line ${i + 1}: 非 JSON 对象`)
      return
    }
    const allow = FIELD_WHITELIST[l.kind]
    if (!allow) { v.push(`line ${i + 1}: 未知 kind="${l.kind}"（不在白名单表）`); return }
    const allowed = new Set([...COMMON, ...allow])
    for (const k of Object.keys(l)) {
      if (!allowed.has(k)) v.push(`line ${i + 1}: kind=${l.kind} 含白名单外字段 "${k}"`)
    }
    if (typeof l.ts !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(l.ts)) v.push(`line ${i + 1}: ts 缺失或非 ISO 形态`)
    for (const [f, cap] of Object.entries(CAPS)) {
      if (typeof l[f] === 'string' && l[f].length > cap) v.push(`line ${i + 1}: 字段 ${f} 超 ${cap} 字符截断帽（实际 ${l[f].length}）`)
    }
    if (l.kind === 'behavior' && !['ok', 'ok-tool', 'ok-auto', 'gate-unproven', 'unverified', 'gate-fail', 'missing', 'skip'].includes(l.gate)) v.push(`line ${i + 1}: behavior.gate 非法值 "${l.gate}"`)
  })
  return v
}

function checkInvariants(lines) {
  const v = []
  const behaviorByTurn = new Map()
  for (const l of lines) {
    if (l.kind === 'behavior') behaviorByTurn.set(`${l.turn}:${l.gate}`, (behaviorByTurn.get(`${l.turn}:${l.gate}`) ?? 0) + 1)
  }
  // 注：不做全局 ts 单调校验——exec-log 由桌面+headless 多进程并发追加，跨进程时间戳交错是合法形态（实测 696 行含 2 处），
  // 单调性不是该日志的不变量；篡改历史由快照对账（同行数聚合比对+行数倒退）负责。
  // gate-ok / gate-missing 行必须能与同 turn 的 behavior 判定对上（防伪造收口证据；ok-tool 回合同样落 gate-ok）
  for (const l of lines) {
    if (l.kind === 'gate-ok' && !behaviorByTurn.has(`${l.turn}:ok`) && !behaviorByTurn.has(`${l.turn}:ok-tool`) && !behaviorByTurn.has(`${l.turn}:ok-auto`)) v.push(`gate-ok turn=${l.turn} 无对应 behavior(gate=ok/ok-tool/ok-auto) 行——疑似植入/伪造`)
    if (l.kind === 'gate-missing' && !behaviorByTurn.has(`${l.turn}:missing`) && !behaviorByTurn.has(`${l.turn}:gate-fail`)) v.push(`gate-missing turn=${l.turn} 无对应 behavior(gate=missing/gate-fail) 行——疑似植入/伪造`)
  }
  const agg = aggregate(lines)
  if (agg.behavior.gateOk + agg.behavior.gateOkTool + agg.behavior.gateOkAuto + agg.behavior.gateFail + agg.behavior.gateMissing + agg.behavior.gateSkip !== agg.behavior.turns) v.push('behavior 六态计数之和 ≠ 总数')
  return v
}

function fmtReport(a) {
  const b = a.behavior
  const rate = (n, d) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`)
  return [
    `exec-log 聚合：${a.lines} 行 ${JSON.stringify(a.byKind)}`,
    `arm: A=${a.arm.A} B=${a.arm.B} C=${a.arm.C}`,
    `L3: 命中记录=${a.l3.detected} 拦截=${a.l3.intercepted}`,
    `behavior: 回合=${b.turns} 有文本=${b.hasText}｜复述 ${b.restated}/${b.hasText}=${rate(b.restated, b.hasText)}｜判级 ${b.levelDeclared}/${b.hasText}=${rate(b.levelDeclared, b.hasText)}`,
    `GATE 面: ok(旧文本面)=${b.gateOk} ok-tool=${b.gateOkTool} ok-auto=${b.gateOkAuto} gate-fail=${b.gateFail} missing=${b.gateMissing} skip=${b.gateSkip}｜qualified=${b.qualified} hollow=${b.hollow}`,
    `gate-tool 真值面: 调用=${a.gateTool.calls} pass=${a.gateTool.pass} honest-fail=${a.gateTool['honest-fail']} mismatch=${a.gateTool.mismatch} refused=${a.gateTool.refused} error=${a.gateTool.error} assertion-fail=${a.gateTool['assertion-fail']} channel-unavailable=${a.gateTool['channel-unavailable']}`,
  ].join('\n')
}

const args = parseArgs(process.argv.slice(2))
const { lines } = readLines(args.file)

if (args.mode === 'report') {
  const agg = aggregate(lines)
  if (args.json) console.log(JSON.stringify(agg))
  else console.log(fmtReport(agg))
  if (args.freeze) {
    writeFileSync(SNAPSHOT, JSON.stringify({ file: args.file, frozenAt: new Date().toISOString(), aggregate: agg }, null, 2))
    console.log(`\n[freeze] 快照已写 ${SNAPSHOT}`)
  }
  process.exit(0)
}

// --check 模式
const problems = [...checkWhitelist(lines), ...checkInvariants(lines)]
if (!args.noSnapshot) {
  if (existsSync(SNAPSHOT)) {
    const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
    const fresh = aggregate(lines)
    // 同文件比对：行数只允许增长（增长=新会话追加，合法；快照落后不算差错，只提示重新 freeze）
    if (snap.file === args.file && fresh.lines < snap.aggregate.lines) {
      problems.push(`行数倒退：快照=${snap.aggregate.lines} 实测=${fresh.lines}——疑似删改历史日志`)
    }
    if (snap.file === args.file && fresh.lines === snap.aggregate.lines && JSON.stringify(fresh) !== JSON.stringify(snap.aggregate)) {
      problems.push('同行数下聚合与冻结快照不一致——疑似篡改既有条目')
    }
  } else {
    problems.push(`快照缺失（${SNAPSHOT}）——先运行 --report --freeze 建立对账基线`)
  }
}
if (problems.length > 0) {
  console.error(`CHECK FAIL：${problems.length} 项违规`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`CHECK PASS：${lines.length} 行全部通过（白名单+不变量${args.noSnapshot ? '' : '+快照对账'}）`)
process.exit(0)
