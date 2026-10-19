// 批次B余项回归（P1-3/P1-4/P1-6）：
//   对话折叠 conversationViewOf：只收真人 user + assistant 文本块；注入计入 hidden；超长截断；超上限 omitted
//   快照保留：pruneBackupDir 保留最近 N；snapshot() 自动清理并留痕
//   时间线：listAllSnapshots 并入会话快照；restoreSessionBackup 恢复到「快照时完整段集」
//   导出：snapshotExport 全局/会话；异常名拒绝
//   乐观锁：mtime 不匹配 → 409（discipline / 会话分段）；带正确基线 → 200
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  apply,
  backupDetail,
  conversationViewOf,
  ensureStorage,
  listAllSnapshots,
  pruneBackupDir,
  readSessionOverride,
  restoreSessionBackup,
  saveUserPrompt,
  snapshot,
  snapshotExport,
  writeSessionOverride,
} from '../src/dsh-custom.ts'

let pass = 0
let fail = 0
const lines = []
function t(name, expect, actual) {
  const e = JSON.stringify(expect)
  const a = JSON.stringify(actual)
  if (e === a) {
    pass++
    lines.push(`PASS ${name}`)
  } else {
    fail++
    lines.push(`FAIL ${name}\n  expect=${e}\n  actual=${a}`)
  }
}

/** 极简 HTTP 调用器（同 p47 口径）。 */
function callApi(api, method, url, body) {
  return new Promise((done) => {
    const payload = JSON.stringify(body ?? {})
    const req = {
      method,
      url,
      on: (ev, cb) => {
        if (ev === 'data') setTimeout(() => cb(Buffer.from(payload)), 0)
        else if (ev === 'end') setTimeout(() => cb(), 3)
      },
    }
    const res = {
      code: 0,
      writeHead(c) { this.code = c },
      end(b) { done({ code: this.code, body: JSON.parse(String(b)) }) },
    }
    api(req, res)
  })
}

/** apply 级宿主（agents/session 事件可注入）。 */
function bootHost(opts = {}) {
  const home = mkdtempSync(join(tmpdir(), 'dshc-p48-'))
  const prevHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const sections = []
  const scope = {
    sections,
    systemPrompt: { section(cfg) { sections.push(cfg); return () => {} } },
    effect(fn) { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } },
    fiber(cb) { cb(scope); return { dispose() {} } },
  }
  const agentsMap = new Map()
  const routes = []
  const eventsOf = opts.eventsOf || (() => [])
  const makeAgent = (id, session) => ({ id, session, ctx: { inject: (_s, cb) => { cb(scope); return { dispose() {} } } } })
  const agentsApi = { list: () => [...agentsMap.values()], get: (id) => agentsMap.get(id) ?? null, on: () => () => {} }
  const ctx = {
    effect(fn) { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } },
    inject(svcs, cb) {
      const name = svcs[0]
      if (name === 'systemPrompt') { cb(scope); return { dispose() {} } }
      if (name === 'agents') { cb({ agents: agentsApi, on: () => () => {} }); return { dispose() {} } }
      if (name === 'webServer') {
        cb({ webServer: { register: (route) => { routes.push(route); return () => {} } }, effect: (fn) => { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } } })
        return { dispose() {} }
      }
      return { dispose() {} }
    },
    on: () => () => {},
  }
  const origLog = console.log
  console.log = () => {}
  try { apply(ctx) } finally { console.log = origLog }
  return {
    home,
    mkAgent: (id, session) => { const a = makeAgent(id, session); agentsMap.set(id, a); return a },
    api: routes[0].handler,
    eventsOf,
    restore() {
      if (prevHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = prevHome
      rmSync(home, { recursive: true, force: true })
    },
  }
}

// ══════════════════════════════════════════════════════════════════
// 1. conversationViewOf：过滤 / 计数 / 截断 / 上限
// ══════════════════════════════════════════════════════════════════
{
  const userMsg = (kind, text) => ({ type: 'user/message', time: 1000, data: { source: { kind }, role: 'user', content: [{ type: 'text', text }] } })
  const asstMsg = (blocks) => ({ type: 'assistant/message', time: 2000, data: { message: { role: 'assistant', content: blocks } } })
  const events = [
    userMsg('time-context', 'Time sampled...'),
    userMsg('user', '请修复这个问题'),
    asstMsg([{ type: 'reasoning', text: 'thinking...' }, { type: 'text', text: '收到，我来处理' }, { type: 'tool-call', name: 'pwsh' }]),
    userMsg('skill-catalog', 'catalog...'),
    { type: 'system/message', time: 3000, data: { message: { role: 'system', content: [{ type: 'text', text: 'You are an AI agent...' }] } } },
    userMsg('user', '补充一句'),
    asstMsg([{ type: 'tool-call', name: 'read' }]), // 无文本：不产出也不计数
  ]
  const v = conversationViewOf(events)
  t('对话: 只出 2 真人 + 2 助手（末尾无文本的助手不产出）', ['user', 'assistant', 'user'], v.messages.map((m) => m.role))
  t('对话: 用户文本逐字', '请修复这个问题', v.messages[0].text)
  t('对话: 助手仅 text 块（不含 reasoning/tool-call）', '收到，我来处理', v.messages[1].text)
  t('对话: hidden=3（time-context + skill-catalog + system）', 3, v.hidden)
  t('对话: omitted=0', 0, v.omitted)

  const long = 'x'.repeat(5000)
  const v2 = conversationViewOf([userMsg('user', long)])
  t('对话: 超长截断到 4000', 4000, v2.messages[0].text.length)
  t('对话: 截断标记', true, v2.messages[0].truncated === true)

  const many = []
  for (let i = 0; i < 305; i++) many.push(userMsg('user', `m${String(i)}`))
  const v3 = conversationViewOf(many)
  t('对话: 超 300 条保留最新 300', 300, v3.messages.length)
  t('对话: omitted=5', 5, v3.omitted)
  t('对话: 保留的是最新（首条=m5）', 'm5', v3.messages[0].text)
}

// ══════════════════════════════════════════════════════════════════
// 2. 快照保留：pruneBackupDir + snapshot() 自动清理留痕
// ══════════════════════════════════════════════════════════════════
{
  const root = mkdtempSync(join(tmpdir(), 'dshc-p48-prune-'))
  try {
    ensureStorage(root)
    const bdir = join(root, 'backups')
    // 造 24 个旧快照（细分秒保证字典序）
    for (let i = 0; i < 24; i++) {
      const stamp = `2026-10-18T10-00-${String(10 + Math.floor(i / 10))}-${String(100 + i)}`
      mkdirSync(join(bdir, stamp), { recursive: true })
      writeFileSync(join(bdir, stamp, 'discipline.md'), `v${String(i)}`, 'utf8')
    }
    mkdirSync(join(bdir, 'not-a-stamp'), { recursive: true }) // 非标准名：不得被清理
    const removed = pruneBackupDir(bdir, 20)
    t('清理: 24→20 删 4 个最旧', 4, removed.length)
    t('清理: 最旧的被删', false, existsSync(join(bdir, '2026-10-18T10-00-10-100')))
    t('清理: 非标准目录不动', true, existsSync(join(bdir, 'not-a-stamp')))

    // snapshot() 集成：新增 1 个 → 总数回落 20 并留痕
    const snap = snapshot(root, 'test-prune')
    const stamps = readdirSync(bdir).filter((n) => /^\d{4}-\d{2}-\d{2}T/.test(n))
    t('snapshot 后: 标准快照=20', 20, stamps.length)
    const audit = readFileSync(join(root, 'audit.jsonl'), 'utf8')
    t('snapshot 后: 有 snapshot-pruned 留痕', true, audit.includes('"snapshot-pruned"'))
    t('snapshot 后: 新快照目录存在', true, existsSync(snap))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// 3. 时间线 / 会话快照恢复 / 导出 / 详情
// ══════════════════════════════════════════════════════════════════
{
  const root = mkdtempSync(join(tmpdir(), 'dshc-p48-timeline-'))
  try {
    ensureStorage(root)
    const id = 'session-tl'
    // v1 → v2（v2 写入前的快照= v1 状态）
    writeSessionOverride(root, id, { discipline: 'A', system: 'S1' })
    writeSessionOverride(root, id, { discipline: 'B', user: 'U2' })
    const sessBdir = join(root, 'sessions', id, 'backups')
    const stamps = readdirSync(sessBdir).sort()
    t('会话快照: v2 写入留了 1 份（v1 状态）', 1, stamps.length)
    const snapName = stamps[0]

    // 全局快照也在：时间线并入
    saveUserPrompt(root, 'user text')
    snapshot(root, 'timeline-global')
    const all = listAllSnapshots(root)
    t('时间线: 含全局条目', true, all.some((e) => e.scope === 'global'))
    const sessEntries = all.filter((e) => e.scope === 'session')
    t('时间线: 含会话条目且带 sessionId', true, sessEntries.length === 1 && sessEntries[0].sessionId === id)
    t('时间线: 会话条目 hasOverride=含 system.md', true, sessEntries[0].hasOverride === true)
    t('时间线: 全局条目 scope.sessionId=null', null, all.find((e) => e.scope === 'global').sessionId)

    // 详情（会话域）
    const detail = backupDetail(root, snapName, id)
    t('会话详情: 可读且含 system.md 行', true, detail !== null && detail.files.some((f) => f.file === 'system.md'))
    t('会话详情: 全局域同名查不到（不同根）', null, backupDetail(root, snapName, null))

    // 恢复：回到 v1 完整段集（discipline=A、system=S1、user 删除）
    const rb = restoreSessionBackup(root, id, snapName)
    t('会话恢复: restored 含 discipline/system', ['discipline', 'system'], rb.restored)
    const segs = readSessionOverride(root, id)
    t('会话恢复: discipline 回 A', 'A', segs.discipline)
    t('会话恢复: system 回 S1', 'S1', segs.system)
    t('会话恢复: v2 新增的 user 段被删除', null, segs.user)
    t('会话恢复: 恢复前自动再快照（可反悔）', true, typeof rb.preRestoreSnapshot === 'string' && rb.preRestoreSnapshot !== null)

    // 导出：会话域 + 全局域
    const expS = snapshotExport(root, snapName, id)
    t('导出: 会话域含段文件内容', 'A', expS && expS.files['discipline.md'])
    t('导出: 会话域 scope=session', 'session', expS && expS.scope)
    const globalName = listAllSnapshots(root).find((e) => e.scope === 'global').name
    const expG = snapshotExport(root, globalName, null)
    t('导出: 全局域含 user-prompt.md（TRACKED 补齐生效）', true, expG !== null && typeof expG.files['user-prompt.md'] === 'string')
    t('导出: 非法名=null', null, snapshotExport(root, '../../evil', null))
    t('导出: 不存在=null', null, snapshotExport(root, '2026-01-01T00-00-00-000', null))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// 4. 乐观锁：mtime 不匹配 → 409；正确基线 → 200（discipline + 会话分段）
// ══════════════════════════════════════════════════════════════════
{
  const host = bootHost({
    eventsOf: () => [
      { type: 'user/message', time: 1000, data: { source: { kind: 'user' }, content: [{ type: 'text', text: '你好' }] } },
      { type: 'user/message', time: 1100, data: { source: { kind: 'runtime-context' }, content: [{ type: 'text', text: '注入' }] } },
      { type: 'assistant/message', time: 1200, data: { message: { content: [{ type: 'text', text: '在的' }] } } },
    ],
  })
  try {
    host.mkAgent('session-io', { header: { cwd: null }, snapshotEvents: () => host.eventsOf() })

    // 4a 全局 discipline：错基线 409 → 对基线 200 → 旧基线（已变）409
    const g0 = await callApi(host.api, 'GET', '/api/dsh-custom/discipline')
    t('锁: 初始 mtime 可读', true, g0.body.value.mtime === null || typeof g0.body.value.mtime === 'string')
    const bad = await callApi(host.api, 'PUT', '/api/dsh-custom/discipline', { text: 'x', expectedMtime: '2000-01-01T00:00:00.000Z' })
    t('锁: 错基线 → 409', 409, bad.code)
    t('锁: 409 带 conflict 详情', true, bad.body.conflict !== undefined)
    const ok = await callApi(host.api, 'PUT', '/api/dsh-custom/discipline', { text: '纪律一', expectedMtime: g0.body.value.mtime })
    t('锁: 对基线 → 200', 200, ok.code)
    const stale = await callApi(host.api, 'PUT', '/api/dsh-custom/discipline', { text: '纪律二', expectedMtime: g0.body.value.mtime })
    t('锁: 已被自己改过 → 旧基线 409', 409, stale.code)
    const noCheck = await callApi(host.api, 'PUT', '/api/dsh-custom/discipline', { text: '纪律三' })
    t('锁: 不带基线（兼容旧客户端）→ 200', 200, noCheck.code)

    // 4b 会话分段：expectedMtimes 按段校验
    const s0 = await callApi(host.api, 'GET', '/api/dsh-custom/sessions/session-io/override')
    t('锁: 会话 GET 带 mtimes', true, s0.body.value.mtimes !== undefined && 'discipline' in s0.body.value.mtimes)
    const sbad = await callApi(host.api, 'PUT', '/api/dsh-custom/sessions/session-io/override', { segments: { discipline: 'D1' }, expectedMtimes: { discipline: '2000-01-01T00:00:00.000Z' } })
    t('锁: 会话错基线 → 409', 409, sbad.code)
    const sok = await callApi(host.api, 'PUT', '/api/dsh-custom/sessions/session-io/override', { segments: { discipline: 'D1' }, expectedMtimes: { discipline: null } })
    t('锁: 会话 null 基线（期望不存在）→ 200', 200, sok.code)
    const s1 = await callApi(host.api, 'GET', '/api/dsh-custom/sessions/session-io/override')
    const sok2 = await callApi(host.api, 'PUT', '/api/dsh-custom/sessions/session-io/override', { segments: { discipline: 'D2' }, expectedMtimes: { discipline: s1.body.value.mtimes.discipline } })
    t('锁: 会话对基线 → 200', 200, sok2.code)

    // 4c 对话 API
    const conv = await callApi(host.api, 'GET', '/api/dsh-custom/sessions/session-io/conversation')
    t('对话 API: 200', 200, conv.code)
    t('对话 API: 两条消息（user+assistant）', 2, conv.body.value.messages.length)
    t('对话 API: hidden=1', 1, conv.body.value.hidden)
    const missing = await callApi(host.api, 'GET', '/api/dsh-custom/sessions/no-such/conversation')
    t('对话 API: 未活跃会话 404', 404, missing.code)
  } finally {
    host.restore()
  }
}

console.log(lines.join('\n'))
console.log(`\n=== p48-batch-b: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
