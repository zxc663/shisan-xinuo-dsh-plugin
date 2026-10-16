// steer/inject 消息身份回归：宿主会话恢复校验（dsh-session assertMessageEventShape）要求
// user/message 携带 id（非空字符串）+ role='user' + source.kind + content 数组。
// 负向控制：直接断言形状字段，防止回到 {content, source} 缺 id/role 的旧形态（B1 实测 corrupt）。
import { userMessage } from '../src/shisan-xinuo-core.ts'

let fail = 0
const check = (cond, msg) => { if (!cond) { fail++; console.log('FAIL: ' + msg) } }

const m = userMessage('测试文本')
check(typeof m.id === 'string' && m.id.length > 0, 'id 必须是非空字符串')
check(m.role === 'user', 'role 必须为 user')
check(m.source && m.source.kind === 'user', 'source.kind 必须为 user')
check(Array.isArray(m.content) && m.content.length === 1 && m.content[0].type === 'text' && m.content[0].text === '测试文本', 'content 必须是 [text] 数组且文本一致')

const m2 = userMessage('另一条')
check(m.id !== m2.id, '每次调用 id 必须唯一')

console.log(fail === 0 ? 'ALL PASS (steer-message shape)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
