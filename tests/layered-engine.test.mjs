// P6 F10 单测——渐进加载引擎（检测→注入：分节选道/装载 fail-closed/目标模式/目录提示）。
// 检测矩阵（2026-10-19 扩面）：缺口路径（判级+清单缺失）＋覆盖送达（判级正确进实质工作）＋目标模式（用户明示）＋压缩信号（F8）。
import {
  pickLayeredSectionsForLevel,
  pickSectionsForGapAttach,
  detectGoalModeIntent,
  buildLayeredDirHint,
  loadLayeredSection,
} from '../src/shisan-xinuo-core.ts'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

const L2F_SET = [
  'l2f-full-workflow.md',
  'requirements-challenge.md',
  'environment-inventory.md',
  'templates/plan-template.md',
  'templates/carrier-template.md',
]

// ── 判级→分节集映射（路由契约的机器面）──
t('map: L1=空集', [], pickLayeredSectionsForLevel('L1', 3))
t('map: L2-S→l2s', ['l2s-short-workflow.md'], pickLayeredSectionsForLevel('L2-S', 2))
t('map: L2-F→流程集（流程+质疑+盘点+两模板）', L2F_SET, pickLayeredSectionsForLevel('L2-F', 2))
t('map: L3→流程集+回滚模板', [...L2F_SET, 'templates/rollback-template.md'], pickLayeredSectionsForLevel('L3', 2))
t('map: hostLevel≥3→追加回滚模板（宁重勿轻）', [...L2F_SET, 'templates/rollback-template.md'], pickLayeredSectionsForLevel('L2-F', 3))
t('map: 低报重活（无自报 hostLevel≥2）→流程集', L2F_SET, pickLayeredSectionsForLevel(null, 2))
t('map: 无自报轻档（hostLevel<2）=空集', [], pickLayeredSectionsForLevel(null, 1))

// ── 缺口路径：仅清单缺失才附（判级单独缺失=先补判级不注分节）──
t('gap: 判级单独缺失=空集', [], pickSectionsForGapAttach({ needLevel: true, needChecklist: false }, null, 1))
t('gap: 两不需要=空集', [], pickSectionsForGapAttach({ needLevel: false, needChecklist: false }, null, 1))
t('gap: 清单缺失+L2-F→流程集', L2F_SET, pickSectionsForGapAttach({ needLevel: false, needChecklist: true }, 'L2-F', 2))
t('gap: 判级+清单缺失+L2-S→l2s', ['l2s-short-workflow.md'], pickSectionsForGapAttach({ needLevel: true, needChecklist: true }, 'L2-S', 2))

// ── 目标模式检测（防误开自主授权）──
t('goal: 命中-目标模式', true, detectGoalModeIntent('目标模式：把页面重构了'))
t('goal: 命中-无人值守', true, detectGoalModeIntent('无人值守，自行推进'))
t('goal: 命中-你决定', true, detectGoalModeIntent('小事你自己决定'))
t('goal: 未命中-普通任务', false, detectGoalModeIntent('帮我修一下这个页面的样式'))
t('goal: 未命中-按最优解走（歧义短语不收录）', false, detectGoalModeIntent('继继，按最优解走'))

// ── 分节目录提示（可达性修复）──
t('hint: 空目录=空串', '', buildLayeredDirHint([]))
{
  const hint = buildLayeredDirHint(['D:/a/layered', 'D:/b/layered'])
  t('hint: 含全部目录与路由表名', true, hint.includes('D:/a/layered') && hint.includes('D:/b/layered') && hint.includes('00-加载清单.md'))
  t('hint: 按优先序排列', true, hint.indexOf('D:/a/layered') < hint.indexOf('D:/b/layered'))
}

// ── 分节装载（fail-closed）──
{
  const dir = mkdtempSync(join(tmpdir(), 'xinuo-layered-'))
  try {
    const layered = join(dir, 'layered')
    mkdirSync(layered)
    writeFileSync(join(layered, 'l2s-short-workflow.md'), '# L2S 短工作流\n内容A')
    const ok = loadLayeredSection('l2s-short-workflow.md', layered, '# 回退\n内容B')
    t('load: 命中文件', { source: 'file', text: '# L2S 短工作流\n内容A' }, { source: ok.source, text: ok.text })
    const miss = loadLayeredSection('not-exist.md', layered, '# 回退\n内容B')
    t('load: 缺失→fail-closed 回退', { source: 'fallback', text: '# 回退\n内容B' }, { source: miss.source, text: miss.text })
    // 仓库真实分节
    const repoLayered = new URL('../content/layered/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
    const real = loadLayeredSection('compression-reload.md', repoLayered, '# 回退')
    t('load: 仓库真实分节装载（file 源）', 'file', real.source)
    t('load: 真实分节非空且有内容', true, real.text.length > 50)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

console.log(cases.join('\n'))
console.log(`\n=== layered-engine: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
