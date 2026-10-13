#!/usr/bin/env node
// 强度矩阵跑批链：按阶段顺序调用 validity-run.mjs（每阶段可断点续跑——已完成的 arm×task 行会被跳过）。
// 阶段定义见 docs/design-specs/completion-signal-validity-plan-20261013.md §6.11／R9。
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const PHASES = [
  // 2026-10-13 重排（R10）：魔搭配额耗尽 ⇒ 多档矩阵暂停（避免继续产出废行）。
  // 本链只跑免费档可完成的部分；多档矩阵待配额恢复后手动续跑（已完成行会被跳过）：
  //   node scripts/validity-run.mjs --arms=W,WE,S,SE --kinds=anchored
  //   node scripts/validity-run.mjs --arms=W,WE,S,SE --kinds=hard
  //   node scripts/validity-run.mjs --arms=M,ME1,ME2 --kinds=hard
  // M 的锚定段与既有 P 臂同构（同为 NO_ASSERT+pinned+flash），跳过以免重复占额度
  { name: 'h5-flash-hard', args: ['--arms=M,ME3', '--kinds=hard'] },
  { name: 'h5-flash-anchored-me3', args: ['--arms=ME3', '--kinds=anchored'] },
]

for (const p of PHASES) {
  console.log(`[phase] ${p.name} START ${new Date().toISOString()}`)
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'validity-run.mjs'), ...p.args], { cwd: REPO, stdio: 'inherit' })
  console.log(`[phase] ${p.name} EXIT=${r.status} ${new Date().toISOString()}`)
}
console.log('[phases] ALL DONE')
