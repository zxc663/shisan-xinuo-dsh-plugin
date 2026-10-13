#!/usr/bin/env node
// 出题人无工具通道（R19）：直接向 provider 发起一次纯文本调用，规避"带工具会话→模型调工具代替出题"的失效模式。
// 用法：node scripts/adv-call.mjs <model> <promptFile>；结果＝模型回复原文打印到 stdout。
// 密钥只从凭据文件读取（不打印、不落盘）；可用环境变量覆盖：SHISANUO_ADV_CRED / SHISANUO_ADV_BASEURL / SHISANUO_ADV_KEYENV。
import { readFileSync } from 'node:fs'

const CRED = process.env.SHISANUO_ADV_CRED ?? 'D:/ai本地模型/dsh/headless-home/.credentials.yaml'
const BASE = process.env.SHISANUO_ADV_BASEURL ?? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const KEYENV = process.env.SHISANUO_ADV_KEYENV ?? 'ZHIPU_CLOUD_API_KEY'

const [, , model, promptFile] = process.argv
if (!model || !promptFile) {
  console.error('用法：node scripts/adv-call.mjs <model> <promptFile>')
  process.exit(2)
}
const cred = readFileSync(CRED, 'utf8')
const m = cred.match(new RegExp(`${KEYENV}\\s*:\\s*"?([^"\\r\\n]+)"?`))
if (!m) {
  console.error(`凭据文件中未找到 ${KEYENV}`)
  process.exit(3)
}
const prompt = readFileSync(promptFile, 'utf8')
const r = await fetch(BASE, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${m[1].trim()}` },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 1024,
  }),
})
const t = await r.text()
if (r.status !== 200) {
  console.error(`HTTP ${r.status} ${t.slice(0, 200)}`)
  process.exit(1)
}
try {
  const j = JSON.parse(t)
  process.stdout.write(String(j.choices?.[0]?.message?.content ?? ''))
} catch {
  process.stdout.write(t)
}
