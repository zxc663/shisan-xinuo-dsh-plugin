// 跳过治理 notice 形态回归（批3 方向 A）：宿主 notice 通道要求 source.form='notice' + 一行 summary，
// 且消息必须带 id/role（与 userMessage 同因——进 inbox 的身份字段宿主不补）。
import { noticeMessage } from '../src/shisan-xinuo-core.ts'

let fail = 0
const check = (c, m) => { if (!c) { fail++; console.log('FAIL: ' + m) } }

const m = noticeMessage('一行摘要', '完整三问正文')
check(typeof m.id === 'string' && m.id.length > 0, 'id 必须是非空字符串')
check(m.role === 'user', 'role 必须为 user')
check(m.source && m.source.form === 'notice', 'source.form 必须为 notice')
check(typeof m.source.summary === 'string' && m.source.summary.length > 0, 'notice 必须带非空 summary')
check(typeof m.source.kind === 'string' && m.source.kind.length > 0, 'source.kind 必须非空')
check(Array.isArray(m.content) && m.content[0].type === 'text' && m.content[0].text === '完整三问正文', 'content 为 [text] 且文本一致')
check(noticeMessage('a', 'b').id !== m.id, '每次 id 唯一')

console.log(fail === 0 ? 'ALL PASS (notice-message)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
