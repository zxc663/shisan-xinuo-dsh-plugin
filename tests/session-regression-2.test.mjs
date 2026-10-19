// 第二轮回归（QA 独立验证 D1/D2/D3 + D6）：重点打「用户主动清空 system 是否真注销段」，
// 防止 D1 的 lastNonEmpty 回落把「清空不生效」这个 P0 级回归掩盖成绿。
// 只新增本文件，不改 src/dsh-custom.ts。
import {
  apply,
  ensureStorage,
  readInjectSettings,
  readScope,
  readSessionOverride,
  rollbackSession,
  saveDiscipline,
  saveScope,
  saveSettings,
  saveUserPrompt,
  sessionDisciplineTextFor,
  sessionLayeredTextFor,
  sessionSystemTextFor,
  sessionUserPromptTextFor,
  writeSessionOverride,
  DISCIPLINE_SECTION,
  OVERRIDE_SECTION,
  SESSION_LAYERED_SECTION,
  USER_PROMPT_SECTION,
} from '../src/dsh-custom.ts'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

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
const completes = (sections) => sections.filter((s) => s.complete === true)
const byName = (sections, name) => sections.find((s) => s.name === name)

function callApi(api, method, url, body) {
  return new Promise((done) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body ?? {})
    const req = {
      method,
      url,
      on: (ev, cb) => {
        if (ev === 'data') setTimeout(() => cb(Buffer.from(payload)), 0)
        else if (ev === 'end') setTimeout(() => cb(), 2)
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

/** 读 audit.jsonl 里某 kind 的条目（可带 session 过滤）。 */
function auditEntries(root, kind, session) {
  const p = join(root, 'audit.jsonl')
  if (!existsSync(p)) return []
  return readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => { try { return JSON.parse(l) } catch { return null } })
    .filter((j) => j !== null && j.kind === kind && (session === undefined || j.session === session))
}
const auditCount = (root, kind, session) => auditEntries(root, kind, session).length

// ══════════════════════════════════════════════════════════════════
// mock cordis：作用域 + fiber 语义（fiber.dispose 只摘本 fiber 注册的段）
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

function bootApply() {
  const agentsMap = new Map()
  const listeners = {}
  const routes = []
  const agentsApi = { list: () => [...agentsMap.values()], get: (id) => agentsMap.get(id) ?? null }
  const globalScope = makeScope()
  const agentScopes = new Map()
  const makeAgent = (id) => {
    const scope = makeScope()
    const agent = { id, session: { header: { cwd: null } }, ctx: { inject: (_s, cb) => scope.fiber(cb) } }
    agentScopes.set(agent, scope)
    agentsMap.set(id, agent)
    return agent
  }
  const ctx = {
    effect(fn) { const d = fn(); return { dispose() { if (typeof d === 'function') d() } } },
    inject(svcs, cb) {
      if (svcs[0] === 'systemPrompt') return globalScope.fiber(cb)
      if (svcs[0] === 'agents') {
        cb({
          agents: agentsApi,
          on: (ev, fn) => { (listeners[ev] ??= []).push(fn); return () => {} },
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
  const origLog = console.log
  const origWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  let disposeAll
  try { disposeAll = apply(ctx) } finally { console.log = origLog; console.warn = origWarn }
  return {
    globalScope, agentScopes, agentsMap, listeners, makeAgent, disposeAll,
    scopeOf: (agent) => agentScopes.get(agent),
    api: routes[0]?.handler,
  }
}

const setHome = (home) => {
  const prev = process.env.DSH_HOME
  process.env.DSH_HOME = home
  return () => {
    if (prev === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prev
  }
}

// ══════════════════════════════════════════════════════════════════
// A. D1 关键回归：用户「主动清空」必须真正注销 complete 段（不能靠 text() 回落续命）
// ══════════════════════════════════════════════════════════════════
{
  const home = mkdtempSync(join(tmpdir(), 'dshc-r2-clear-'))
  const restoreHome = setHome(home)
  try {
    const root = join(home, 'dsh-custom')
    ensureStorage(root)
    writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
    writeSessionOverride(root, 'session-clr', { system: '系统-初版' })

    const h = bootApply()
    const agent = h.makeAgent('session-clr')
    // 等价于宿主新建会话：触发 agent/created 才会走 installScopedDiscipline
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent })

    const sc = () => h.scopeOf(agent)
    const put = (segments) => callApi(h.api, 'PUT', '/api/dsh-custom/sessions/session-clr/override', { segments })

    t('A 初始: 4 段', 4, sc().sections.length)
    t('A 初始: 1 个 complete', 1, completes(sc().sections).length)
    t('A 初始: text()=初版', '系统-初版', byName(sc().sections, OVERRIDE_SECTION).text())

    // ── 主动清空（UI 保存空串）──
    const r1 = await put({ system: '' })
    t('A 清空: HTTP 200', 200, r1.code)
    t('A 清空: 文件已删除', null, readSessionOverride(root, 'session-clr').system)
    t('A 清空: 作用域里没有 override 段（真正注销，非 text 回落）', undefined, byName(sc().sections, OVERRIDE_SECTION))
    t('A 清空: complete 段数为 0（不会继续注入）', 0, completes(sc().sections).length)
    t('A 清空: 回到 3 段', 3, sc().sections.length)
    t('A 清空: 另外三段仍在', [DISCIPLINE_SECTION, USER_PROMPT_SECTION, SESSION_LAYERED_SECTION], sc().sections.map((s) => s.name))
    t('A 清空: sessionSystemTextFor 为空串', '', sessionSystemTextFor(root, 'session-clr'))
    t('A 清空: audit 记了 session-system-cleared', 1, auditCount(root, 'session-system-cleared', 'session-clr'))

    // ── 再保存非空：段必须重新挂上且是新值 ──
    await put({ system: '系统-第二版' })
    t('A 再保存: 4 段', 4, sc().sections.length)
    t('A 再保存: 恰 1 个 complete', 1, completes(sc().sections).length)
    t('A 再保存: text()=新值', '系统-第二版', byName(sc().sections, OVERRIDE_SECTION).text())
    t('A 再保存: audit 记了 session-system-applied', 1, auditCount(root, 'session-system-applied', 'session-clr'))

    // ── 纯空白 = 清空（同判定）──
    await put({ system: '   \n  ' })
    t('A 纯空白: 段被注销', undefined, byName(sc().sections, OVERRIDE_SECTION))
    t('A 纯空白: 0 个 complete', 0, completes(sc().sections).length)
    t('A 纯空白: text 求值为空', '', sessionSystemTextFor(root, 'session-clr'))

    // ── 再挂 → 再清空：不叠加、不残留 ──
    await put({ system: '系统-第三版' })
    t('A 三次: 仍只 1 个 complete', 1, completes(sc().sections).length)
    t('A 三次: text=第三版', '系统-第三版', byName(sc().sections, OVERRIDE_SECTION).text())
    await put({ system: '' })
    t('A 二次清空: 0 个 complete', 0, completes(sc().sections).length)
    t('A 二次清空: audit cleared 累计 3 条（空串/空白/再空串）', 3, auditCount(root, 'session-system-cleared', 'session-clr'))

    // ── 清空时全局深改开着：仍必须注销会话段（全局段在全局作用域，不属本断言）──
    writeFileSync(join(root, 'override.md'), '全局接管文本', 'utf8')
    saveSettings(root, { overrideEnabled: true })
    await put({ system: '系统-第四版' })
    t('A 全局开: 会话段挂上', 1, completes(sc().sections).length)
    t('A 全局开: D6 留痕 session-system-shadows-global', 1, auditCount(root, 'session-system-shadows-global', 'session-clr'))
    await put({ system: '' })
    t('A 全局开 + 清空: 会话段必须注销（不得靠回落全局/最后非空续命）', 0, completes(sc().sections).length)
    t('A 全局开 + 清空: 无 override 段', undefined, byName(sc().sections, OVERRIDE_SECTION))
    t('A 全局开 + 清空: 全局接管段仍在全局作用域', 1, completes(h.globalScope.sections).length)

    // ── rollback official 也要摘段 ──
    await put({ system: '系统-第五版' })
    await callApi(h.api, 'POST', '/api/dsh-custom/sessions/session-clr/rollback', { target: 'official' })
    t('A rollback official: 会话段注销', 0, completes(sc().sections).length)
    t('A rollback official: 回到 3 段', 3, sc().sections.length)

    let threw = false
    try { h.disposeAll() } catch { threw = true }
    t('A 整体 dispose 不抛', false, threw)
  } finally {
    restoreHome()
    rmSync(home, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// B. D1 兜底（无通知的外部删除 / 纯空白）——不返回空串，且 audit 只记一次
// ══════════════════════════════════════════════════════════════════
{
  const home = mkdtempSync(join(tmpdir(), 'dshc-r2-fallback-'))
  const restoreHome = setHome(home)
  try {
    const root = join(home, 'dsh-custom')
    ensureStorage(root)
    writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
    writeSessionOverride(root, 'session-ext', { system: '外部-初版' })

    const h = bootApply()
    const a1 = h.makeAgent('session-ext')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent: a1 })
    const sec1 = () => byName(h.scopeOf(a1).sections, OVERRIDE_SECTION)
    t('B 初值', '外部-初版', sec1().text())

    // 外部删除（不经过 API ⇒ 不触发 syncSessionSystem）
    unlinkSync(join(root, 'sessions', 'session-ext', 'system.md'))
    const v1 = sec1().text()
    const v2 = sec1().text()
    const v3 = sec1().text()
    t('B 外部删除: text() 不返回空串', true, v1.length > 0)
    t('B 外部删除: 回落最后非空值', '外部-初版', v1)
    t('B 外部删除: 多次组装稳定', [v1, v1], [v2, v3])
    t('B 外部删除: audit 只记一次（不每次组装都写）', 1, auditCount(root, 'session-system-empty-at-assemble', 'session-ext'))

    // 纯空白外部写入（不经过 API）同样不返回空串
    writeSessionOverride(root, 'session-ws', { system: 'WS-初版' })
    const a2 = h.makeAgent('session-ws')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent: a2 })
    writeFileSync(join(root, 'sessions', 'session-ws', 'system.md'), '\n  \n\t', 'utf8')
    t('B 纯空白外部写入: 不返回空串', 'WS-初版', byName(h.scopeOf(a2).sections, OVERRIDE_SECTION).text())

    // 全局接管开着 + 会话段失效 ⇒ 回落全局文本（且留痕 fallback=global-override）
    writeFileSync(join(root, 'override.md'), '全局接管文本', 'utf8')
    saveSettings(root, { overrideEnabled: true })
    writeSessionOverride(root, 'session-g', { system: 'G-初版' })
    const a3 = h.makeAgent('session-g')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent: a3 })
    unlinkSync(join(root, 'sessions', 'session-g', 'system.md'))
    t('B 回落全局: text()=全局接管文本', '全局接管文本', byName(h.scopeOf(a3).sections, OVERRIDE_SECTION).text())
    t('B 回落全局: audit fallback=global-override', ['global-override'],
      auditEntries(root, 'session-system-empty-at-assemble', 'session-g').map((j) => j.fallback))

    // 全局接管关闭时，回落走 last-nonempty
    saveSettings(root, { overrideEnabled: false })
    writeSessionOverride(root, 'session-g2', { system: 'G2-初版' })
    const a4 = h.makeAgent('session-g2')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent: a4 })
    unlinkSync(join(root, 'sessions', 'session-g2', 'system.md'))
    t('B 回落最后非空: text()=G2-初版', 'G2-初版', byName(h.scopeOf(a4).sections, OVERRIDE_SECTION).text())
    t('B 回落最后非空: audit fallback=last-nonempty', ['last-nonempty'],
      auditEntries(root, 'session-system-empty-at-assemble', 'session-g2').map((j) => j.fallback))
  } finally {
    restoreHome()
    rmSync(home, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// C. D2 回滚彻底性（正向删除多余段 / 反向不误删）
// ══════════════════════════════════════════════════════════════════
{
  const root = mkdtempSync(join(tmpdir(), 'dshc-r2-rb-'))
  try {
    ensureStorage(root)
    // 正向：v1 只有 discipline，v2 新增 system ⇒ 回滚上一版必须把 system 摘掉
    writeSessionOverride(root, 'c1', { discipline: 'v1' })
    writeSessionOverride(root, 'c1', { discipline: 'v2', system: 'S-新增' })
    const rb1 = rollbackSession(root, 'c1', 'previous')
    t('C 正向: restored 只含快照真实恢复的段', ['discipline'], rb1.restored)
    t('C 正向: cleared 含 system', ['system'], rb1.cleared)
    t('C 正向: system.md 已不存在', false, existsSync(join(root, 'sessions', 'c1', 'system.md')))
    t('C 正向: 读回 system=null', null, readSessionOverride(root, 'c1').system)
    t('C 正向: discipline 回到 v1', 'v1', readSessionOverride(root, 'c1').discipline)
    t('C 正向: 注入口径同步（sessionSystemTextFor 空）', '', sessionSystemTextFor(root, 'c1'))

    // 反向：v1 有 system，v2 删掉 ⇒ 回滚上一版必须把 system 恢复且不得误删
    writeSessionOverride(root, 'c2', { discipline: 'a', system: 'S-原有' })
    writeSessionOverride(root, 'c2', { discipline: 'b' })
    const rb2 = rollbackSession(root, 'c2', 'previous')
    t('C 反向: restored 含 discipline 与 system', true, rb2.restored.includes('discipline') && rb2.restored.includes('system'))
    t('C 反向: cleared 为空（不误删）', [], rb2.cleared)
    t('C 反向: system 内容恢复', 'S-原有', readSessionOverride(root, 'c2').system)
    t('C 反向: discipline 恢复', 'a', readSessionOverride(root, 'c2').discipline)
    t('C 反向: system.md 存在', true, existsSync(join(root, 'sessions', 'c2', 'system.md')))

    // official：四段都在时全部清空
    writeSessionOverride(root, 'c3', { discipline: 'd', user: 'u', layered: 'l', system: 's' })
    const rb3 = rollbackSession(root, 'c3', 'official')
    t('C official: cleared 覆盖四段', ['discipline', 'user', 'layered', 'system'], rb3.cleared)
    t('C official: 目录内四段文件均不存在', [],
      ['discipline', 'user', 'layered', 'system'].filter((s) => existsSync(join(root, 'sessions', 'c3', `${s}.md`))))
    t('C official: restored 为空', [], rb3.restored)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// D. D3 写后失效缓存（确定性复现，不靠「碰运气撞同一 mtime tick」）
// 手法：把文件 mtime 冻结成同一个可精确表示的秒值，再让插件写一次，
//       若写后没有失效缓存，读取会命中旧缓存 ⇒ 返回旧值（测试失败）。
// ══════════════════════════════════════════════════════════════════
{
  const root = mkdtempSync(join(tmpdir(), 'dshc-r2-cache-'))
  try {
    ensureStorage(root)
    writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
    writeFileSync(join(root, 'user-prompt.md'), '全局提示词', 'utf8')
    const T = 1700000000.5 // 秒（µs 可精确表示，utimes 往返不丢精度）
    const freeze = (path) => { utimesSync(path, T, T); return statSync(path).mtimeMs }

    // D1 会话段（writeSessionOverride）
    writeSessionOverride(root, 'cs', { system: 'A1' })
    const ps = join(root, 'sessions', 'cs', 'system.md')
    freeze(ps)
    t('D 会话段: 预热读', 'A1', sessionSystemTextFor(root, 'cs'))
    writeSessionOverride(root, 'cs', { system: 'B2' })
    freeze(ps)
    t('D 会话段: mtime 冻结后仍读到新值（写后已失效缓存）', 'B2', sessionSystemTextFor(root, 'cs'))

    // D2 全局 discipline（saveDiscipline）
    saveDiscipline(root, 'D-A', true)
    freeze(join(root, 'discipline.md'))
    t('D discipline: 预热读', 'D-A', sessionDisciplineTextFor(root, 'nohit', null))
    saveDiscipline(root, 'D-B', true)
    freeze(join(root, 'discipline.md'))
    t('D discipline: mtime 冻结后仍读到新值', 'D-B', sessionDisciplineTextFor(root, 'nohit', null))

    // D3 我的提示词（saveUserPrompt）
    saveUserPrompt(root, 'U-A', true)
    freeze(join(root, 'user-prompt.md'))
    t('D user-prompt: 预热读', 'U-A', sessionUserPromptTextFor(root, 'nohit'))
    saveUserPrompt(root, 'U-B', true)
    freeze(join(root, 'user-prompt.md'))
    t('D user-prompt: mtime 冻结后仍读到新值', 'U-B', sessionUserPromptTextFor(root, 'nohit'))

    // D4 settings（saveSettings → readInjectSettings）
    saveSettings(root, { injectEnabled: true })
    freeze(join(root, 'settings.json'))
    t('D settings: 预热读', true, readInjectSettings(root).enabled)
    saveSettings(root, { injectEnabled: false })
    freeze(join(root, 'settings.json'))
    t('D settings: mtime 冻结后仍读到新值', false, readInjectSettings(root).enabled)

    // D5 scope.json（saveScope → readScope）
    saveScope(root, [{ path: 'D:/p1', mode: 'exact', text: 'S-A' }])
    freeze(join(root, 'scope.json'))
    t('D scope: 预热读', 'S-A', readScope(root).rules[0].text)
    saveScope(root, [{ path: 'D:/p1', mode: 'exact', text: 'S-B' }])
    freeze(join(root, 'scope.json'))
    t('D scope: mtime 冻结后仍读到新值', 'S-B', readScope(root).rules[0].text)

    // D6 删除后立即读
    saveSettings(root, { injectEnabled: true })
    writeSessionOverride(root, 'cs', { system: '' })
    t('D 删除 system 后立即读为空', '', sessionSystemTextFor(root, 'cs'))
    saveDiscipline(root, '全局纪律', true)
    writeSessionOverride(root, 'cs', { discipline: null })
    t('D 删除 discipline 后立即回退全局', '全局纪律', sessionDisciplineTextFor(root, 'cs', null))

    // D7 缓存仍在用（不是被改成「每次无缓存读」）：绕过插件写 + 冻结 mtime ⇒ 应命中旧缓存
    writeSessionOverride(root, 'cs', { system: 'CACHE-1' })
    freeze(ps)
    t('D 缓存: 预热读', 'CACHE-1', sessionSystemTextFor(root, 'cs'))
    writeFileSync(ps, 'CACHE-2', 'utf8') // 绕过插件 ⇒ 缓存未失效
    freeze(ps)
    t('D 缓存: mtime 冻结后命中旧缓存（证明 mtime 缓存仍在生效）', 'CACHE-1', sessionSystemTextFor(root, 'cs'))

    // D8 连写 smoke（受本机删除开销限制只跑 12 轮；真正的保证由上面 D1~D5 的确定性用例提供）
    const stale = []
    const ROUNDS = 6
    for (let i = 0; i < ROUNDS; i++) {
      const v = `V${i}`
      // settings 先测并立即恢复「开」，避免总开关串扰 discipline 断言
      const flip = i % 2 === 0
      saveSettings(root, { injectEnabled: flip })
      if (readInjectSettings(root).enabled !== flip) stale.push(`settings@${i}`)
      saveSettings(root, { injectEnabled: true })
      if (readInjectSettings(root).enabled !== true) stale.push(`settings-restore@${i}`)
      writeSessionOverride(root, 's', { discipline: v })
      if (sessionDisciplineTextFor(root, 's', null) !== v) stale.push(`discipline@${i}`)
      writeSessionOverride(root, 's', { user: v })
      if (sessionUserPromptTextFor(root, 's') !== v) stale.push(`user@${i}`)
      writeSessionOverride(root, 's', { layered: v })
      if (sessionLayeredTextFor(root, 's') !== v) stale.push(`layered@${i}`)
      writeSessionOverride(root, 's', { system: v })
      if (sessionSystemTextFor(root, 's') !== v) stale.push(`system@${i}`)
      saveDiscipline(root, `G${i}`, true)
      if (sessionDisciplineTextFor(root, 'nohit', null) !== `G${i}`) stale.push(`global-discipline@${i}`)
    }
    t(`D 连写 smoke: ${ROUNDS} 轮 × 6 路径零陈旧`, [], stale)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// E. 静态不变量（complete 创建点唯一性 / 无空 catch / 写后失效存在）
// ══════════════════════════════════════════════════════════════════
{
  const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  const src = readFileSync(join(here, '..', 'src', 'dsh-custom.ts'), 'utf8')
  const completeCount = (src.match(/complete:\s*true/g) ?? []).length
  t('E 静态: complete:true 仅 2 处（全局深改接管 + 会话 system）', 2, completeCount)
  t('E 静态: 两处创建点均存在', true,
    src.includes('function applySessionSystemSection') && src.includes('export function registerOverride'))
  t('E 静态: 无空 catch {}', false, /catch\s*\{\s*\}/.test(src))
  t('E 静态: forgetCachedFile 定义存在', true, src.includes('function forgetCachedFile'))
  t('E 静态: readCachedFile 命中分支仍在（未被改成无缓存读）', true,
    /hit !== undefined && hit\.mtimeMs === st\.mtimeMs/.test(src))
}

console.log(lines.join('\n'))
console.log(`\n=== session-regression-2: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
