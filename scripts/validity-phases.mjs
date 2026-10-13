#!/usr/bin/env node
// 强度矩阵跑批链：按阶段顺序调用 validity-run.mjs（每阶段可断点续跑——已完成的 arm×task 行会被跳过）。
// 阶段定义见 docs/design-specs/completion-signal-validity-plan-20261013.md §6.11／R9。
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const PHASES = [
  { name: 'h3-anchored', args: ['--arms=W,WE,S,SE', '--kinds=anchored'] },
  { name: 'h3-hard', args: ['--arms=W,WE,S,SE', '--kinds=hard'] },
  { name: 'h5f-hard', args: ['--arms=M,ME1,ME2', '--kinds=hard'] },
]

for (const p of PHASES) {
  console.log(`[phase] ${p.name} START ${new Date().toISOString()}`)
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'validity-run.mjs'), ...p.args], { cwd: REPO, stdio: 'inherit' })
  console.log(`[phase] ${p.name} EXIT=${r.status} ${new Date().toISOString()}`)
}
console.log('[phases] ALL DONE')
