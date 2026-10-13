import { judgeL3 } from '../src/shisan-xinuo-core.ts'
// 预注册判据：正样例必须命中指定域，负样例必须放行（语料单源=tests/rule-corpus.mjs，与跨引擎回归共用）
import { JUDGE_L3_POS as POS, JUDGE_L3_NEG as NEG } from './rule-corpus.mjs'

let fail = 0
for (const [cmd, want] of POS) {
  const got = judgeL3(cmd)
  if (got !== want) { fail++; console.log(`POS FAIL: "${cmd}" want=${want} got=${got}`) }
}
for (const cmd of NEG) {
  const got = judgeL3(cmd)
  if (got !== null) { fail++; console.log(`NEG FAIL: "${cmd}" got=${got}`) }
}
console.log(fail === 0 ? `ALL PASS (pos=${POS.length} neg=${NEG.length})` : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
