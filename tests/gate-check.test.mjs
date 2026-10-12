// GATE 收口机检单测——预注册样例（正/负/豁免三向），先定判据后跑分。
// 运行：npx tsx tests/gate-check.test.mjs
import { judgeGate, assistantText, parseSessionEvent } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []

function t(name, expect, actual) {
  if (expect === actual) {
    pass++
    cases.push(`PASS ${name}`)
  } else {
    fail++
    cases.push(`FAIL ${name} (expect=${expect} actual=${actual})`)
  }
}

// ── 正样例：实质工作回合 + completed + 有 GATE → ok ──
t('ok: 完整 GATE 单行', 'ok', judgeGate('任务完成。GATE: {level=L1, v=改名, cmd=ls, exit=0, files=a.txt, exempt=—}', 2, 'completed'))
t('ok: GATE 后有多余空格', 'ok', judgeGate('done\nGATE:  {level=L2-S, v=xx, cmd=y, exit=0, files=z, exempt=—}', 1, 'completed'))
t('ok: GATE 在长文尾部', 'ok', judgeGate('分析……修改……验证通过。\n\nGATE: {level=L2-F, v=多文件, cmd=npm t, exit=0, files=a,b, exempt=—}', 5, 'completed'))

// ── 负样例：实质工作回合 + completed + 无 GATE → missing ──
t('missing: 干活但没收口', 'missing', judgeGate('已经完成了修改，文件已更新。', 3, 'completed'))
t('missing: 空回复', 'missing', judgeGate('', 1, 'completed'))
t('missing: 提到 gate 但无 GATE: { 形态', 'missing', judgeGate('这个任务不需要 gate 检查。', 2, 'completed'))

// ── 豁免样例：skip ──
t('skip: aborted 中断', 'skip', judgeGate('干到一半', 4, 'aborted'))
t('skip: error 失败', 'skip', judgeGate('报错了', 2, 'error'))
t('skip: max-tokens 截断', 'skip', judgeGate('写到一半被截', 1, 'max-tokens'))
t('skip: interrupted 崩溃孤儿', 'skip', judgeGate('', 3, 'interrupted'))
t('skip: forked 合成标记', 'skip', judgeGate('', 1, 'forked'))
t('skip: blocked', 'skip', judgeGate('', 1, 'blocked'))
t('skip: completed 但纯聊天零工具', 'skip', judgeGate('你好，我是助手。', 0, 'completed'))
t('skip: completed 但空回合', 'skip', judgeGate('', 0, 'completed'))

// ── assistantText 文本提取 ──
t('text: string 直通', 'hello', assistantText('hello'))
t('text: blocks 数组拼接', 'ab', assistantText([{ type: 'text', text: 'a' }, { type: 'tool_use', id: 'tu1', name: 'pwsh' }, { type: 'text', text: 'b' }]))
t('text: null 防御', '', assistantText(null))
t('text: 对象防御', '', assistantText({ weird: true }))

// ── parseSessionEvent 信封拆解（防「直接读 event.turn」同型复发——首版真实事故：信封 {type,seq,time,data}，业务字段全在 data 内层）──
const env1 = parseSessionEvent({ type: 'turn/end', seq: 7, time: '2026-10-12T00:00:00Z', data: { turn: 3, reason: { kind: 'completed' } } })
t('env: 信封 turn/end 提取 type', 'turn/end', env1?.type)
t('env: 信封 turn/end 提取 turn', 3, env1?.turn)
t('env: 信封 turn/end 提取 endKind', 'completed', env1?.endKind)
const env2 = parseSessionEvent({ type: 'assistant/message', data: { turn: 2, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: 'GATE: {level=L1}' }] } } })
t('env: assistant/message 提取 content', 'GATE: {level=L1}', env2?.content?.[0]?.text)
t('env: assistant/message 无 reason → endKind=unknown', 'unknown', env2?.endKind)
const env3 = parseSessionEvent({ type: 'tool/call', data: { turn: 1, step: 0, callId: 'c1', name: 'pwsh', arguments: '{}' } })
t('env: tool/call 正常通过', 1, env3?.turn)
// 负：根字段误置形态（字段直接在 event 根上、无 data 信封）→ null
t('env: 根字段误置 → null', 'null', String(parseSessionEvent({ type: 'turn/end', turn: 1, reason: { kind: 'completed' } })))
// 负：data 缺 turn → null
t('env: data 缺 turn → null', 'null', String(parseSessionEvent({ type: 'tool/call', data: { callId: 'x', name: 'pwsh' } })))
// 负：null / 非对象 / type 非字符串 → null
t('env: null → null', 'null', String(parseSessionEvent(null)))
t('env: 非对象 → null', 'null', String(parseSessionEvent('turn/end')))
t('env: type 非字符串 → null', 'null', String(parseSessionEvent({ data: { turn: 1 } })))

console.log(cases.join('\n'))
console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
