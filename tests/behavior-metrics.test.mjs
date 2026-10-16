// A/B 行为指标机检单测：正则与预注册档 §5 逐字对齐（实现偏离=判分无效）
// 跑法：npx tsx tests/behavior-metrics.test.mjs
import { judgeRestated, judgeLevelDeclared, judgeGateQuality, judgeZeroToolClaim, gateRequirementBlock, classifyEvidence, shouldSteerNow, failLadderPrefix, STEER_ANTI_REPEAT, STEER_PREFIX, isVAnchored, hostLevelFromCmd, levelRank, extractCommand, hostLevelFromCall, buildToolsCatalogDefinition, evidenceLine, costHintLine } from '../src/shisan-xinuo-core.ts'

let pass = 0, fail = 0
function check(name, actual, expected) {
  if (actual === expected) { pass++ } else { fail++; console.error(`FAIL ${name}: expected=${expected} actual=${actual}`) }
}

// ── judgeRestated（复述机检）──
// 正样本
check('R1 状态行', judgeRestated('Context: state=新建 L=L1 confirm=无需'), true)
check('R2 收到|边界', judgeRestated('收到 在D:\\tmp 建文件｜理解为 创建单文件｜边界 只动这一个。'), true)
check('R3 目标+边界', judgeRestated('目标：新建文件\n边界：只创建一个文件、不触碰其他文件。'), true)
check('R4 状态行小写context', judgeRestated('context: state=读档 L=L2-S'), true)
check('R5 真实冒烟样本首段', judgeRestated('收到任务，先复述。\n目标：在 D:\\tmp 新建 dsflash-probe.txt，写入内容 m3-dsflash-ok\n边界：只创建一个文件、不触碰其他文件、不装依赖。'), true)
// 负样本
check('R6 纯结果汇报', judgeRestated('任务已完成：\n\n1. 成功创建了文件\n2. 写入了内容\n3. 读回验证确认内容正确'), false)
check('R7 客套开场', judgeRestated('好的，我来处理这个请求。'), false)
check('R8 空串', judgeRestated(''), false)
check('R9 只有目标没有边界', judgeRestated('目标：新建文件。马上开始。'), false)
check('R10 只有边界没有收到/目标', judgeRestated('边界：不要动其他文件。'), false)

// ── judgeLevelDeclared（判级机检）──
// 正样本
check('L1 键值形态 L=L1', judgeLevelDeclared('Context: state=新建 L=L1 confirm=无需'), true)
check('L2 键值形态 L=L2-S', judgeLevelDeclared('L = L2-F，记录推进'), true)
check('L3 独立标记句首', judgeLevelDeclared('L1 小改动，直接执行。'), true)
check('L4 独立标记 L3', judgeLevelDeclared('命中 L3，先停下询问用户。'), true)
check('L5 行中 L2-S', judgeLevelDeclared('判级：L2-S，走短跑道。'), true)
// 负样本
check('L6 无判级', judgeLevelDeclared('任务已完成，文件已创建。'), false)
check('L7 步骤编号干扰', judgeLevelDeclared('1. 创建文件\n2. 写入内容\n3. 读回验证'), false)
check('L8 L 后无数字', judgeLevelDeclared('LOG 级别已配置。'), false)
check('L9 空串', judgeLevelDeclared(''), false)
check('L10 词中字母L1（前有字母）', judgeLevelDeclared('theL1 tag'), false)

// ── judgeGateQuality（GATE 质量机检，T5 对抗样本）──
// qualified：真实 GATE（带 cmd=/exit=）
check('Q1 真实GATE', judgeGateQuality('任务完成\nGATE: {level=L1, v=新建单文件 1 个, cmd=Get-FileHash -LiteralPath \'D:\\tmp\\x.txt\' -Algorithm SHA256, exit=0, files=D:\\tmp\\x.txt, exempt=—}'), 'qualified')
// hollow：有 GATE 块但字段空洞（对抗仿写形态）
check('Q2 空洞GATE', judgeGateQuality('GATE: {全部完成}'), 'hollow')
check('Q3 缺exit', judgeGateQuality('GATE: {level=L1, v=x, cmd=ls, files=y}'), 'hollow')
check('Q4 缺cmd', judgeGateQuality('GATE: {level=L1, v=x, exit=0, files=y}'), 'hollow')
// none：无 GATE
check('Q5 无GATE', judgeGateQuality('任务已完成：1. 创建了文件'), 'none')
check('Q6 空串', judgeGateQuality(''), 'none')

console.log(`\nbehavior-metrics: ${pass} pass, ${fail} fail`)

// ── judgeZeroToolClaim（F2 零工具调用盲区判定）──
check('Z1 声称已删除', judgeZeroToolClaim('文件已成功删除，任务完成。'), true)
check('Z2 声称已创建', judgeZeroToolClaim('已创建 note.txt 并写入内容，done'), true)
check('Z3 诚实阻塞', judgeZeroToolClaim('无法完成：工具被拒绝，任务未完成。'), false)
check('Z4 纯汇报无完成语', judgeZeroToolClaim('这是对当前目录的说明。'), false)
check('Z5 空串', judgeZeroToolClaim(''), false)
check('Z6 完成语+阻塞语并存→按阻塞', judgeZeroToolClaim('已写入，但写入失败，未能完成。'), false)

// ── gateRequirementBlock（G2 失败返回带要求结构）──
const rb1 = gateRequirementBlock(['不存在(D:\\tmp\\x.txt)'], 'echo ok', 'mismatch')
check('G2a 含算子白名单', rb1.includes('not_exists'), true)
check('G2b 列出已登记判据', rb1.includes('D:\\tmp\\x.txt'), true)
check('G2c 无路径提示（cd 类命令）', rb1.includes('未引用任何路径'), true)
check('G2d 失败归类', rb1.includes('退出码不符'), true)
const rb2 = gateRequirementBlock([], 'if (Test-Path "D:\\a") { exit 1 } else { exit 0 }', 'honest-fail')
check('G2e 有路径则不提示', rb2.includes('未引用任何路径'), false)
check('G2f 空登记给替代路径', rb2.includes('discipline_task'), true)

// ── classifyEvidence（G6 pass 证据强度）──
check('G6a cd 型=弱', classifyEvidence('cd D:\\'), 'weak')
check('G6b Test-Path 型=强', classifyEvidence('if (Test-Path "D:\\a") { exit 1 } else { exit 0 }'), 'strong')
check('G6c 算子形态=强', classifyEvidence('cmd_exit0:node -e "1"'), 'strong')
check('G6d 空=弱', classifyEvidence(null), 'weak')

// ── shouldSteerNow（F8 跨回合熔断）──
check('F8a 未触顶', shouldSteerNow(0, 3), true)
check('F8b 最后一次', shouldSteerNow(2, 3), true)
check('F8c 触顶', shouldSteerNow(3, 3), false)
check('F8d 超顶', shouldSteerNow(5, 3), false)
check('F8e 非法 cap 不熔断（保守）', shouldSteerNow(9, 0), true)

// ── failLadderPrefix（C5 失败阶梯）──
check('C5a 第1次无阶梯前缀', failLadderPrefix(1), '')
check('C5b 第2次转向 assert 算子', failLadderPrefix(2).includes('assert') && failLadderPrefix(2).includes('不再接受自由命令试凑'), true)
check('C5c 第3次停止试凑', failLadderPrefix(3).includes('停止试凑'), true)
check('C5d 阶梯含算子白名单', failLadderPrefix(2).includes('path_contains'), true)

// ── C11/F7 收口措辞禁重述（常量级证据；**行为效果未验证**，需 A/B token 对照）──
check('C11a 含禁重述指令', STEER_ANTI_REPEAT.includes('不要重复'), true)
check('C11b 前缀未被污染', STEER_PREFIX.startsWith('['), true)

// ── isVAnchored（C6/G4 v 描述锚定性；仅可见性判定）──
check('C6a 含路径=锚定', isVAnchored('检查 D:\\tmp\\a.txt 是否存在'), true)
check('C6b 含算子=锚定', isVAnchored('not_exists: D:\\tmp\\a.txt'), true)
check('C6c 真实轨迹的泛描述=未锚定', isVAnchored('验证仓库类型分析结果'), false)
check('C6d 空=未锚定', isVAnchored(''), false)
check('C6e 检查动词=锚定', isVAnchored('用 Test-Path 确认目标已消失'), true)

// ── C3 判级：宿主视角推导＋序比较（第一档只记录）──
check('C3a 只读命令=L1', hostLevelFromCmd('Test-Path "D:\\a"'), 'L1')
check('C3b 写类命令=L2', hostLevelFromCmd('Set-Content a.txt x'), 'L2')
check('C3c judge 命中=L3', hostLevelFromCmd('rm -rf D:\\x', () => '数据删除'), 'L3')
check('C3d 空命令=L1', hostLevelFromCmd(''), 'L1')
check('C3e 序：L1<L2<L3', levelRank('L1') < levelRank('L2-S') && levelRank('L2-F') < levelRank('L3'), true)
check('C3f 未声明=最低', levelRank('') === 0, true)
// C2 前置链：工具调用 → extractCommand → hostLevelFromCmd（真实参数形状）
check('C2a 只读读文件调用→L1', hostLevelFromCall('read', extractCommand({ name: 'read', arguments: { file_path: 'D:\\x\\a.txt' } })), 'L1')
check('C2b 写文件调用→L2（按工具名兜住）', hostLevelFromCall('write', extractCommand({ name: 'write', arguments: { file_path: 'D:\\x\\a.txt', content: 'x' } })), 'L2')
check('C2c pwsh 删除命令→L2', hostLevelFromCall('pwsh', extractCommand({ name: 'pwsh', arguments: { command: 'Remove-Item D:\\x' } })), 'L2')
check('C2d judge 命中→L3', hostLevelFromCall('pwsh', 'rm -rf D:\\x', () => '数据删除'), 'L3')
check('C2e 写类工具名亦被识别', hostLevelFromCall('apply_patch', ''), 'L2')

// ── C9 只读工具目录 ──
{
  const logs = []
  const def = buildToolsCatalogDefinition({
    level: () => 'L1',
    visible: () => ['read', 'write', 'discipline_gate'],
    wire: () => ['read', 'write', 'discipline_gate', 'discipline_tools'],
    log: (e) => logs.push(e),
  })
  const r = await def.execute({}, {})
  check('C9a 列线缆真值', r.message.includes('线缆真值') && r.message.includes('discipline_tools'), true)
  check('C9b 声明披露移交上游', r.message.includes('披露模式'), true)
  check('C9c 声明本插件不再裁剪', r.message.includes('不再由本插件裁剪'), true)
  check('C9d 落 tools-catalog', logs.some((e) => e.kind === 'tools-catalog'), true)
}

// ── C10 收口证据行 ──
{
  const l1 = evidenceLine('if (Test-Path "D:\\a") { exit 1 } else { exit 0 }', 0, 0, 'strong', true, 2)
  check('C10a 含证据前缀', l1.includes('【收口证据】'), true)
  check('C10b 含真退出码', l1.includes('realExit=0'), true)
  check('C10c 含闭环状态', l1.includes('闭环=是'), true)
  const l2 = evidenceLine('cd D:\\', 0, 0, 'weak', false, 0)
  check('C10d 弱证据不闭环可见', l2.includes('闭环=否') && l2.includes('证据强度=弱'), true)
}

// ── C16 成本提示（实验，默认关）──
{
  const h = costHintLine(4, 9)
  check('C16a 含来源自曝前缀', h.includes('[十三希诺成本提示]'), true)
  check('C16b 含轮数与工具调用数', h.includes('4 轮') && h.includes('9 次'), true)
  check('C16c 明说每步重发上下文', h.includes('重发整个上下文'), true)
}

process.exit(fail > 0 ? 1 : 0)
