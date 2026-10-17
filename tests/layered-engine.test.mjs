// P6 F10 单测——渐进加载引擎（检测→注入：layered 分节装载 fail-closed＋触发映射）。
// 三检测点（F1 判级缺失/F2 清单缺失/F8 压缩信号）共用；注入目标=layered 对应分节。
import {
  pickLayeredSectionForGap,
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

// ── 触发→分节映射（路由契约的机器面）──
t('map: 判级缺失=null（先补判级不注分节——判级未知无法选道）', null, pickLayeredSectionForGap({ needLevel: true, needChecklist: false }))
t('map: L2-F 清单缺失→l2f', 'l2f-full-workflow.md', pickLayeredSectionForGap({ needLevel: false, needChecklist: true, declaredLevel: 'L2-F' }))
t('map: L3→l2f', 'l2f-full-workflow.md', pickLayeredSectionForGap({ needLevel: false, needChecklist: true, declaredLevel: 'L3' }))
t('map: L2-S→l2s', 'l2s-short-workflow.md', pickLayeredSectionForGap({ needLevel: false, needChecklist: true, declaredLevel: 'L2-S' }))
t('map: 低报重活（hostLevel≥2 无自报）→l2f（宁重勿轻）', 'l2f-full-workflow.md', pickLayeredSectionForGap({ needLevel: false, needChecklist: true, declaredLevel: null, hostLevel: 2 }))
t('map: 两不需要=null', null, pickLayeredSectionForGap({ needLevel: false, needChecklist: false }))

// ── 分节装载（fail-closed）──
{
  const dir = mkdtempSync(join(tmpdir(), 'xinuo-layered-'))
  try {
    const layered = join(dir, 'layered')
    mkdirSync(layered)
    writeFileSync(join(layered, 'l2s-short-workflow.md'), '# L2S 短工作流\n内容A')
    const ok = loadLayeredSection('l2s-short-workflow.md', layered, '# 回退\n内容B')
    t('load: 命中文件', { source: 'file', text: '# L2S 短工作流\n内容A' }, ok)
    const miss = loadLayeredSection('not-exist.md', layered, '# 回退\n内容B')
    t('load: 缺失→fail-closed 回退', { source: 'fallback', text: '# 回退\n内容B' }, miss)
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
