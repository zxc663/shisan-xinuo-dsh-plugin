// L3 数据删除/权限变更 正则回归测试（node test/l3-patterns.test.mjs）
// 用例单源=tests/rule-corpus.mjs（与跨引擎回归共用）；本套件仍以本地旧正则自测
import { L3_PATTERNS_HIT as shouldHit, L3_PATTERNS_PASS as shouldPass } from '../tests/rule-corpus.mjs'

const re = /(?<![-\w])rm\s+(?:-\S+\s+)*\S|\bRemove-Item\b|(?:^|[;&|]\s*|\n\s*)(?:del|erase|rd|rmdir|ri)(?:\s+\S|\s*(?:$|[;&|]))|git\s+(?:reset\s+--hard|clean\b)|\bshred\b|\bunlink\b/i

let fail = 0
for (const c of shouldHit) if (!re.test(c)) { console.log('MISS(hit expected):', c); fail++ }
for (const c of shouldPass) if (re.test(c)) { console.log('FALSE-POSITIVE:', c); fail++ }
console.log(fail === 0 ? `ALL PASS (${shouldHit.length + shouldPass.length} cases)` : `${fail} failures`)
process.exit(fail === 0 ? 0 : 1)
