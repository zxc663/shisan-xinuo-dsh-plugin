#!/usr/bin/env node
// E2 大基数验证运行器（预注册：docs/design-specs/e2-large-n-validation-plan-20261019.md）
// 用法：node scripts/e2-run.mjs <C|D> <T1..T6> <round>     # 单样本（试点/补跑）
//       node scripts/e2-run.mjs --clean-rebuild             # 重建 D 臂干净家
// 臂：C=治理（headless-home，引擎在场，默认模式）｜D=原始（headless-home-clean，无插件挂载）
// 产物：memory/tmp/e2-results.json（追加式）
import { spawnSync, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { E2_TASKS, e2DirOf } from './e2-battery.mjs'

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const DSH_BIN = process.env.SHISANUO_DSH_BIN ?? 'D:/ai本地模型/dsh-cli-0.2.0-rc.2/node_modules/@deepseek-ai/dsh/lib/bin.js'
const HOME_C = process.env.SHISANUO_E2_HOME_C ?? 'D:/ai本地模型/dsh/headless-home'
const HOME_D = process.env.SHISANUO_E2_HOME_D ?? 'D:/ai本地模型/dsh/headless-home-clean'
const EXEC_LOG = join(REPO, 'memory', 'logs', 'exec-log.jsonl')
const RESULTS = join(REPO, 'memory', 'tmp', 'e2-results.json')

function rebuildCleanHome() {
  console.log(`[e2] 构建干净家 ${HOME_D}（自 ${HOME_C}；排除 storages/sessions/logs/cache）…`)
  rmSync(HOME_D, { recursive: true, force: true })
  mkdirSync(HOME_D, { recursive: true })
  const r = spawnSync('robocopy', [HOME_C, HOME_D, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/XD', 'storages', 'sessions', 'logs', 'cache'])
  if (r.status === null || (r.status !== 0 && r.status > 7)) {
    console.error('[e2] robocopy 失败，status=' + r.status)
    process.exit(4)
  }
  let stripped = 0
  let residue = 0
  for (const name of readdirSync(join(HOME_D, 'profiles'))) {
    const p = join(HOME_D, 'profiles', name, 'cordis.patch.yml')
    if (!existsSync(p)) continue
    const before = readFileSync(p, 'utf8')
    // 剥离 shisanxinuo-core 条目（自 “- id: shisanxinuo-core” 行至其 name 行）
    let text = before.replace(/\r?\n[ \t]*- id: shisanxinuo-core\r?\n(?:[ \t]+[^\r\n]*\r?\n)*?[ \t]*name: 'file:\/\/\/[^']*shisan-xinuo-core\.ts'\r?\n/g, '\n')
    // 若 insert 块已空（其后紧接空行/文件尾/下一顶层条目），整块移除
    text = text.replace(/\r?\n- insert:\r?\n(?=\r?\n|$)/g, '\n')
    if (text !== before) {
      writeFileSync(p, text)
      stripped++
    }
    if (readFileSync(p, 'utf8').includes('shisan')) residue++
  }
  console.log(`[e2] 干净家重建完成：剥离补丁 ${stripped} 份；残留含 shisan 的补丁 ${residue}（应为 0）`)
  if (residue > 0) {
    console.error('[e2] 残留非零——regex 未覆盖，人工检查后重试')
    process.exit(5)
  }
}

const argv = process.argv.slice(2)
if (argv[0] === '--clean-rebuild') {
  rebuildCleanHome()
  process.exit(0)
}

const [arm, task, round] = argv
if (!['C', 'D'].includes(String(arm)) || !E2_TASKS[String(task).toUpperCase()] || !round) {
  console.log('用法：node scripts/e2-run.mjs <C|D> <T1..T6> <round>')
  process.exit(2)
}
if (arm === 'D' && !existsSync(HOME_D)) {
  console.log('[e2] 干净家不存在——先运行 --clean-rebuild')
  process.exit(3)
}
// 防误：治理臂运行前清除 A/B 探索臂旗标（避免模式残留）
for (const f of ['arm-A-observe.flag', 'arm-B-text.flag']) rmSync(join(REPO, 'memory', 'tmp', f), { force: true })

const tid = String(task).toUpperCase()
const t = E2_TASKS[tid]
const dir = e2DirOf(arm, tid, round)
rmSync(dir, { recursive: true, force: true })
t.fixture(dir)

const home = arm === 'C' ? HOME_C : HOME_D
const before = logLines().length
const prompt = t.prompt(dir)
const t0 = Date.now()
let out = '', exit = null, timedOut = false
try {
  out = execFileSync(process.execPath, [DSH_BIN, 'headless', prompt], {
    cwd: dir, timeout: 240000, encoding: 'utf8',
    env: { ...process.env, DSH_HOME: home },
  })
  exit = 0
} catch (e) {
  exit = e.status ?? null
  out = (e.stdout ?? '') + (e.stderr ?? '')
  timedOut = Boolean(e.killed)
}
const durS = ((Date.now() - t0) / 1000).toFixed(1)
const delta = logLines().slice(before).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
const count = (k, f) => delta.filter((l) => l.kind === k && (!f || f(l))).length
const truth = t.verify(dir)
const record = {
  ts: new Date().toISOString(), arm, task: tid, round, home,
  exit, timedOut, durS,
  requests: count('tools-wire'), toolCalls: count('pre-execute'),
  l3Intercept: count('l3-intercept'), l3Detected: count('l3-detected'),
  gateToolCalls: count('gate-tool'), gateToolPass: count('gate-tool', (l) => l.status === 'pass'),
  layeredInject: count('layered-inject'), archiveSteer: count('archive-steer'),
  truth, outputTail: out.slice(-400),
}
let all = []
try { all = JSON.parse(readFileSync(RESULTS, 'utf8')) } catch { all = [] }
all.push(record)
writeFileSync(RESULTS, JSON.stringify(all, null, 2))
console.log(`[${arm}/${tid}/r${round}] exit=${exit} dur=${durS}s truth=${JSON.stringify(truth)} toolCalls=${record.toolCalls} gatePass=${record.gateToolPass} l3I=${record.l3Intercept}`)
console.log(`[e2] 结果已追加 ${RESULTS}（共 ${all.length} 条）`)

function logLines() {
  return existsSync(EXEC_LOG) ? readFileSync(EXEC_LOG, 'utf8').split('\n').filter((l) => l.trim()) : []
}
