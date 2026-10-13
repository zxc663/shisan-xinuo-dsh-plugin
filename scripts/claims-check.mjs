#!/usr/bin/env node
// A3 独立复现包（第一档）：把核心主张变成**外部可重跑**的检查——只需 Node（≥22.18，原生 TS 类型剥离），
// **不需要 DSH、不需要任何会话数据**。每条主张＝一句可证伪的陈述 + 一段驱动真实代码路径的检查。
// 用法：node scripts/claims-check.mjs ｜ 退出码：0=全部成立，1=有主张不成立。
import {
  judgeGateToolResult,
  classifyEvidence,
  gateRequirementBlock,
  failLadderPrefix,
  shouldSteerNow,
  hostLevelFromCall,
  levelRank,
  isVAnchored,
  judgeZeroToolClaim,
  buildGateToolDefinition,
} from '../src/shisan-xinuo-core.ts'

const results = []
const claim = (id, text, fn) => {
  let ok = false
  let detail = ''
  try {
    const r = fn()
    ok = r === true
    detail = r === true ? '' : String(r)
  } catch (e) {
    detail = 'threw: ' + String(e).slice(0, 120)
  }
  results.push({ id, text, ok, detail })
}

// 驱动器：用注入式 runCmd 驱动**真实**的 gate 工具流程（与生产同一份代码），无需任何宿主
const mkGate = (code) =>
  buildGateToolDefinition({
    runCmd: async () => ({ code, stdout: '', stderr: '', timedOut: false }),
    log: () => {},
    onStats: () => {},
    acceptance: { list: () => [], register: () => ({ count: 0 }), clear: () => {}, markPassed: () => {}, evaluate: () => ({ ok: true }) },
  })

claim('K1', '三态：claimed≠real ⇒ mismatch；一致且非零 ⇒ honest-fail；一致且 0 ⇒ pass', () => {
  const a = judgeGateToolResult(0, 1).verdict
  const b = judgeGateToolResult(1, 1).verdict
  const c = judgeGateToolResult(0, 0).verdict
  return a === 'mismatch' && b === 'honest-fail' && c === 'pass' ? true : `got ${a}/${b}/${c}`
})

claim('K2', '弱证据（无检查类算子）⇒ classifyEvidence=weak；强证据（Test-Path 等）⇒ strong', () => {
  return classifyEvidence('cd D:\\') === 'weak' && classifyEvidence('if (Test-Path "D:\\a") { exit 1 } else { exit 0 }') === 'strong'
    ? true
    : 'classifyEvidence 判定不符'
})

claim('K3', '通过 ≠ 闭环：弱证据且无登记断言时 status=pass 但 closed=false（端到端驱动 gate 流程）', async () => true)
// 注：K3 需要 await，单独处理（见下）
results.pop()

claim('K4', '失败返回带"要求结构"：含算子白名单与目标锚提示', () => {
  const s = gateRequirementBlock([], 'echo ok', 'mismatch')
  return s.includes('not_exists') && s.includes('discipline_task') ? true : '要求结构缺字段'
})

claim('K5', '失败阶梯：n=1 无前缀／n=2 只收算子／n≥3 停止试凑', () => {
  return failLadderPrefix(1) === '' && failLadderPrefix(2).includes('不再接受自由命令形态') && failLadderPrefix(3).includes('停止试凑')
    ? true
    : '阶梯形态不符'
})

claim('K6', '跨回合熔断：未达上限可打断；触顶放行；非法 cap 保守不熔断', () => {
  return shouldSteerNow(0, 3) && shouldSteerNow(2, 3) && !shouldSteerNow(3, 3) && shouldSteerNow(9, 0) ? true : '熔断判定不符'
})

claim('K7', '判级去自报化：宿主按"工具名＋命令"推等级（写类工具=L2；judge 命中=L3；只读=L1）', () => {
  return hostLevelFromCall('write', '') === 'L2' && hostLevelFromCall('pwsh', 'rm -rf D:\\x', () => '数据删除') === 'L3' && hostLevelFromCall('read', '') === 'L1'
    ? true
    : '宿主判级不符'
})

claim('K8', '描述锚定可见性：泛描述未锚定（真实轨迹样本）；含路径/算子/检查动词=锚定', () => {
  return isVAnchored('验证仓库类型分析结果') === false && isVAnchored('not_exists: D:\\a') === true ? true : '锚定判定不符'
})

claim('K9', '零工具调用声称完成可被检出；诚实阻塞不误报', () => {
  return judgeZeroToolClaim('文件已成功删除，任务完成。') === true && judgeZeroToolClaim('无法完成：工具被拒绝，任务未完成。') === false ? true : '检出判定不符'
})

claim('K10', '等级序：L1 < L2-S ≈ L2-F < L3；未声明为最低', () => {
  return levelRank('L1') < levelRank('L2-S') && levelRank('L2-F') < levelRank('L3') && levelRank('') === 0 ? true : '等级序不符'
})

// K3（异步）：端到端驱动 —— 弱证据通过但不闭环
{
  const gate = mkGate(0)
  const r = await gate.execute({ level: 'L1', v: 'x', cmd: 'cd D:\\', claimedExit: 0 }, {})
  results.push({
    id: 'K3',
    text: '通过 ≠ 闭环：弱证据且无断言 ⇒ status=pass 且 closed=false（端到端驱动）',
    ok: r.status === 'pass' && r.closed === false,
    detail: r.status === 'pass' && r.closed === false ? '' : `status=${r.status} closed=${String(r.closed)}`,
  })
  const gate2 = mkGate(0)
  const r2 = await gate2.execute({ level: 'L1', v: 'x', cmd: 'if (Test-Path "D:\\a") { exit 1 } else { exit 0 }', claimedExit: 0 }, {})
  results.push({
    id: 'K11',
    text: '强证据 ⇒ 闭环（closed=true）',
    ok: r2.closed === true,
    detail: r2.closed === true ? '' : `closed=${String(r2.closed)}`,
  })
}

const pad = (s, n) => String(s).padEnd(n)
console.log('核心主张可重跑检查（不依赖 DSH／不需要会话数据）\n')
console.log(pad('编号', 6) + pad('结论', 5) + '主张')
for (const r of results.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))) {
  console.log(pad(r.id, 6) + pad(r.ok ? 'PASS' : 'FAIL', 5) + r.text + (r.ok ? '' : `  ← ${r.detail}`))
}
const bad = results.filter((r) => !r.ok).length
console.log(`\n合计 ${results.length} 条主张：${results.length - bad} 成立 / ${bad} 不成立`)
process.exit(bad === 0 ? 0 : 1)
