// 决策 2（2026-10-16）：宿主默认判据·窄版（仅物理副作用）——单测
// 覆盖：① 写类/删除类工具 → exists/not_exists；② 命令类**只认删除**且必须过 B2.1 误阻守卫；
//      ③ 正文/只读工具不产出（防把正文里的路径当目标）；④ 去重与量化；
//      ⑤ 与真值评估器在真文件系统上联动（可证伪：文件删了断言就该翻）；⑥ 测试自身负向控制。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deriveEffectAssertions,
  evaluateAssertion,
  firstAbsolutePath,
  observeEffect,
} from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
// 判定函数单独抽出：负向控制要打的正是这条（t 与自检共用同一 predicate，避免"自检测了别的函数"）
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const t = (name, expected, actual) => {
  if (same(expected, actual)) pass++
  else {
    fail++
    console.error(`FAIL ${name}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)
  }
}

const dir = mkdtempSync(join(tmpdir(), 'ea-'))
const p1 = join(dir, 'a.txt')
const p2 = join(dir, 'del-me.txt')
const other = join(dir, 'other.txt')

// ── 路径抽取 ──
t('引号内绝对路径可抽', p1, firstAbsolutePath(`see "${p1}" please`))
t('裸绝对路径可抽', p1, firstAbsolutePath(`rm -f ${p1}`))
t('通配路径不抽（不是确定目标）', null, firstAbsolutePath(join(dir, '*.txt')))
t('相对路径不抽', null, firstAbsolutePath('./a.txt'))

// ── 写/删类工具 ──
t('write 路径键优先、正文里的路径不算目标', { kind: 'exists', target: p1 },
  observeEffect('write', { file_path: p1, content: `本文件引用了 ${other}` }))
t('apply_patch 记 exists', { kind: 'exists', target: p1 }, observeEffect('apply_patch', { path: p1 }))
t('mkdir 记 exists', { kind: 'exists', target: dir }, observeEffect('mkdir', { path: dir }))
t('delete 类工具记 not_exists', { kind: 'not_exists', target: p1 }, observeEffect('delete_file', { path: p1 }))
t('只读工具不产出', null, observeEffect('read', { path: p1 }))
t('未知工具不产出（保守不派生）', null, observeEffect('web_search', { path: p1 }))
t('无参不产出', null, observeEffect('write', {}))
// 真机形态：会话日志实证 `tool/call.arguments` 是 **JSON 字符串**（本轮端到端实测踩到——单测用对象形态曾漏掉）
t('真机形态①：arguments 为 JSON 串（write）', { kind: 'exists', target: p1 },
  observeEffect('write', JSON.stringify({ file_path: p1, content: 'ok' })))
t('真机形态②：arguments 为 JSON 串（shell 删除）', { kind: 'not_exists', target: p2 },
  observeEffect('pwsh', JSON.stringify({ command: `Remove-Item "${p2}" -Force` })))
t('真机形态③：裸命令串（非 JSON）', { kind: 'not_exists', target: p2 },
  observeEffect('pwsh', `Remove-Item "${p2}" -Force`))
t('坏 JSON 串不产出（不猜）', null, observeEffect('write', '{"file_path":'))

// ── 命令类：只认删除 + 守卫 ──
t('Remove-Item 记 not_exists', { kind: 'not_exists', target: p2 },
  observeEffect('pwsh', { command: `Remove-Item "${p2}" -Force` }))
t('只读命令不产出', null, observeEffect('pwsh', { command: `Get-ChildItem "${dir}"` }))
t('否定语境不产出（"不要删除"）', null, observeEffect('pwsh', { command: `Write-Output "不要删除 ${p2}"` }))
t('备份语境不产出', null, observeEffect('pwsh', { command: `# 备份流程：先复制再删除\nRemove-Item "${p2}" -Force` }))
t('恢复语境不产出', null, observeEffect('pwsh', { command: `# 恢复演练\nRemove-Item "${p2}" -Force` }))
t('举例语境不产出', null, observeEffect('pwsh', { command: `# 举例\nRemove-Item "${p2}" -Force` }))
t('通配删除不产出', null, observeEffect('pwsh', { command: `Remove-Item "${dir}\\*.txt" -Force` }))
t('目录内容类不产出', null, observeEffect('pwsh', { command: `# 删除下的文件\nRemove-Item "${p2}" -Force` }))
t('命令类不派生 cmd_exit0（禁"跑一条命令凑收口"）', 'not_exists',
  observeEffect('pwsh', { command: `Remove-Item "${p2}" -Force` }).kind)

// ── 派生：去重 / 终态优先 / 量化 ──
t('同目标去重', 1, deriveEffectAssertions([{ kind: 'exists', target: p1 }, { kind: 'exists', target: p1 }]).length)
t('先建后删 → 取 not_exists（终态口径）', 'not_exists',
  deriveEffectAssertions([{ kind: 'exists', target: p1 }, { kind: 'not_exists', target: p1 }])[0].kind)
t('先删后建 → 取 not_exists（终态口径，删除是更强的落地证据）', 'not_exists',
  deriveEffectAssertions([{ kind: 'not_exists', target: p1 }, { kind: 'exists', target: p1 }])[0].kind)
t('量化上限 4', 4, deriveEffectAssertions([1, 2, 3, 4, 5, 6].map((i) => ({ kind: 'exists', target: join(dir, `f${i}.txt`) }))).length)
t('空集不产出', 0, deriveEffectAssertions([]).length)

// ── 与真值评估器联动（真文件系统，可证伪）──
writeFileSync(p1, 'x')
const eff = observeEffect('write', { file_path: p1, content: 'x' })
t('文件在 → exists 断言过', true, (await evaluateAssertion(deriveEffectAssertions([eff])[0])).ok)
rmSync(p1)
t('文件被删 → 同一断言翻为不过（证明断言真的在测外部事实）', false,
  (await evaluateAssertion(deriveEffectAssertions([eff])[0])).ok)
const delEff = observeEffect('pwsh', { command: `Remove-Item "${p2}" -Force` })
writeFileSync(p2, 'y')
t('目标仍在 → not_exists 断言不过', false, (await evaluateAssertion(deriveEffectAssertions([delEff])[0])).ok)
rmSync(p2)
t('目标已删 → not_exists 断言过', true, (await evaluateAssertion(deriveEffectAssertions([delEff])[0])).ok)

// ── 负向控制：证明本套件的判定函数对"不相等"确实会红（不打噪声日志）──
t('负向控制 1：相等判据对相同值返回真', true, same('A', 'A'))
t('负向控制 2：相等判据对不等值返回假（改坏必红）', false, same('A', 'B'))

rmSync(dir, { recursive: true, force: true })
console.log(`effect-assert: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
