#!/usr/bin/env node
// 上下文成本基线（只读计量）：为 C13（系统段瘦身）/ C14（skill 纳入预算）/ C16（成本可见性）提供前后对照的同一把尺子。
// 用法：node scripts/context-baseline.mjs [--home <DSH home>] [--last N]
// 口径：步数=step/start 计数；累计上下文字节=各步发出版本之和（每步都会重发整个上下文）；系统段字节＝system/message 累计。
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const argOf = (k, d) => {
  const i = process.argv.indexOf(k)
  return i >= 0 ? process.argv[i + 1] : d
}
const HOME = argOf('--home', 'D:/ai本地模型/dsh/headless-home')
const LAST = Number(argOf('--last', 10))

const PY = `
import sys, io, json, zstandard
p = sys.argv[1]
text = zstandard.ZstdDecompressor().stream_reader(io.BytesIO(open(p,'rb').read())).read().decode('utf8')
steps = 0; sysc = 0; sysn = 0; skillc = 0; cum = 0; total = 0; kinds = {}
for line in text.splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        rec = json.loads(line)
    except Exception:
        continue
    t = rec.get('type'); d = rec.get('data') or {}
    if t == 'step/start':
        steps += 1
        total += cum
    elif t in ('user/message','assistant/message','system/message','tool/result'):
        s = len(json.dumps(d, ensure_ascii=False))
        if t == 'system/message':
            sysc += s; sysn += 1
        k = (d.get('source') or {}).get('kind')
        if isinstance(k, str):
            kinds[k] = kinds.get(k, 0) + 1
            if 'skill' in k.lower():
                skillc += s
        cum += s
print(json.dumps({'steps':steps,'cumBytes':total,'finalBytes':cum,'sysBytes':sysc,'sysMsgs':sysn,'skillBytes':skillc,'kinds':kinds}, ensure_ascii=False))
`

function sessionFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) sessionFiles(p, out)
    else if (/session\.v\d+\.jsonl(\.zstd)?$/.test(e.name)) out.push(p)
  }
  return out
}

const files = sessionFiles(join(HOME, 'sessions'))
  .map((f) => ({ f, m: statSync(f).mtimeMs, s: statSync(f).size }))
  .filter((x) => x.s > 20 * 1024) // 跳过碎片会话
  .sort((a, b) => b.m - a.m)
  .slice(0, LAST)

if (files.length === 0) {
  console.log(`未找到可用会话（home=${HOME}）`)
  process.exit(2)
}

const rows = []
for (const { f } of files) {
  const r = spawnSync('python', ['-c', PY, f], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  try {
    rows.push(JSON.parse(r.stdout.trim()))
  } catch {
    /* 跳过解析失败的会话 */
  }
}

const med = (a) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}
const kb = (n) => (n / 1024).toFixed(1)
const skillTot = rows.reduce((a, r) => a + (r.skillBytes ?? 0), 0)
console.log(`home=${HOME}｜样本=${rows.length} 个会话（取最近 ${LAST} 个 >20KB 者）`)
console.log(`步数中位=${med(rows.map((r) => r.steps))}｜累计上下文中位=${kb(med(rows.map((r) => r.cumBytes)))}KB｜终态上下文中位=${kb(med(rows.map((r) => r.finalBytes)))}KB`)
console.log(`系统段累计中位=${kb(med(rows.map((r) => r.sysBytes)))}KB（消息数中位=${med(rows.map((r) => r.sysMsgs))}）`)
console.log(`skill 类注入累计=${kb(skillTot)}KB（全样本合计）`)
const kinds = {}
for (const r of rows) for (const [k, v] of Object.entries(r.kinds ?? {})) kinds[k] = (kinds[k] ?? 0) + v
console.log(`消息来源分布：${Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${v}`).join('  ')}`)
console.log('\n（口径：累计上下文字节＝各步发出版本之和，近似输入 token 体积；每步重发整个上下文，故步数是二次成本的主因）')
