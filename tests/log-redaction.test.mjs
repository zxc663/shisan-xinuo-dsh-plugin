// 遥测脱敏单测：常见密钥形态（sk-/gh*/Bearer/token=xxx/URL 凭据）深脱敏；负样例不得误伤。
// 运行：node tests/log-redaction.test.mjs
import { redactSecrets, redactDeep } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) {
    pass++
    cases.push(`PASS ${name}`)
  } else {
    fail++
    cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`)
  }
}

t('sk- 密钥脱敏', true, redactSecrets('KEY=sk-1234567890abcdefgh').includes('sk-***'))
t('sk- 原文不再出现', false, redactSecrets('KEY=sk-1234567890abcdefgh').includes('1234567890abcdefgh'))
t('ghp_ 令牌脱敏', true, redactSecrets('token ghp_abcdEFGH12345678ijkl').includes('gh*_***'))
t('github_pat_ 脱敏', true, redactSecrets('github_pat_ABCDEFGH12345678xy').includes('github_pat_***'))
t('Bearer 头脱敏', true, redactSecrets('curl -H "Authorization: Bearer abcDEF1234567890xyz"').includes('Bearer ***'))
t('token= 值脱敏', true, redactSecrets('tool --token=abcd1234efgh').includes('token=***'))
t('password: 值脱敏', true, redactSecrets('password: hunter2secret').includes('password: ***'))
t('URL 凭据脱敏', true, redactSecrets('https://alice:s3cr3tpass@example.com/x').includes('alice:***@'))

t('负样例：普通命令不变', 'git status', redactSecrets('git status'))
t('负样例：短值不误伤', 'token=abc', redactSecrets('token=abc'))
t('负样例：正常正文不变', '需要用户明确确认后才能继续。', redactSecrets('需要用户明确确认后才能继续。'))

t('redactDeep：嵌套对象/数组', true, JSON.stringify(redactDeep({ a: ['x sk-1234567890abcdef'], b: { token: 'Bearer abcDEF1234567890xyz' } })).includes('sk-***'))
t('redactDeep：JSON 化往返可解析', true, (() => { try { JSON.parse(JSON.stringify(redactDeep({ cmd: 'ghp_abcdEFGH12345678ijkl' }))); return true } catch { return false } })())

console.log(cases.join('\n'))
console.log(`\n=== log-redaction.test: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
