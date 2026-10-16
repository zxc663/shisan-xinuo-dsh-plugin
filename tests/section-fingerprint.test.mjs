// 段指纹回归：注入系统段 SHA-256 的确定性与敏感度（段变更率=0 遥测底座）。
import { sectionFingerprint } from '../src/shisan-xinuo-core.ts'

let fail = 0
const check = (c, m) => { if (!c) { fail++; console.log('FAIL: ' + m) } }

const a = [{ name: 's1', text: 'hello' }, { name: 's2', text: 'world' }]
const h1 = sectionFingerprint(a)
check(typeof h1 === 'string' && h1.length === 64, '返回 64 位 hex SHA-256')
check(h1 === sectionFingerprint(a), '同输入确定性')
check(h1 !== sectionFingerprint([{ name: 's1', text: 'hello' }, { name: 's2', text: 'world!' }]), '文本变更→哈希变化')
check(h1 !== sectionFingerprint([{ name: 's1x', text: 'hello' }, { name: 's2', text: 'world' }]), '名称变更→哈希变化')
check(typeof sectionFingerprint([]) === 'string' && sectionFingerprint([]).length === 64, '空段仍返回哈希')

console.log(fail === 0 ? 'ALL PASS (section-fingerprint)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
