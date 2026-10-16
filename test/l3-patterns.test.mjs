// L3 数据删除/权限变更 语义回归（node test/l3-patterns.test.mjs）
// 批1 接线修复（2026-10-16）：去掉「本地旧正则」自测——直接打真引擎 judgeL3（与 judge-l3.test.mjs 同源接线）。
// 用例单源=tests/rule-corpus.mjs。负向控制：改坏 src 的 L3_PATTERNS 会让本套件立即变红（批1 已实测一次）。
import { judgeL3 } from '../src/shisan-xinuo-core.ts'
import { L3_PATTERNS_HIT as shouldHit, L3_PATTERNS_PASS as shouldPass } from '../tests/rule-corpus.mjs'

let fail = 0
for (const c of shouldHit) {
  const got = judgeL3(c)
  if (got === null) { console.log('MISS(hit expected):', c); fail++ }
}
for (const c of shouldPass) {
  const got = judgeL3(c)
  if (got !== null) { console.log('FALSE-POSITIVE:', c, '->', got); fail++ }
}
console.log(fail === 0 ? `ALL PASS (${shouldHit.length + shouldPass.length} cases vs engine judgeL3)` : `${fail} failures`)
process.exit(fail === 0 ? 0 : 1)
