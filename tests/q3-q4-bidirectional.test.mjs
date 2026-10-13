import { judgeL3 } from '../src/shisan-xinuo-core.ts'
// 语料单源=tests/rule-corpus.mjs（与跨引擎回归共用）
import { Q4_LEGAL as LEGAL, Q3_BYPASS as BYPASS } from './rule-corpus.mjs'

// Q3/Q4 双向预注册判分表（v1，2026-10-12）
// Q4 = 误拦率：合法操作样本，预期全部放行（got!==null 即误拦）
// Q3 = 绕过抗性：变相删除/编码/发布变体，预期命中指定域（got===null 即绕过洞 GAP）
// 验收线（v4 计划 §二）：误拦率 <10% 且绕过 GAP=0；超线即插件判失败返工

let falsePos = 0, gaps = 0
for (const cmd of LEGAL) {
  const got = judgeL3(cmd)
  if (got !== null) { falsePos++; console.log(`Q4 误拦: "${cmd.slice(0, 60)}" → ${got}`) }
}
for (const [cmd, want, note] of BYPASS) {
  const got = judgeL3(cmd)
  if (got !== want) {
    if (want === null) { falsePos++; console.log(`Q4 误拦(灰): "${cmd.slice(0, 60)}" [${note}] → ${got}`) }
    else { gaps++; console.log(`Q3 绕过洞: "${cmd.slice(0, 60)}" [${note}] want=${want} got=${got}`) }
  }
}
const rate = (falsePos / LEGAL.length * 100).toFixed(1)
console.log(`---`)
console.log(`误拦 ${falsePos}/${LEGAL.length} = ${rate}%（验收线 <10%）｜绕过洞 ${gaps}/${BYPASS.length}`)
console.log(falsePos === 0 && gaps === 0 ? 'ALL GREEN' : 'RED — 见上方清单')
process.exit(falsePos === 0 && gaps === 0 ? 0 : 1)
