// 审计 F-04 机检：引擎写入的 log kind 必须全部在 tally 白名单内（防"写入面/对账面"再次脱节）。
// 运行：node tests/tally-whitelist.test.mjs
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/shisan-xinuo-core.ts', import.meta.url), 'utf8')
const tally = readFileSync(new URL('../scripts/tally.mjs', import.meta.url), 'utf8')

const kinds = [...new Set([...src.matchAll(/log\(\{\s*kind:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]))].sort()

const start = tally.indexOf('const FIELD_WHITELIST')
const end = tally.indexOf('\n}', start)
const block = tally.slice(start, end)
const wl = new Set([...block.matchAll(/^\s{2}(?:'([a-z0-9-]+)'|([a-z0-9-]+)):\s*\[/gm)].map((m) => m[1] ?? m[2]))

let pass = 0
let fail = 0
for (const k of kinds) {
  if (wl.has(k)) pass++
  else { fail++; console.log(`FAIL 引擎写入 kind="${k}" 不在 tally 白名单——先改白名单再落日志（release-plan §四）`) }
}
console.log(`引擎 log kind：${kinds.length} 类；白名单：${wl.size} 类`)
console.log(`\n=== tally-whitelist.test: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
