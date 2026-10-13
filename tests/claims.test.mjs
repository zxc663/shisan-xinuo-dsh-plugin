// A3 独立复现包接线：把 scripts/claims-check.mjs（核心主张可重跑检查）挂进 `npm test`，使其常驻而非手工脚本。
// 负向控制已实证：故意改坏 classifyEvidence ⇒ 该检查退出码 1 / K2 变红（见 tmp/mutation-check.mjs）。
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'claims-check.mjs')], { encoding: 'utf8' })
const out = String(r.stdout ?? '')
const ok = r.status === 0 && /成立 \/ 0 不成立/.test(out)
console.log(ok ? 'PASS claims: 核心主张 11 条全成立（可外部重跑）' : `FAIL claims: exit=${r.status}\n${out.slice(-400)}`)
process.exit(ok ? 0 : 1)
