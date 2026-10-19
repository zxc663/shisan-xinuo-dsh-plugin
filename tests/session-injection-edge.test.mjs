// 会话级注入「边界」测试（QA 独立造边界，不改工程师的 session-injection.test.mjs）。
// 覆盖：路径穿越/非法 id、纯空白段、总开关一票否决、写后回调、热生效、注册形态、
//       以及 apply 级三步序列（有 system → 空 → 非空）是否会叠加两个同名 complete 段。
// 口径（来自设计，违反即 Bug）：
//   ① 总开关只否决 discipline；② 会话 discipline > 工作区规则 > 全局；③ 会话 user > 全局 user-prompt；
//   ④ 会话 layered 无全局回退；⑤ system 空文本绝不注册 complete；⑥ 非法/空 id 不得抛异常。
import {
  apply,
  ensureStorage,
  makeApi,
  registerDisciplineForAgent,
  rollbackSession,
  readSessionOverride,
  saveScope,
  saveSettings,
  sessionDir,
  sessionDisciplineTextFor,
  sessionLayeredTextFor,
  sessionSystemTextFor,
  sessionUserPromptTextFor,
  writeSessionOverride,
  DISCIPLINE_ORDER,
  DISCIPLINE_SECTION,
  OVERRIDE_SECTION,
  SESSION_LAYERED_ORDER,
  SESSION_LAYERED_SECTION,
  USER_PROMPT_ORDER,
  USER_PROMPT_SECTION,
} from '../src/dsh-custom.ts'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, basename, join, resolve, sep } from 'node:path'

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 假 agent：inject 同步回调，捕获段配置。 */
function makeAgent(id) {
  const sections = []
  const agent = {
    id,
    session: { header: { cwd: null } },
    ctx: {
      inject: (_svcs, cb) => {
        cb({ systemPrompt: { section: (cfg) => { sections.push(cfg); return () => {} } } })
        return { dispose() {} }
      },
    },
  }
  return { agent, sections }
}
const byName = (sections, name) => sections.find((s) => s.name === name)
const completes = (sections) => sections.filter((s) => s.complete === true)

/** 极简 HTTP 调用器：body 传字符串即原样发送（用于「非 JSON」用例）。 */
function callApi(api, method, url, body) {
  return new Promise((done) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body ?? {})
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

// ══════════════════════════════════════════════════════════════════
// A~C / E / F：纯函数层（会话文本求值 + 注册形态）
// ══════════════════════════════════════════════════════════════════
const root = mkdtempSync(join(tmpdir(), 'dshc-edge-'))
try {
  ensureStorage(root)
  writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
  writeFileSync(join(root, 'user-prompt.md'), '全局提示词', 'utf8')

  // ── A. 路径穿越 / 非法 id：不抛、回退全局、不逃出 sessions/ ──
  const evilIds = ['..', '../evil', 'a/b', '../../x', '..\\evil', 'C:\\Windows\\x', '   ', '.', '会话-一', '!!!', null, undefined, 'a'.repeat(300)]
  for (const id of evilIds) {
    let threw = false
    let d = null
    let u = null
    let l = null
    let s = null
    try {
      d = sessionDisciplineTextFor(root, id, null)
      u = sessionUserPromptTextFor(root, id)
      l = sessionLayeredTextFor(root, id)
      s = sessionSystemTextFor(root, id)
    } catch {
      threw = true
    }
    const tag = `id=${String(id).slice(0, 12)}${String(id).length > 12 ? '…' : ''}`
    t(`A ${tag}: 四个 text 助手均不抛异常`, false, threw)
    t(`A ${tag}: discipline 回退全局`, '全局纪律', d)
    t(`A ${tag}: user 回退全局`, '全局提示词', u)
    t(`A ${tag}: layered 无全局回退=空串`, '', l)
    t(`A ${tag}: system 空串（不误挂 complete）`, '', s)
  }
  // 只读求值不得创建 sessions/（否则等于凭空造目录）
  t('A 只读求值不创建 sessions/ 目录', false, existsSync(join(root, 'sessions')))

  // 归一化真实语义（P1-7 硬化 2026-10-19：非规范 id = 净名 + `-x` 短哈希；规范 id 目录名不变）
  const abDir = sessionDir(root, 'a/b')
  t('A 归一: a/b → ab-x<hash>（免撞车硬化）', true, /^ab-x[0-9a-f]{8}$/.test(basename(abDir)))
  t('A 归一: a/b 与 ab 已不同目录（撞车消除）', true, abDir !== sessionDir(root, 'ab'))
  t('A 归一: ../evil → evil-x<hash>', true, /^evil-x[0-9a-f]{8}$/.test(basename(sessionDir(root, '../evil'))))
  t('A 归一: ../../x → x-x<hash>', true, /^x-x[0-9a-f]{8}$/.test(basename(sessionDir(root, '../../x'))))
  t('A 归一: 数字 id → 字符串化（规范形目录名不变）', join(root, 'sessions', '123'), sessionDir(root, 123))
  let threwDot = false
  let threwDotDot = false
  let threwBlank = false
  let threwNull = false
  try { sessionDir(root, '.') } catch { threwDot = true }
  try { sessionDir(root, '..') } catch { threwDotDot = true }
  try { sessionDir(root, '   ') } catch { threwBlank = true }
  try { sessionDir(root, null) } catch { threwNull = true }
  t('A 归一: "." 归一为空 → 抛「非法会话 id」', true, threwDot)
  t('A 归一: ".." 归一为空 → 抛「非法会话 id」', true, threwDotDot)
  t('A 归一: 纯空白归一为空 → 抛', true, threwBlank)
  t('A 归一: null 归一为空 → 抛', true, threwNull)

  // 所有不抛的 id，归一后目录必须严格位于 sessions/ 下一层（不逃逸）
  const sessionsAbs = resolve(root, 'sessions')
  let escape = []
  for (const id of evilIds) {
    let dir = null
    try { dir = sessionDir(root, id) } catch { continue }
    const abs = resolve(dir)
    if (!(abs === sessionsAbs || abs.startsWith(sessionsAbs + sep))) escape.push(String(id))
    else if (abs.split(sep).length !== sessionsAbs.split(sep).length + 1) escape.push(`${String(id)}(层深异常)`)
  }
  t('A 归一: 所有可归一 id 均落在 sessions/ 恰好一层内（无穿越）', [], escape)

  // 写穿透实测：'../evil' 落在 sessions/<evil-x 哈希>，仍未逃出 sessions/ 且不污染 id="evil"
  writeSessionOverride(root, '../evil', { discipline: '穿透写入' })
  const evilDir = sessionDir(root, '../evil')
  t('A 写穿透: 落在 sessions/<净名-x 哈希>/discipline.md（仍在 sessions 内）', true, existsSync(join(evilDir, 'discipline.md')))
  t('A 写穿透: 未落在 root/evil', false, existsSync(join(root, 'evil')))
  t('A 写穿透: 未落在 tmpdir/evil', false, existsSync(join(dirname(root), 'evil')))
  t('A 写穿透: 读回同样走专属目录', '穿透写入', readSessionOverride(root, '../evil').discipline)
  t('A 写穿透: 与 id="evil" 不再同目录（P1-7 撞车消除）', null, readSessionOverride(root, 'evil').discipline)
  rmSync(evilDir, { recursive: true, force: true })

  // ── B. 纯空白段文件 = 无覆盖 ──
  const wsId = 'session-ws'
  mkdirSync(join(root, 'sessions', wsId), { recursive: true })
  for (const seg of ['discipline', 'user', 'layered', 'system']) {
    writeFileSync(join(root, 'sessions', wsId, `${seg}.md`), '\n  \n\t\n', 'utf8')
  }
  t('B 纯空白: discipline 回退全局', '全局纪律', sessionDisciplineTextFor(root, wsId, null))
  t('B 纯空白: user 回退全局', '全局提示词', sessionUserPromptTextFor(root, wsId))
  t('B 纯空白: layered=空串', '', sessionLayeredTextFor(root, wsId))
  t('B 纯空白: system=空串', '', sessionSystemTextFor(root, wsId))
  const wsAgent = makeAgent(wsId)
  registerDisciplineForAgent(wsAgent.agent, root)
  t('B 纯空白: 只注册 3 段（system 不挂 complete）', 3, wsAgent.sections.length)
  t('B 纯空白: complete 段数为 0', 0, completes(wsAgent.sections).length)

  // BOM / CRLF 变体
  writeFileSync(join(root, 'sessions', wsId, 'system.md'), '\uFEFF', 'utf8')
  t('B 仅 BOM: system 仍视为空', '', sessionSystemTextFor(root, wsId))
  writeFileSync(join(root, 'sessions', wsId, 'system.md'), '\uFEFF\r\n \r\n', 'utf8')
  t('B BOM+CRLF: system 仍视为空', '', sessionSystemTextFor(root, wsId))
  const wsAgent2 = makeAgent(wsId)
  registerDisciplineForAgent(wsAgent2.agent, root)
  t('B BOM+CRLF: 仍只 3 段', 3, wsAgent2.sections.length)

  // ── C. 总开关：只否决 discipline，user/layered/system 不受影响 ──
  const swId = 'session-sw'
  writeSessionOverride(root, swId, { discipline: '会话纪律', user: '会话提示词', layered: '会话路由', system: '会话系统' })
  saveSettings(root, { injectEnabled: false })
  t('C 总开关关: discipline=空（会话覆盖不得绕过）', '', sessionDisciplineTextFor(root, swId, null))
  t('C 总开关关: user 仍走会话', '会话提示词', sessionUserPromptTextFor(root, swId))
  t('C 总开关关: layered 仍走会话', '会话路由', sessionLayeredTextFor(root, swId))
  t('C 总开关关: system 仍走会话', '会话系统', sessionSystemTextFor(root, swId))
  const swAgent = makeAgent(swId)
  registerDisciplineForAgent(swAgent.agent, root)
  t('C 总开关关: 注册后 discipline 段 text()=空', '', byName(swAgent.sections, DISCIPLINE_SECTION).text())
  t('C 总开关关: system 仍注册 complete（4 段）', 4, swAgent.sections.length)
  t('C 总开关关: 仅 1 个 complete', 1, completes(swAgent.sections).length)
  saveSettings(root, { injectEnabled: true })
  t('C 总开关开: discipline 恢复会话覆盖', '会话纪律', byName(swAgent.sections, DISCIPLINE_SECTION).text())
  t('C 总开关开: 直接求值恢复', '会话纪律', sessionDisciplineTextFor(root, swId, null))

  // 总开关关 + 无会话覆盖 → 全局纪律也不注入
  saveSettings(root, { injectEnabled: false })
  t('C 总开关关: 无会话覆盖时全局纪律同样为空', '', sessionDisciplineTextFor(root, 'session-none', null))
  saveSettings(root, { injectEnabled: true })

  // ── 口径②：会话 discipline > 工作区规则 > 全局 ──
  saveScope(root, [{ path: 'D:/proj/demo', mode: 'exact', text: '工作区规则文本' }])
  t('口径② 无会话覆盖: 命中工作区规则', '工作区规则文本', sessionDisciplineTextFor(root, 'session-none', 'D:/proj/demo'))
  writeFileSync(join(root, 'sessions', wsId, 'discipline.md'), '\n \n', 'utf8') // 空白=无覆盖
  t('口径② 会话为空白: 仍走工作区规则（不是全局）', '工作区规则文本', sessionDisciplineTextFor(root, wsId, 'D:/proj/demo'))
  writeSessionOverride(root, wsId, { discipline: '会话纪律-压规则' })
  t('口径② 会话非空: 压过工作区规则', '会话纪律-压规则', sessionDisciplineTextFor(root, wsId, 'D:/proj/demo'))
  t('口径② 会话非空 + 无 cwd: 仍是会话文本', '会话纪律-压规则', sessionDisciplineTextFor(root, wsId, null))
  saveScope(root, [])

  // ── E. 热生效：注册后改文件，text() 立即反映 ──
  const hotId = 'session-hot'
  writeSessionOverride(root, hotId, { discipline: '纪律-A', system: '系统-A' })
  const hot = makeAgent(hotId)
  registerDisciplineForAgent(hot.agent, root)
  const hotDisc = byName(hot.sections, DISCIPLINE_SECTION)
  const hotSys = byName(hot.sections, OVERRIDE_SECTION)
  t('E 热生效: 初值 discipline', '纪律-A', hotDisc.text())
  t('E 热生效: 初值 system', '系统-A', hotSys.text())
  await sleep(20)
  writeFileSync(join(root, 'sessions', hotId, 'discipline.md'), '纪律-B-更长内容', 'utf8')
  writeFileSync(join(root, 'sessions', hotId, 'system.md'), '系统-B-更长内容', 'utf8')
  t('E 热生效: 改文件后 discipline 立即变', '纪律-B-更长内容', hotDisc.text())
  t('E 热生效: 改文件后 system 立即变', '系统-B-更长内容', hotSys.text())
  unlinkSync(join(root, 'sessions', hotId, 'discipline.md'))
  t('E 热生效: 删除文件后 discipline 回退全局', '全局纪律', hotDisc.text())
  // 已修（D1）：system 段是 complete，「挂不挂」在注册期定死；组装期文本变空时仍挂着，
  // 但 text() 有兜底不变量——永不返回空串（无全局接管时回落最后非空值）。
  unlinkSync(join(root, 'sessions', hotId, 'system.md'))
  t('E: system 外部删除后 complete 段仍注册', true, byName(hot.sections, OVERRIDE_SECTION) !== undefined)
  t('E: system 外部删除后 text() 不返回空串（回落最后非空值）', '系统-B-更长内容', byName(hot.sections, OVERRIDE_SECTION).text())

  // ── F. 注册形态 ──
  const shapeEmpty = makeAgent('session-shape-empty')
  let cbCalls = 0
  const r1 = registerDisciplineForAgent(shapeEmpty.agent, root, () => { cbCalls++ })
  t('F 无 system: 恰好 3 段', 3, shapeEmpty.sections.length)
  t('F 无 system: 段名与顺序', [DISCIPLINE_SECTION, USER_PROMPT_SECTION, SESSION_LAYERED_SECTION], shapeEmpty.sections.map((s) => s.name))
  t('F 无 system: 段序常量', [DISCIPLINE_ORDER, USER_PROMPT_ORDER, SESSION_LAYERED_ORDER], shapeEmpty.sections.map((s) => s.order))
  t('F 无 system: 三段均 interpolate=false', [false, false, false], shapeEmpty.sections.map((s) => s.interpolate))
  t('F 无 system: 无 complete', 0, completes(shapeEmpty.sections).length)
  t('F 无 system: 无 override 段', undefined, byName(shapeEmpty.sections, OVERRIDE_SECTION))
  t('F 无 system: onSystemSection 未被调用', 0, cbCalls)
  t('F 无 system: 返回可 await/dispose 的句柄', true, r1 !== undefined)

  const shapeSys = makeAgent('session-shape-sys')
  writeSessionOverride(root, 'session-shape-sys', { system: '系统段文本' })
  let gotDispose = null
  registerDisciplineForAgent(shapeSys.agent, root, (d) => { gotDispose = d })
  t('F 有 system: 恰好 4 段', 4, shapeSys.sections.length)
  t('F 有 system: 仅 1 个 complete', 1, completes(shapeSys.sections).length)
  t('F 有 system: complete 段是 override 且 order=0', { name: OVERRIDE_SECTION, order: 0 }, {
    name: completes(shapeSys.sections)[0].name,
    order: completes(shapeSys.sections)[0].order,
  })
  t('F 有 system: 其余三段均非 complete', [false, false, false], shapeSys.sections.filter((s) => s.name !== OVERRIDE_SECTION).map((s) => s.complete === true))
  t('F 有 system: onSystemSection 收到注销函数', 'function', typeof gotDispose)
  let disposeThrew = false
  try { gotDispose() } catch { disposeThrew = true }
  t('F 有 system: 注销函数可安全调用', false, disposeThrew)

  // 旧两参调用兼容
  const legacy = makeAgent('session-legacy')
  let legacyThrew = false
  try { registerDisciplineForAgent(legacy.agent, root) } catch { legacyThrew = true }
  t('F 旧两参调用: 不抛异常', false, legacyThrew)
  t('F 旧两参调用: 仍注册 3 段', 3, legacy.sections.length)
} finally {
  rmSync(root, { recursive: true, force: true })
}

// ══════════════════════════════════════════════════════════════════
// D. 写后回调（makeApi 第 7 参）
// ══════════════════════════════════════════════════════════════════
const root2 = mkdtempSync(join(tmpdir(), 'dshc-edge-api-'))
try {
  ensureStorage(root2)
  const seen = []
  const api = makeApi(root2, () => null, { denied: 0, touched: 0 }, undefined, undefined, undefined, (id) => seen.push(id))

  const p1 = await callApi(api, 'PUT', '/api/dsh-custom/sessions/session-abc/override', { segments: { system: '会话系统' } })
  t('D PUT override: 200 且 ok', true, p1.code === 200 && p1.body.ok === true)
  t('D PUT override: 回调一次且 id 正确', ['session-abc'], seen)
  t('D PUT override: 落盘生效', '会话系统', readSessionOverride(root2, 'session-abc').system)

  seen.length = 0
  const p2 = await callApi(api, 'PUT', '/api/dsh-custom/sessions/a%2Fb/override', { segments: { user: 'x' } })
  t('D PUT 编码 id: 回调参数是解码后的 id', ['a/b'], seen)
  t('D PUT 编码 id: 落盘走 a/b 专属目录', 'x', readSessionOverride(root2, 'a/b').user)
  t('D PUT 编码 id: 未污染 id=ab 目录（P1-7 撞车消除）', null, readSessionOverride(root2, 'ab').user)
  t('D PUT 编码 id: 200', 200, p2.code)

  seen.length = 0
  const p3 = await callApi(api, 'POST', '/api/dsh-custom/sessions/session-abc/rollback', { target: 'official' })
  t('D POST rollback: 回调一次', ['session-abc'], seen)
  t('D POST rollback: 200 且 ok', true, p3.code === 200 && p3.body.ok === true)
  t('D POST rollback: 已清空覆盖', null, readSessionOverride(root2, 'session-abc').system)

  seen.length = 0
  const p4 = await callApi(api, 'PUT', '/api/dsh-custom/sessions/session-abc/override', '{不是 JSON')
  t('D 非法 JSON: 400', 400, p4.code)
  t('D 非法 JSON: 回调不被调用', [], seen)

  seen.length = 0
  const p5 = await callApi(api, 'PUT', '/api/dsh-custom/sessions/../override', { segments: { system: 'x' } })
  t('D 非法 id(..): 400 且不崩', true, p5.code === 400 && p5.body.ok === false)
  t('D 非法 id(..): 回调不被调用（写入失败即不通知）', [], seen)

  seen.length = 0
  const p6 = await callApi(api, 'PUT', '/api/dsh-custom/sessions/session-abc/override', {})
  t('D 空 body: 200（无段写入）', 200, p6.code)
  t('D 空 body: 仍回调一次（观测：通知语义=请求成功，非「有变更」）', ['session-abc'], seen)

  seen.length = 0
  const apiBoom = makeApi(root2, () => null, { denied: 0, touched: 0 }, undefined, undefined, undefined, () => {
    throw new Error('重同步炸了')
  })
  const p7 = await callApi(apiBoom, 'PUT', '/api/dsh-custom/sessions/session-abc/override', { segments: { user: 'y' } })
  t('D 回调抛错: 不影响保存结果（仍 200 ok）', true, p7.code === 200 && p7.body.ok === true)

  const p8 = await callApi(api, 'GET', '/api/dsh-custom/sessions/session-abc/override')
  t('D GET override: 200 且返回四段', true, p8.code === 200 && Object.keys(p8.body.value.segments).sort().join(',') === 'discipline,layered,system,user')

  const legacyApi = makeApi(root2, () => null, { denied: 0, touched: 0 })
  t('D 旧三参 makeApi: 仍返回函数', 'function', typeof legacyApi)
  const p9 = await callApi(legacyApi, 'PUT', '/api/dsh-custom/sessions/session-legacy/override', { segments: { user: 'z' } })
  t('D 旧三参 makeApi: PUT 仍可用（无回调不崩）', true, p9.code === 200 && p9.body.ok === true)
} finally {
  rmSync(root2, { recursive: true, force: true })
}

// ══════════════════════════════════════════════════════════════════
// G. apply 级：写后重同步的三步序列（system 有 → 空 → 非空）不得叠加同名 complete
// 手法：mock cordis ctx（inject/effect/on）＋ fiber 语义（fiber.dispose 只摘本 fiber 注册的段）
// ══════════════════════════════════════════════════════════════════
function makeScope() {
  const sections = []
  let current = null
  const scope = {
    sections,
    systemPrompt: {
      section(cfg) {
        sections.push(cfg)
        const dispose = () => {
          const i = sections.indexOf(cfg)
          if (i >= 0) sections.splice(i, 1)
        }
        if (current !== null) current.push(dispose)
        return dispose
      },
    },
    effect(fn) {
      const d = fn()
      if (typeof d === 'function' && current !== null) current.push(d)
      return { dispose() { if (typeof d === 'function') d() } }
    },
    fiber(cb) {
      const bag = []
      const prev = current
      current = bag
      try { cb(scope) } finally { current = prev }
      return {
        dispose() {
          while (bag.length > 0) {
            const d = bag.pop()
            try { d() } catch { /* fiber 内单段失败不阻塞 */ }
          }
        },
      }
    },
  }
  return scope
}

const home = mkdtempSync(join(tmpdir(), 'dshc-edge-home-'))
const prevHome = process.env.DSH_HOME
const origLog = console.log
const origWarn = console.warn
try {
  process.env.DSH_HOME = home
  const syncRoot = join(home, 'dsh-custom')

  const agentsMap = new Map()
  const listeners = {}
  const routes = []
  const agentsApi = {
    list: () => [...agentsMap.values()],
    get: (id) => agentsMap.get(id) ?? null,
    on: (ev, cb) => {
      ;(listeners[ev] ??= []).push(cb)
      return () => {}
    },
  }
  const globalScope = makeScope()
  const agentScopes = new Map()
  const makeRealAgent = (id) => {
    const scope = makeScope()
    const agent = { id, session: { header: { cwd: null } }, ctx: { inject: (_s, cb) => scope.fiber(cb) } }
    agentScopes.set(agent, scope)
    return agent
  }
  const ctx = {
    effect(fn) {
      const d = fn()
      return { dispose() { if (typeof d === 'function') d() } }
    },
    inject(svcs, cb) {
      if (svcs[0] === 'systemPrompt') return globalScope.fiber(cb)
      if (svcs[0] === 'agents') {
        cb({
          agents: agentsApi,
          on: (ev, fn) => {
            ;(listeners[ev] ??= []).push(fn)
            return () => {}
          },
        })
        return { dispose() {} }
      }
      if (svcs[0] === 'webServer') {
        cb({
          webServer: { register: (route) => { routes.push(route); return () => {} } },
          effect: (fn) => globalScope.effect(fn),
        })
        return { dispose() {} }
      }
      return { dispose() {} }
    },
    on: () => () => {},
  }

  const ag = makeRealAgent('session-sync')
  agentsMap.set('session-sync', ag)
  console.log = () => {}
  console.warn = () => {}
  const disposeAll = apply(ctx)
  console.log = origLog
  console.warn = origWarn

  const scopeOf = (agent) => agentScopes.get(agent)
  t('G apply: 返回 dispose 函数', 'function', typeof disposeAll)
  t('G apply: 已挂载 api 路由', 1, routes.length)
  t('G apply: 初始 3 段（无 system 文件）', 3, scopeOf(ag).sections.length)
  t('G apply: 初始 0 个 complete', 0, completes(scopeOf(ag).sections).length)

  const api = routes[0].handler
  const put = (id, segments) => callApi(api, 'PUT', `/api/dsh-custom/sessions/${id}/override`, { segments })

  // 步骤 1：保存非空 system → 4 段 / 1 complete
  await put('session-sync', { system: '系统一' })
  t('G 三步① 非空 system: 4 段', 4, scopeOf(ag).sections.length)
  t('G 三步① 非空 system: 恰 1 个 complete', 1, completes(scopeOf(ag).sections).length)
  t('G 三步① 非空 system: text() 为新文本', '系统一', completes(scopeOf(ag).sections)[0].text())

  // 步骤 2：保存为空 → 摘掉 complete（回到 3 段）
  await put('session-sync', { system: '' })
  t('G 三步② 保存为空: 回到 3 段', 3, scopeOf(ag).sections.length)
  t('G 三步② 保存为空: 0 个 complete', 0, completes(scopeOf(ag).sections).length)

  // 步骤 3：再保存非空 → 仍只 1 个 complete（不叠加）
  await put('session-sync', { system: '系统二' })
  t('G 三步③ 再保存非空: 4 段', 4, scopeOf(ag).sections.length)
  t('G 三步③ 再保存非空: 仍只 1 个 complete（不叠加）', 1, completes(scopeOf(ag).sections).length)
  t('G 三步③ 再保存非空: text() 为最新文本', '系统二', completes(scopeOf(ag).sections)[0].text())

  // 连续两次非空保存（最容易叠加的场景）
  await put('session-sync', { system: '系统三' })
  t('G 连续保存: 仍只 1 个 complete', 1, completes(scopeOf(ag).sections).length)
  t('G 连续保存: 3 个非 complete 段未被误摘', 3, scopeOf(ag).sections.filter((s) => s.complete !== true).length)

  // discipline/user 走 text() 函数：保存后无需重同步也生效
  await put('session-sync', { discipline: '会话纪律X', user: '会话提示X', layered: '路由X' })
  t('G 热生效(经 api): discipline', '会话纪律X', byName(scopeOf(ag).sections, DISCIPLINE_SECTION).text())
  t('G 热生效(经 api): user', '会话提示X', byName(scopeOf(ag).sections, USER_PROMPT_SECTION).text())
  t('G 热生效(经 api): layered', '路由X', byName(scopeOf(ag).sections, SESSION_LAYERED_SECTION).text())

  // rollback official → 清空全部覆盖，complete 被摘
  await callApi(api, 'POST', '/api/dsh-custom/sessions/session-sync/rollback', { target: 'official' })
  t('G 回滚 official: 0 个 complete', 0, completes(scopeOf(ag).sections).length)
  t('G 回滚 official: discipline 回退全局（全局为空串）', '', byName(scopeOf(ag).sections, DISCIPLINE_SECTION).text())

  // 未活跃会话：保存后 syncSessionSystem 早退，不抛、不建段
  const pUnknown = await put('session-not-active', { system: '孤儿系统' })
  t('G 未活跃会话: 保存仍 200', 200, pUnknown.code)
  t('G 未活跃会话: 不产生额外段', 3, scopeOf(ag).sections.length)

  // agent/disposed：作用域段与 system 句柄都清理
  for (const cb of listeners['agent/disposed'] ?? []) cb({ agent: ag })
  t('G agent/disposed: 该 agent 作用域段全部摘除', 0, scopeOf(ag).sections.length)

  // 同 id 新 agent 重建：按当时文件重新判定（不残留旧 complete）
  writeSessionOverride(syncRoot, 'session-sync', { system: '重建系统' })
  const ag2 = makeRealAgent('session-sync')
  agentsMap.set('session-sync', ag2)
  for (const cb of listeners['agent/created'] ?? []) cb({ agent: ag2 })
  t('G 重建 agent: 4 段', 4, scopeOf(ag2).sections.length)
  t('G 重建 agent: 恰 1 个 complete', 1, completes(scopeOf(ag2).sections).length)

  // 重建后写空 → 摘掉；再写非空 → 仍 1 个（跨 agent 生命周期也不叠加）
  await put('session-sync', { system: '' })
  t('G 重建后写空: 3 段', 3, scopeOf(ag2).sections.length)
  await put('session-sync', { system: '再写非空' })
  t('G 重建后再写非空: 恰 1 个 complete', 1, completes(scopeOf(ag2).sections).length)

  let disposeThrew = false
  try { disposeAll() } catch { disposeThrew = true }
  t('G 整体 dispose: 不抛异常', false, disposeThrew)
} finally {
  console.log = origLog
  console.warn = origWarn
  if (prevHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = prevHome
  rmSync(home, { recursive: true, force: true })
}

console.log(lines.join('\n'))
console.log(`\n=== session-injection-edge: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
