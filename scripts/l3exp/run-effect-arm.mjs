#!/usr/bin/env node
// effect 层样本轮运行器（实验基建；dev-only，不进发行 files 清单）。
// 目的：测量「窄版宿主默认判据（effect 层）」的指标变化——E0（关闭=基线）vs E1（默认开）。
// 设计口径：每轮=一次物理写文件任务；提示模型**不调用 discipline_gate**（隔离变量：
//   基线路径=回合末收口强制 steer；处理路径=effect-closeout 自动收口）。
// 用法：node scripts/l3exp/run-effect-arm.mjs E0|E1   （EFFECT_TURNS 覆盖轮数，默认 10）
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync, readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const CLI = 'D:/ai本地模型/dsh-cli-0.2.0-rc.2/node_modules/@deepseek-ai/dsh/lib/bin.js'
const CREDS = 'D:/ai本地模型/dsh/.credentials.yaml'
const HOME = 'D:/ai本地模型/dsh-exp-home'
const TURNS = Number(process.env.EFFECT_TURNS ?? 10)
const ARM = process.argv[2]
// E0=关闭 effect 层（对照基线）；E1=默认开（处理组）
const ARMS = {
  E0: { env: { SHISANUO_EFFECT_ASSERT: '0' } },
  E1: { env: {} },
}
const cfg = ARMS[ARM]
if (!cfg) { console.error('usage: node scripts/l3exp/run-effect-arm.mjs E0|E1'); process.exit(2) }
const key = (readFileSync(CREDS, 'utf8').match(/OPENCODE_GO_API_KEY:\s*(\S+)/) || [])[1]
if (!key) { console.error('NO KEY'); process.exit(2) }

const PAT = [
  'D:/tmp/dshgo-base-overlay.yml',
  'D:/tmp/dshgo-longcat-overlay.yml',
  'D:/tmp/l3exp/arm-a2-cur.yml',
]
const WD = `${HOME}/work/effect${ARM}`
const RUNS = `${HOME}/runs/effect${ARM}`
mkdirSync(WD, { recursive: true })
mkdirSync(RUNS, { recursive: true })

// 提示词：不指示模型调用 gate（对照组走 steer，处理组走 effect-closeout）
// 注意1：effect 层只从**绝对盘符路径**派生断言（firstAbsolutePath 口径）——提示词必须给绝对路径，
// 否则处理组不会触发 effect-closeout（冒烟实证：相对路径 → 退回 no-assertions steer）。
// 注意2：免费档模型有「发言即止」（出文本零工具调用）抖动（实测）——提示词加真实工具调用要求，
// 分析时按 pre-execute 证据判定轮次有效性（exit=0 ≠ 有效轮）。
const promptFor = (k) => `第${k}步：用 write 工具把一行内容「step-${k}」写入文件 ${WD}/fe_${k}.txt（就用这个绝对路径）。要求：必须实际调用 write 工具完成写入——只在回复里声称完成但没有真实调用工具视为失败；不要调用 discipline_gate；写入完成后仅回复 FE-${k}-OK。`

function findNewestSession(since) {
  const root = join(HOME, 'sessions')
  if (!existsSync(root)) return null
  let best = null
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'session.v4.jsonl.zstd') {
        const m = statSync(p).mtimeMs
        if (m >= since && (!best || m > best.m)) best = { m, file: p, id: dirname(p).split(/[\\/]/).pop() }
      }
    }
  }
  walk(root)
  return best
}

const t0 = Date.now()
let sid = null
let startAt = 1
const jl = join(RUNS, 'turns.jsonl')
// 断点续跑（长批量抗中断）：EFFECT_RESUME=1 且有既有 session/turns 时，从已完成的下一轮继续（同一会话）。
if (process.env.EFFECT_RESUME === '1' && existsSync(join(RUNS, 'session.json')) && existsSync(jl)) {
  sid = JSON.parse(readFileSync(join(RUNS, 'session.json'), 'utf8')).id
  startAt = readFileSync(jl, 'utf8').split('\n').filter(Boolean).length + 1
  console.log(`[${ARM}] resume sid=${sid} startAt=${startAt}`)
}
for (let k = startAt; k <= TURNS; k++) {
  const args = [CLI, '--profile', 'exp1', ...PAT.flatMap((p) => ['--patch', p]), ...(sid ? ['--session-id', sid] : []), promptFor(k)]
  const st = Date.now()
  const r = spawnSync(process.execPath, args, { cwd: WD, env: { ...process.env, DSH_HOME: HOME, OPENCODE_GO_API_KEY: key, ...cfg.env }, encoding: 'utf8', timeout: 240000 })
  const ms = Date.now() - st
  const out = String(r.stdout ?? '')
  const err = String(r.stderr ?? '')
  writeFileSync(join(RUNS, `turn-${String(k).padStart(2, '0')}.out.txt`), out + '\n---STDERR---\n' + err)
  appendFileSync(jl, JSON.stringify({ turn: k, ms, exit: r.status, outTail: out.slice(-200), errTail: err.slice(-200) }) + '\n')
  console.log(`[${ARM}] turn ${k}/${TURNS} exit=${r.status} ${ms}ms`)
  if (k === 1) {
    const s = findNewestSession(t0 - 5000)
    if (!s) { console.error('no session found after turn1'); break }
    sid = s.id
    writeFileSync(join(RUNS, 'session.json'), JSON.stringify(s, null, 2))
    console.log(`[${ARM}] session=${sid}`)
  }
}
console.log(`[${ARM}] done in ${Math.round((Date.now() - t0) / 1000)}s`)
