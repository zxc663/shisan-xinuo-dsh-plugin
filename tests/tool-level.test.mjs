// 工具等级映射回归（批3 方向 A）：已知只读→L1、写类→L2、shell→按命令、未知→保守 L2。
import { hostLevelFromCall } from '../src/shisan-xinuo-core.ts'

let fail = 0
const check = (label, got, want) => { if (got !== want) { fail++; console.log(`FAIL ${label}: got=${got} want=${want}`) } }

// 已知只读 → L1
for (const t of ['read', 'glob', 'grep', 'read_image', 'web_search', 'web_fetch', 'skill', 'list_agents', 'get_goal', 'job_list', 'job_output', 'discipline_gate', 'discipline_tools']) {
  check(`只读 ${t}`, hostLevelFromCall(t, ''), 'L1')
}
// 写类 → L2
for (const t of ['write', 'edit', 'apply_patch']) check(`写类 ${t}`, hostLevelFromCall(t, ''), 'L2')
// shell → 按命令
check('shell 只读命令', hostLevelFromCall('pwsh', 'Test-Path "D:\\a"'), 'L1')
check('shell 写命令', hostLevelFromCall('pwsh', 'Set-Content a.txt x'), 'L2')
check('shell L3 命中', hostLevelFromCall('pwsh', 'rm -rf D:\\x', () => '数据删除'), 'L3')
// 未知工具 → 保守 L2（批3 方向 A 核心）
for (const t of ['todo_write', 'create_goal', 'update_goal', 'send_message', 'interrupt_agent', 'job_kill', 'exit_plan_mode', 'subagent', 'subagent_fork', 'workflow', 'discipline_task', 'brand_new_tool_xyz']) {
  check(`未知/状态类 ${t} → 保守 L2`, hostLevelFromCall(t, ''), 'L2')
}
// 无名但有命令 → 退回按命令推导
check('无名+只读命令', hostLevelFromCall('', 'Test-Path "D:\\a"'), 'L1')
check('无名+写命令', hostLevelFromCall('', 'Set-Content a.txt x'), 'L2')

console.log(fail === 0 ? 'ALL PASS (tool-level)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
