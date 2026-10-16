#!/usr/bin/env node
// 层3 会话日志分析器：从 session.v4.jsonl.zstd 提取实验指标（系统段稳定性/工具面/收口计数）。
// 用法：node scripts/l3exp/analyze-arm.mjs <session.v4.jsonl.zstd> [out.json]
import { writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const file = process.argv[2]
// 会话日志是 zstd 多帧流：Node 的 zstd 解码只吃首帧（实测），改用 python zstandard 流式读全。
const PY = [
  'import sys, io, zstandard',
  'd = zstandard.ZstdDecompressor()',
  'with open(sys.argv[1], "rb") as fh:',
  '    with d.stream_reader(fh) as r:',
  '        sys.stdout.write(io.TextIOWrapper(r, encoding="utf-8").read())',
].join('\n')
let text
try {
  const r = spawnSync('python', ['-c', PY, file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(String(r.stderr).slice(0, 300))
  text = String(r.stdout)
} catch (e) { console.error('DECODE-FAIL', e.message); process.exit(2) }
const lines = text.split('\n').filter(Boolean)
const counts = {}
const sys = []
const toolCalls = {}
let steerCount = 0
const stepOk = new Set()
// 真实用量（2026-10-16 发现：宿主现在回传 usage，含 cacheReadTokens）——把「cached_tokens%」从代理口径升为真测。
const usageReqs = []
for (const line of lines) {
  let ev
  try { ev = JSON.parse(line) } catch { continue }
  counts[ev.type] = (counts[ev.type] || 0) + 1
  const um = line.match(/"usage"\s*:\s*\{([^}]*)\}/)
  if (um) {
    const o = {}
    for (const kv of um[1].split(',')) {
      const i = kv.indexOf(':')
      if (i < 0) continue
      const k = kv.slice(0, i).replace(/["\s]/g, '')
      const v = Number(kv.slice(i + 1).replace(/["\s]/g, ''))
      if (Number.isFinite(v)) o[k] = v
    }
    usageReqs.push(o)
  }
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
  usage: (() => {
    const sum = (k) => usageReqs.reduce((a, r) => a + (r[k] ?? 0), 0)
    const input = sum('inputTokens')
    const cacheRead = sum('cacheReadTokens')
    const total = sum('totalTokens')
    const denom = input + cacheRead
    return {
      requests: usageReqs.length,
      inputTokens: input,
      cacheReadTokens: cacheRead,
      totalTokens: total,
      cacheHitPct: denom > 0 ? Math.round((cacheRead / denom) * 1000) / 10 : null,
    }
  })(),
}
const brief = { ...out }
delete brief.systemMessages
console.log(JSON.stringify(brief, null, 2))
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(out, null, 2))
