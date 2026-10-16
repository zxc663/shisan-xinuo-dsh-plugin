#!/usr/bin/env node
// 层3 实验臂运行器（实验基建；dev-only，不进发行 files 清单）：20 轮长任务 + 逐轮证据落盘。
// 用法：node scripts/l3exp/run-arm.mjs A1|A2|B1|B2
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync, readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI = 'D:/ai本地模型/dsh-cli-0.2.0-rc.2/node_modules/@deepseek-ai/dsh/lib/bin.js'
const CREDS = 'D:/ai本地模型/dsh/.credentials.yaml'
const TURNS = 20
const ARM = process.argv[2]
const PAT = {
  go: 'D:/tmp/dshgo-base-overlay.yml',
  model: 'D:/tmp/dshgo-step5-overlay.yml',
  richExtra: 'D:/tmp/rich-extra-overlay.yml',
}
const ARMS = {
  A1: { home: 'D:/ai本地模型/dsh-exp-home', profile: 'exp1', env: { SHISANUO_BUDGET_LEVEL: 'L2-S' },
        patches: [PAT.go, PAT.model, 'D:/tmp/l3exp/arm-a1-old.yml'] },
  A2: { home: 'D:/ai本地模型/dsh-exp-home', profile: 'exp1', env: { SHISANUO_BUDGET_LEVEL: 'L2-S' },
        patches: [PAT.go, PAT.model, 'D:/tmp/l3exp/arm-a2-cur.yml'] },
  B1: { home: 'D:/ai本地模型/dsh-rich-home', profile: 'rich1', env: {},
        patches: [PAT.go, PAT.model, PAT.richExtra, 'D:/tmp/l3exp/arm-b1-ts-off.yml'] },
  B2: { home: 'D:/ai本地模型/dsh-rich-home', profile: 'rich1', env: {},
        patches: [PAT.go, PAT.model, PAT.richExtra] },
}
const cfg = ARMS[ARM]
if (!cfg) { console.error('usage: node tmp/l3exp/run-arm.mjs A1|A2|B1|B2'); process.exit(2) }
const key = (readFileSync(CREDS, 'utf8').match(/OPENCODE_GO_API_KEY:\s*(\S+)/) || [])[1]
if (!key) { console.error('NO KEY'); process.exit(2) }

const WD = `${cfg.home}/work/${ARM}`
const RUNS = `${cfg.home}/runs/${ARM}`
mkdirSync(WD, { recursive: true })
mkdirSync(RUNS, { recursive: true })

const promptFor = (k) => `第${k}步（共${TURNS}轮长任务）：用 write 工具创建文件 ${WD}/step_${k}.txt，内容一行：step-${k}；随后调用 discipline_gate（参数 assert=exists:${WD}/step_${k}.txt）完成收口；最后仅回复：STEP-${k}-OK。`

function findNewestSession(since) {
  const root = join(cfg.home, 'sessions')
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
const jl = join(RUNS, 'turns.jsonl')
for (let k = 1; k <= TURNS; k++) {
  const args = [CLI, '--profile', cfg.profile, ...cfg.patches.flatMap((p) => ['--patch', p]), ...(sid ? ['--session-id', sid] : []), promptFor(k)]
  const st = Date.now()
  const r = spawnSync(process.execPath, args, { cwd: WD, env: { ...process.env, DSH_HOME: cfg.home, OPENCODE_GO_API_KEY: key, ...cfg.env }, encoding: 'utf8', timeout: 240000 })
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
