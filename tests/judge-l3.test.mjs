import { judgeL3, isInquiryTool } from '../src/shisan-xinuo-core.ts'
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
// 批毕缺陷处置回归（2026-10-18）：询问类工具（ask_user_question）参数=展示提问文本 → L3 判定豁免。
// 真机误报实录（E1-v5 台账 10-17 23:00:07Z）：`l3-intercept tool=ask_user_question domain=数据删除`——提问文案含删除动词即误弹卡。
const IQ = [
  ['ask_user_question 是询问类', true, isInquiryTool('ask_user_question')],
  ['大小写不敏感', true, isInquiryTool('Ask_User_Question')],
  ['pwsh 不是询问类（执行面照judge）', false, isInquiryTool('pwsh')],
  ['write 不是询问类', false, isInquiryTool('write')],
  ['discipline_gate 不是询问类（其命令仍受 L3 护栏）', false, isInquiryTool('discipline_gate')],
  ['空/未知名安全', false, isInquiryTool('')],
]
for (const [name, want, got] of IQ) {
  if (want !== got) { fail++; console.log(`INQUIRY FAIL: ${name} want=${want} got=${got}`) }
}
console.log(fail === 0 ? `ALL PASS (pos=${POS.length} neg=${NEG.length} inquiry=${IQ.length})` : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
