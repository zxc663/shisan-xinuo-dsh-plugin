#!/usr/bin/env node
// 层3 会话日志分析器：从 session.v4.jsonl.zstd 提取实验指标（系统段稳定性/工具面/收口计数）。
// 用法：node scripts/l3exp/analyze-arm.mjs <session.v4.jsonl.zstd> [out.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const file = process.argv[2]
let text
try { text = zstdDecompressSync(readFileSync(file)).toString('utf8') } catch (e) { console.error('DECODE-FAIL', e.message); process.exit(2) }
const lines = text.split('\n').filter(Boolean)
const counts = {}
const sys = []
const toolCalls = {}
let steerCount = 0
const stepOk = new Set()
for (const line of lines) {
  let ev
  try { ev = JSON.parse(line) } catch { continue }
  counts[ev.type] = (counts[ev.type] || 0) + 1
  const d = ev.data ?? {}
  if (ev.type === 'system/message') {
    const t = d?.message?.content?.[0]?.text ?? JSON.stringify(d)
    sys.push({ seq: ev.seq, bytes: t.length, sha1: createHash('sha1').update(t).digest('hex').slice(0, 12) })
  }
  if (ev.type === 'tool/call') {
    const n = d.name ?? d.toolName ?? (d.call && d.call.name) ?? 'unknown'
    toolCalls[n] = (toolCalls[n] || 0) + 1
  }
  if (ev.type === 'user/message' || ev.type === 'assistant/message') {
    const t = JSON.stringify(d)
    if (t.includes('十三希诺收口强制')) steerCount++
    const m = t.match(/STEP-\d+-OK/g)
    if (m) for (const x of m) stepOk.add(x)
  }
}
const out = {
  file, events: lines.length, counts, systemEvents: sys.length,
  distinctSystem: new Set(sys.map((s) => s.sha1)).size,
  systemBytes: sys.reduce((a, s) => a + s.bytes, 0), systemMessages: sys,
  toolCalls, steerCount, stepOkCount: stepOk.size, stepOkList: [...stepOk].sort(),
}
const brief = { ...out }
delete brief.systemMessages
console.log(JSON.stringify(brief, null, 2))
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(out, null, 2))
