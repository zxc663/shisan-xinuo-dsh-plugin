// 批1 接线（2026-10-16）：把 tests/review-claims-check.mjs 带退出码地接入 `npm test`，
// 并以负向控制常驻把关：正常模式必须 exit 0；`--expect-fail` 注入合成误拦后必须 exit 1。
// 若有人把该检查改回"恒 exit 0"或移除退出码，本套件立即变红。
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(REPO, 'tests', 'review-claims-check.mjs')
const normal = spawnSync(process.execPath, [script], { encoding: 'utf8' })
const forced = spawnSync(process.execPath, [script, '--expect-fail'], { encoding: 'utf8' })

const normalOk = normal.status === 0
const forcedOk = forced.status === 1
console.log(`review-claims wiring: normal exit=${normal.status} (want 0) | --expect-fail exit=${forced.status} (want 1)`)
if (!normalOk) console.log('normal stdout tail:', String(normal.stdout ?? '').slice(-400), String(normal.stderr ?? '').slice(-200))
if (!forcedOk) console.log('forced stdout tail:', String(forced.stdout ?? '').slice(-400))
console.log(normalOk && forcedOk ? 'PASS review-claims-wiring' : 'FAIL review-claims-wiring')
process.exit(normalOk && forcedOk ? 0 : 1)
