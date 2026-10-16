// 批4 方向 B：运行时工具裁剪（budget/mask 层）退役回归——
// ①核心不再导出裁剪符号（防退役不彻底/回潮）②目录工具改为如实报线缆真值＋声明披露移交上游。
import * as core from '../src/shisan-xinuo-core.ts'
import { buildToolsCatalogDefinition } from '../src/shisan-xinuo-core.ts'

let fail = 0
const check = (label, cond) => { if (!cond) { fail++; console.log('FAIL ' + label) } }

// ① 退役符号必须不再导出（回潮即红）
for (const sym of ['maskLeak', 'loadBudgetFile', 'completeAllowList', 'BUDGET_ALWAYS_ALLOW', 'BudgetMask']) {
  check(`退役符号 ${sym} 不再导出`, !(sym in core))
}

// ② 目录工具新语义：如实报线缆真值 + 声明披露移交上游 + 不再自称裁剪
{
  const logs = []
  const def = buildToolsCatalogDefinition({
    level: () => '自报=L1（仅观测）；预算=不裁剪（披露=上游 tool-search）',
    visible: () => ['read', 'write'],
    wire: () => ['read', 'write', 'glob'],
    log: (e) => logs.push(e),
  })
  const r = await def.execute({}, {})
  check('目录报线缆真值', r.message.includes('线缆真值') && r.message.includes('glob'))
  check('目录声明披露模式', r.message.includes('披露模式'))
  check('目录声明不再由本插件裁剪', r.message.includes('不再由本插件裁剪'))
  check('目录不含已退役的漏网行', !r.message.includes('预算漏网核对'))
  check('目录落 tools-catalog', logs.some((e) => e.kind === 'tools-catalog'))
}

console.log(fail === 0 ? 'ALL PASS (toolface-retired)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
