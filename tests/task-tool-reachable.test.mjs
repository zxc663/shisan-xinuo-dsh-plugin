// P2 护栏：`discipline_task` 必须**默认可达**——它的注册只受 `SHISANUO_NO_ASSERT=1`（研究模式）门控，
// 不得再被推导层的 `ASSERT_LAYER` 默认关牵连。
// 由体验缺口引入（2026-10-14）：断言的三个来源里，模型自登记那条此前在默认配置下根本不可达，
// 于是"判据只能来自启发式推导或会话外钉死"，模型自己修不了判据 = 一条死路。
// 本套件是**结构护栏**：读注册点源码判定，若谁把它重新挂回 ASSERT_LAYER，这里直接红。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = readFileSync(join(REPO, 'src', 'shisan-xinuo-core.ts'), 'utf8')

// 判据：某个「注册纪律任务工具」的守卫行只提 NO_ASSERT、不提 ASSERT_LAYER
export const taskGuardOk = (guardLine, bodyLine) =>
  /SHISANUO_NO_ASSERT\s*!==\s*'1'/.test(guardLine) && !/ASSERT_LAYER/.test(guardLine) && /buildTaskToolDefinition/.test(bodyLine)

let fail = 0
const lines = SRC.split('\n')
const guardIdx = lines.findIndex((l) => /SHISANUO_NO_ASSERT\s*!==\s*'1'/.test(l) && /if\s*\(/.test(l))
const ok = guardIdx >= 0 && taskGuardOk(lines[guardIdx], lines.slice(guardIdx, guardIdx + 5).join('\n'))
console.log(ok
  ? `PASS task-tool: 注册守卫仅由 NO_ASSERT 把关、且确实注册 discipline_task（L${guardIdx + 1}）`
  : `FAIL task-tool: 未找到合格守卫（guardIdx=${guardIdx}）；P2 可能被重新挂回 ASSERT_LAYER`)
if (!ok) fail++

// 判据自测（负向控制）：旧形态（ASSERT_LAYER 门控）必须被判为不合格，否则护栏形同虚设
const oldGuard = "if (ASSERT_LAYER && process.env.SHISANUO_NO_ASSERT !== '1') {"
const neg = taskGuardOk(oldGuard, 'const taskDef = buildTaskToolDefinition({})') === false
const neg2 = taskGuardOk("if (process.env.SHISANUO_NO_ASSERT !== '1') {", 'const x = 1') === false
console.log(neg && neg2 ? 'PASS task-tool: 判据自测——ASSERT_LAYER 门控／未注册工具的样本均判不合格' : `FAIL task-tool: 判据自测失效（旧形态=${!neg} 无注册=${!neg2}）`)
if (!(neg && neg2)) fail++

process.exit(fail > 0 ? 1 : 0)
