// A/B 行为指标机检单测：正则与预注册档 §5 逐字对齐（实现偏离=判分无效）
// 跑法：npx tsx tests/behavior-metrics.test.mjs
import { judgeRestated, judgeLevelDeclared, judgeGateQuality, judgeZeroToolClaim, gateRequirementBlock, classifyEvidence, shouldSteerNow, failLadderPrefix, STEER_ANTI_REPEAT, STEER_PREFIX } from '../src/shisan-xinuo-core.ts'

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
check('C5b 第2次只收算子', failLadderPrefix(2).includes('不再接受自由命令形态'), true)
check('C5c 第3次停止试凑', failLadderPrefix(3).includes('停止试凑'), true)
check('C5d 阶梯含算子白名单', failLadderPrefix(2).includes('path_contains'), true)

// ── C11/F7 收口措辞禁重述（常量级证据；**行为效果未验证**，需 A/B token 对照）──
check('C11a 含禁重述指令', STEER_ANTI_REPEAT.includes('不要重复'), true)
check('C11b 前缀未被污染', STEER_PREFIX.startsWith('['), true)

process.exit(fail > 0 ? 1 : 0)
