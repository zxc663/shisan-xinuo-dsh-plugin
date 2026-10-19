// P1-2 会话视图真源：/api/dsh-custom/sessions 的 title/model 解析链回归
//   模型 = sessionProjections.stateOf(s,'modelSelection').pending??lastUsed → session.requestHeader().config
//          → agentDefaultModel.currentSelection() → 旧 header.model
//   标题 = sessionProjections.stateOf(s,'title') → sessionTitle.get(s).title → 旧 header.title
// 覆盖：全服务在场 / 服务缺失（headless 型） / 服务抛错（单会话降级不拖累列表）/ 空白会话回落默认模型 / legacy 字段。
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../src/dsh-custom.ts'

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

/** 极简 HTTP 调用器（同 session-fixes 口径）。 */
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

/** 极简 systemPrompt scope（段注册表＋注销）。 */
function makeScope() {
  const sections = []
  const scope = {
    sections,
    systemPrompt: {
      section(cfg) {
        sections.push(cfg)
        return () => {
          const i = sections.indexOf(cfg)
          if (i >= 0) sections.splice(i, 1)
        }
      },
    },
    effect(fn) {
      const d = fn()
      return { dispose() { if (typeof d === 'function') d() } }
    },
    fiber(cb) {
      cb(scope)
      return { dispose() {} }
    },
  }
  return scope
}

/**
 * 起一个 apply 级宿主。
 * @param opts.view 可选的视图服务组 {sessionTitle, sessionProjections, agentDefaultModel}；
 *                   缺省=服务全缺失（旧宿主/headless 型）。设为 null 键则不注入该服务。
 */
function bootHost(opts = {}) {
  const home = mkdtempSync(join(tmpdir(), 'dshc-p47-'))
  const prevHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const scope = makeScope()
  const agentsMap = new Map()
  const routes = []
  const view = opts.view || {}
  const makeAgent = (id, session) => ({
    id,
    session,
    ctx: { inject: (_svcs, cb) => { cb(scope); return { dispose() {} } } },
  })
  const agentsApi = {
    list: () => [...agentsMap.values()],
    get: (id) => agentsMap.get(id) ?? null,
    on: () => () => {},
  }
  const ctx = {
    effect(fn) { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } },
    inject(svcs, cb) {
      const name = svcs[0]
      if (name === 'systemPrompt') { cb(scope); return { dispose() {} } }
      if (name === 'agents') { cb({ agents: agentsApi, on: () => () => {} }); return { dispose() {} } }
      if (name === 'webServer') {
        cb({
          webServer: { register: (route) => { routes.push(route); return () => {} } },
          effect: (fn) => { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } },
        })
        return { dispose() {} }
      }
      if (Object.prototype.hasOwnProperty.call(view, name) && view[name] !== null && view[name] !== undefined) {
        cb({ [name]: view[name] })
        return { dispose() {} }
      }
      return { dispose() {} } // 服务缺失：不回调（refs 留空）
    },
    on: () => () => {},
  }
  const origLog = console.log
  console.log = () => {}
  try {
    apply(ctx)
  } finally {
    console.log = origLog
  }
  return {
    mkAgent: (id, session) => { const a = makeAgent(id, session); agentsMap.set(id, a); return a },
    api: routes[0].handler,
    restore() {
      if (prevHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = prevHome
      rmSync(home, { recursive: true, force: true })
    },
  }
}

const listSessions = async (api) => {
  const r = await callApi(api, 'GET', '/api/dsh-custom/sessions', null)
  return { code: r.code, sessions: r.body?.value?.sessions }
}
const pick = (sessions, id) => sessions.find((s) => s.id === id)

// ══════════════════════════════════════════════════════════════════
// 1. 全服务在场：投影优先（pending 盖 lastUsed）；标题三来源优先级
// ══════════════════════════════════════════════════════════════════
{
  const host = bootHost({
    view: {
      sessionTitle: { get: (s) => s.titleSnapshot },
      sessionProjections: { stateOf: (s, key) => (s.proj ? s.proj[key] : undefined) },
      agentDefaultModel: { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) },
    },
  })
  try {
    const sa = host.mkAgent('session-a', {
      header: { cwd: 'D:\\a' },
      proj: {
        title: '归档任务',
        modelSelection: { pending: null, lastUsed: { provider: 'deepseek-account', model: 'deepseek-flash' } },
      },
      requestHeader: () => ({ config: { provider: 'ignored', model: 'ignored' } }),
    })
    const sb = host.mkAgent('session-b', {
      header: { cwd: 'D:\\b' },
      proj: {
        modelSelection: { pending: { provider: 'dsh-go', model: 'longcat-2.5-preview-free' }, lastUsed: null },
      },
      titleSnapshot: { title: 'B 会话' },
    })
    const sc = host.mkAgent('session-c', { header: { cwd: 'D:\\c' } }) // 空白：无投影无标题无请求头
    const { code, sessions } = await listSessions(host.api)
    t('全服务: HTTP 200', 200, code)
    t('全服务: A 标题=投影值', '归档任务', pick(sessions, sa.id).title)
    t('全服务: A 模型=lastUsed 回退（pending=null）', 'deepseek-account/deepseek-flash', pick(sessions, sa.id).model)
    t('全服务: B 标题=sessionTitle.get 快照（投影无 title 键）', 'B 会话', pick(sessions, sb.id).title)
    t('全服务: B 模型=pending 优先', 'dsh-go/longcat-2.5-preview-free', pick(sessions, sb.id).model)
    t('全服务: C 模型=默认模型回落', 'deepseek-account/deepseek-flash', pick(sessions, sc.id).model)
    t('全服务: C 标题=null', null, pick(sessions, sc.id).title)
  } finally {
    host.restore()
  }
}

// ══════════════════════════════════════════════════════════════════
// 2. 服务全缺失（旧宿主/headless）：legacy header 字段回落，不抛错
// ══════════════════════════════════════════════════════════════════
{
  const host = bootHost({ view: {} })
  try {
    host.mkAgent('session-old', { header: { cwd: 'D:\\old', title: '旧字段标题', model: 'legacy-provider/legacy-model' } })
    host.mkAgent('session-bare', { header: { cwd: null } })
    const { code, sessions } = await listSessions(host.api)
    t('服务缺失: HTTP 200', 200, code)
    t('服务缺失: legacy title/model 可用', { title: '旧字段标题', model: 'legacy-provider/legacy-model' }, {
      title: pick(sessions, 'session-old').title,
      model: pick(sessions, 'session-old').model,
    })
    t('服务缺失: 无值会话 title=null', null, pick(sessions, 'session-bare').title)
    t('服务缺失: 无值会话 model=null', null, pick(sessions, 'session-bare').model)
  } finally {
    host.restore()
  }
}

// ══════════════════════════════════════════════════════════════════
// 3. 服务抛错：单会话降级到下一来源，整表仍 200
// ══════════════════════════════════════════════════════════════════
{
  const host = bootHost({
    view: {
      sessionTitle: { get: () => { throw new Error('title 服务炸了') } },
      sessionProjections: { stateOf: () => { throw new Error('投影炸了') } },
      agentDefaultModel: { currentSelection: () => { throw new Error('默认模型炸了') } },
    },
  })
  try {
    host.mkAgent('session-throw', {
      header: { cwd: 'D:\\t', title: '兜底标题', model: 'fb/pick' },
      requestHeader: () => ({ config: { provider: 'req', model: 'header' } }),
    })
    const { code, sessions } = await listSessions(host.api)
    t('服务抛错: HTTP 200（不拖累整表）', 200, code)
    t('服务抛错: 模型=requestHeader 回落', 'req/header', pick(sessions, 'session-throw').model)
    t('服务抛错: 标题=legacy 回落', '兜底标题', pick(sessions, 'session-throw').title)
  } finally {
    host.restore()
  }
}

// ══════════════════════════════════════════════════════════════════
// 4. 边界：空白标题/半截模型选择不当作有效值；空 agent 表返回 []
// ══════════════════════════════════════════════════════════════════
{
  const host = bootHost({
    view: {
      sessionTitle: { get: () => ({ title: '   ' }) },
      sessionProjections: {
        stateOf: (s, key) => (key === 'title'
          ? '  '
          : { pending: { provider: 'only-provider' }, lastUsed: null }),
      },
      agentDefaultModel: { currentSelection: () => ({ provider: '', model: '' }) },
    },
  })
  try {
    host.mkAgent('session-blank', { header: { cwd: 'D:\\z' }, requestHeader: () => undefined })
    const { sessions } = await listSessions(host.api)
    t('边界: 空白标题→null', null, pick(sessions, 'session-blank').title)
    t('边界: 半截选择（仅 provider）→null', null, pick(sessions, 'session-blank').model)
  } finally {
    host.restore()
  }
  const host2 = bootHost({ view: {} })
  try {
    const { code, sessions } = await listSessions(host2.api)
    t('边界: 空列表 HTTP 200 且 sessions=[]', { code: 200, sessions: [] }, { code, sessions })
  } finally {
    host2.restore()
  }
}

console.log(lines.join('\n'))
console.log(`\n=== p47-session-view: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
