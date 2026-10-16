#!/usr/bin/env node
/**
 * go-probe.mjs — OpenCode GO/Zen 免费模型第三方链路探针（可重跑证据工具）
 *
 * 用途（2026-10-16 增设，配套 dsh-opencode-session 反代方案）：
 *   1) 对 GO 反代链路（zen/go/v1）逐模型探活：HTTP 码 / 错误分类 / 延迟，证据落 JSONL；
 *   2) 任一模型失败不影响其他模型（逐模型独立判定）；连续失败 >=3 自动挂起，避免重试风暴（--force 恢复）；
 *   3) --both 时主基地失败再补测 inference 端（区分「模型不存在」与「网关不收录」）。
 *
 * 用法：
 *   node scripts/go-probe.mjs
 *   node scripts/go-probe.mjs --models a,b,c --both --tools --shapes --speed 96
 *   node scripts/go-probe.mjs --quiet   # 供 cron/heartbeat：仅打摘要
 *
 * 凭据：OPENCODE_GO_API_KEY（env 优先；否则读 <home>/.credentials.yaml 的 refs 段）。密钥只进请求头，不落盘不打印。
 * 输出：<home>/logs/go-probe.log（JSONL 追加）+ <home>/logs/go-probe-state.json（覆盖写）
 */
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const has = (n) => argv.includes('--' + n)
const opt = (n, d = '') => {
  const i = argv.indexOf('--' + n)
  return i >= 0 && argv[i + 1] && !String(argv[i + 1]).startsWith('--') ? argv[i + 1] : d
}

const HOME = path.resolve(opt('home', process.env.DSH_HOME || 'D:/ai本地模型/dsh'))
const BASE_GO = opt('base', 'https://opencode.ai/zen/go/v1')
const BASE_INF = opt('base2', 'https://opencode.ai/inference/openai/v1')
const BOTH = has('both')
const TOOLS = has('tools')
const SHAPES = has('shapes')
const SPEED = Number(opt('speed', '0'))
const FORCE = has('force')
const QUIET = has('quiet')
const TIMEOUT = Number(opt('timeout', '45000'))
const MODELS = (opt('models', '') || 'longcat-2.5-preview-free,step-5-preview-free,deepseek-v4.1-flash,deepseek-v4.1-flash-free').split(',').map((s) => s.trim()).filter(Boolean)

const LOG = path.join(HOME, 'logs', 'go-probe.log')
const STATE_F = path.join(HOME, 'logs', 'go-probe-state.json')
const SESSION = 'session-goprobe-' + new Date().toISOString().slice(0, 10).replace(/-/g, '')

function appendLog(obj) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true })
  fs.appendFileSync(LOG, JSON.stringify(obj) + '\n')
}

function readKey() {
  if (process.env.OPENCODE_GO_API_KEY) return process.env.OPENCODE_GO_API_KEY.trim()
  try {
    const txt = fs.readFileSync(path.join(HOME, '.credentials.yaml'), 'utf8')
    const m = txt.match(/OPENCODE_GO_API_KEY\s*:\s*["']?([^\s"'\r\n]+)["']?/)
    if (m && m[1] && m[1].length >= 12) return m[1]
  } catch {}
  return ''
}

function classify(status, text) {
  if (status === 0) return 'net'
  if (status === 200) return 'ok'
  const t = String(text || '')
  if (/quota|usage limit|balance|exceed/i.test(t)) return 'quota'
  if (/INVALID_CREDENTIAL|credential|unauthor/i.test(t)) return 'auth'
  if (/unavailable|not found|unknown model|no such model|does not exist|invalid model/i.test(t)) return 'model'
  if (/region|not available in/i.test(t)) return 'region'
  if (status === 429) return 'rate'
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'endpoint'
  if (status >= 500) return 'server'
  return 'http' + status
}

const KEY = readKey()
if (!KEY) {
  console.error('NO_KEY: OPENCODE_GO_API_KEY not found (env or .credentials.yaml)')
  process.exit(2)
}

const HEADERS = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${KEY}`,
  'x-opencode-session': SESSION,
  'User-Agent': 'dsh-go-probe/0.1 (coding-agent)',
})

async function post(base, pathName, body) {
  const t0 = Date.now()
  try {
    const res = await fetch(`${base}${pathName}`, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT),
    })
    const txt = await res.text()
    let j = null
    try { j = JSON.parse(txt) } catch {}
    return { status: res.status, ms: Date.now() - t0, txt, j }
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, txt: e?.name === 'TimeoutError' ? 'timeout' : String(e), j: null }
  }
}

const snip = (t, n = 160) => String(t).replace(/\s+/g, ' ').slice(0, n)

async function main() {
  let prev = {}
  try { prev = JSON.parse(fs.readFileSync(STATE_F, 'utf8')).results || {} } catch {}

  const rows = []
  let listNote = ''
  try {
    const r = await fetch(`${BASE_GO}/models`, { headers: { Authorization: `Bearer ${KEY}`, 'User-Agent': 'dsh-go-probe/0.1' }, signal: AbortSignal.timeout(TIMEOUT) })
    const t = await r.text()
    let n = null
    try { const j = JSON.parse(t); if (Array.isArray(j.data)) n = j.data.length } catch {}
    listNote = `GET /models -> ${r.status} items=${n === null ? 'n/a' : n}`
    appendLog({ ts: new Date().toISOString(), kind: 'models-list', status: r.status, items: n })
  } catch (e) {
    listNote = 'GET /models -> ERR ' + snip(String(e), 80)
    appendLog({ ts: new Date().toISOString(), kind: 'models-list', status: 0, err: snip(String(e), 120) })
  }

  for (const model of MODELS) {
    const st = prev[model] || {}
    const fails = Number(st.fails || 0)
    // 仅对基础设施类失败挂起（net/server/rate/timeout）；语义类（model/auth/region）不挂起——保持低频监控「模型是否恢复/开放」
    const infraFail = ['net', 'server', 'rate', 'timeout'].includes(String(st.cls))
    if (!FORCE && fails >= 3 && infraFail) {
      rows.push({ model, cls: 'suspended', http: '-', ms: '-', note: `suspended after ${fails} consecutive fails (use --force)` })
      continue
    }
    const r = await post(BASE_GO, '/chat/completions', { model, messages: [{ role: 'user', content: 'Reply with: ok' }], max_tokens: 8, stream: false })
    const cls = classify(r.status, r.txt)
    appendLog({ ts: new Date().toISOString(), model, base: 'go', status: r.status, cls, ms: r.ms, err: cls === 'ok' ? '' : snip(r.txt) })
    let note = cls === 'ok' ? '' : snip(r.txt, 120)

    if (BOTH && cls !== 'ok') {
      const r2 = await post(BASE_INF, '/chat/completions', { model, messages: [{ role: 'user', content: 'Reply with: ok' }], max_tokens: 8, stream: false })
      const c2 = classify(r2.status, r2.txt)
      appendLog({ ts: new Date().toISOString(), model, base: 'inference', status: r2.status, cls: c2, ms: r2.ms, err: c2 === 'ok' ? '' : snip(r2.txt) })
      note += ` | inference=${c2}(${r2.status})`
    }

    if (cls === 'ok') {
      if (TOOLS) {
        const rt = await post(BASE_GO, '/chat/completions', {
          model,
          messages: [{ role: 'user', content: 'Call the probe_echo tool with text="hello". Do not answer directly.' }],
          max_tokens: 128,
          stream: false,
          tool_choice: 'auto',
          tools: [{ type: 'function', function: { name: 'probe_echo', description: 'Echo text back', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } }],
        })
        const tc = !!(rt.j && rt.j.choices && rt.j.choices[0] && rt.j.choices[0].message && Array.isArray(rt.j.choices[0].message.tool_calls) && rt.j.choices[0].message.tool_calls.length)
        note += ` | tools=${rt.status}${tc ? ' TOOLCALL_YES' : ' TOOLCALL_NO'}`
        appendLog({ ts: new Date().toISOString(), model, kind: 'tools', status: rt.status, tool_calls: tc, ms: rt.ms })
      }
      if (SHAPES) {
        const rr = await post(BASE_GO, '/responses', { model, input: 'Reply with: ok', max_output_tokens: 16 })
        const cr = classify(rr.status, rr.txt)
        note += ` | responses=${cr}(${rr.status},${rr.ms}ms)`
        appendLog({ ts: new Date().toISOString(), model, kind: 'responses', status: rr.status, cls: cr, ms: rr.ms })
      }
      if (SPEED > 0) {
        const rs = await post(BASE_GO, '/chat/completions', { model, messages: [{ role: 'user', content: 'Count from 1 to 80, comma separated, numbers only.' }], max_tokens: SPEED, stream: false })
        const toks = rs.j && rs.j.usage ? (rs.j.usage.completion_tokens ?? rs.j.usage.output_tokens ?? null) : null
        note += ` | speed=${rs.ms}ms tok=${toks === null ? '?' : toks}`
        appendLog({ ts: new Date().toISOString(), model, kind: 'speed', status: rs.status, ms: rs.ms, tokens: toks })
      }
      prev[model] = { fails: 0, cls, at: new Date().toISOString(), ms: r.ms }
    } else {
      prev[model] = { fails: fails + 1, cls, at: new Date().toISOString(), ms: r.ms, err: snip(r.txt, 120) }
    }
    rows.push({ model, cls, http: r.status, ms: r.ms, note })
  }

  fs.mkdirSync(path.dirname(STATE_F), { recursive: true })
  fs.writeFileSync(STATE_F, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE_GO, session: SESSION, listNote, results: prev }, null, 2))

  if (QUIET) {
    const bad = rows.filter((x) => x.cls !== 'ok')
    console.log(`[go-probe] n=${rows.length} ok=${rows.length - bad.length}` + (bad.length ? ` issues: ${bad.map((b) => b.model + '=' + b.cls).join(', ')}` : ''))
  } else {
    console.log(`# go-probe ${new Date().toISOString()} base=${BASE_GO} session=${SESSION}`)
    console.log('# ' + listNote)
    for (const r of rows) console.log(`${r.model} | ${r.http} | ${r.cls} | ${r.ms}ms | ${r.note}`)
    console.log('# state -> ' + STATE_F)
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
