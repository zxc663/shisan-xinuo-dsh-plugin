// P1 定点复核：会话 system 段「复合注销器」（段级 dispose 为主 + fiber 兜底）。
// 只验这一条：①原失败 mock（inject 返回 undefined）下清空能真摘段；②段级 dispose 抛错时 fiber 兜底；
// ③清空后不残留「只含 system 段的空 fiber」；④正常路径无回归。
// 只新增本文件，不改 src/dsh-custom.ts。
import { apply, ensureStorage, sessionSystemTextFor, writeSessionOverride, OVERRIDE_SECTION } from '../src/dsh-custom.ts'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

/**
 * 作用域 mock（cordis fiber 语义）：
 * - section() 把「独立移除器」塞进当前 fiber 的 bag（等价于 effect 作用域登记），并把段级句柄返回；
 * - fiber.dispose() 逐个跑 bag（单个失败不阻塞）——即「兜底路径」；
 * - throwOnSectionDispose=true 时，段级句柄故意抛错且不摘段，用来验证 fiber 兜底是否真的生效。
 */
function makeScope(opts = {}) {
  const sections = []
  const fibers = []
  let current = null
  const scope = {
    sections,
    fibers,
    throwOnSectionDispose: opts.throwOnSectionDispose === true,
    systemPrompt: {
      section(cfg) {
        sections.push(cfg)
        const remove = () => {
          const i = sections.indexOf(cfg)
          if (i >= 0) sections.splice(i, 1)
        }
        if (current !== null) current.bag.push(remove) // fiber 级独立移除器（不依赖返回值）
        if (scope.throwOnSectionDispose) {
          return () => { throw new Error('段级注销炸了（模拟宿主缺陷）') }
        }
        return remove
      },
    },
    effect(fn) {
      const d = fn()
      if (typeof d === 'function' && current !== null) current.bag.push(d)
      return { dispose() { if (typeof d === 'function') d() } }
    },
    fiber(cb) {
      const f = { bag: [], disposed: false }
      fibers.push(f)
      const prev = current
      current = f
      try { cb(scope) } finally { current = prev }
      return {
        dispose() {
          f.disposed = true
          while (f.bag.length > 0) {
            const d = f.bag.pop()
            try { d() } catch { /* 单个移除器失败不阻塞其余（cordis fiber 语义的保守建模） */ }
          }
        },
      }
    },
  }
  return scope
}

function bootApply({ injectReturnsFiber = true, throwOnSectionDispose = false } = {}) {
  const agentsMap = new Map()
  const listeners = {}
  const routes = []
  const globalScope = makeScope()
  const agentScopes = new Map()
  const injectCalls = { count: 0 }
  const makeAgent = (id) => {
    const scope = makeScope({ throwOnSectionDispose })
    const agent = {
      id,
      session: { header: { cwd: null } },
      ctx: {
        inject: (_s, cb) => {
          injectCalls.count++
          const fiber = scope.fiber(cb)
          return injectReturnsFiber ? fiber : undefined // ← 关键：模拟宿主不回传注销句柄
        },
      },
    }
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
          agents: { list: () => [...agentsMap.values()], get: (id) => agentsMap.get(id) ?? null },
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
  console.log = () => {}
  let disposeAll
  try { disposeAll = apply(ctx) } finally { console.log = origLog }
  return {
    globalScope, agentScopes, agentsMap, listeners, makeAgent, disposeAll, injectCalls,
    scopeOf: (agent) => agentScopes.get(agent),
    api: routes[0]?.handler,
  }
}

function callApi(api, method, url, body) {
  return new Promise((done) => {
    const payload = JSON.stringify(body ?? {})
    const req = {
      method,
      url,
      on: (ev, cb) => {
        if (ev === 'data') setTimeout(() => cb(Buffer.from(payload)), 0)
        else if (ev === 'end') setTimeout(() => cb(), 2)
      },
    }
    const res = { code: 0, writeHead(c) { this.code = c }, end(b) { done({ code: this.code, body: JSON.parse(String(b)) }) } }
    api(req, res)
  })
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
// A. 复现当初的失败 mock：inject 返回 undefined（宿主不回传注销句柄）
// ══════════════════════════════════════════════════════════════════
{
  const home = mkdtempSync(join(tmpdir(), 'dshc-p1-a-'))
  const restoreHome = setHome(home)
  try {
    const root = join(home, 'dsh-custom')
    ensureStorage(root)
    writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
    writeSessionOverride(root, 'session-x', { system: '初版' })

    const h = bootApply({ injectReturnsFiber: false })
    const agent = h.makeAgent('session-x')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent })
    const sc = () => h.scopeOf(agent)
    const put = (segments) => callApi(h.api, 'PUT', '/api/dsh-custom/sessions/session-x/override', { segments })

    t('A 初始: 4 段 / 1 complete', { total: 4, complete: 1 }, { total: sc().sections.length, complete: completes(sc().sections).length })

    await put({ system: '' })
    t('A 清空①: override 段不存在（真注销）', undefined, byName(sc().sections, OVERRIDE_SECTION))
    t('A 清空①: complete 段数 0', 0, completes(sc().sections).length)
    t('A 清空①: 回到 3 段', 3, sc().sections.length)

    await put({ system: '第二版' })
    t('A 再挂: 恰 1 个 complete', 1, completes(sc().sections).length)
    t('A 再挂: text=第二版', '第二版', byName(sc().sections, OVERRIDE_SECTION).text())

    // ← 原报告里的失败点：inject 不回传 fiber 时，第二次清空摘不掉段
    await put({ system: '' })
    t('A 清空②（原失败点）: override 段不存在', undefined, byName(sc().sections, OVERRIDE_SECTION))
    t('A 清空②（原失败点）: complete 段数 0', 0, completes(sc().sections).length)

    // 连续挂/清 3 轮，complete 始终 ≤1 且清空后归零
    const seq = []
    for (let i = 0; i < 3; i++) {
      await put({ system: `第${i}轮` })
      seq.push(completes(sc().sections).length)
      await put({ system: '' })
      seq.push(completes(sc().sections).length)
    }
    t('A 三轮挂清: complete 序列（挂=1/清=0 交替）', [1, 0, 1, 0, 1, 0], seq)
    t('A 三轮挂清: 始终 ≤1', true, seq.every((n) => n <= 1))
    t('A 收尾: 无 override 段、3 段', { hasOverride: false, total: 3 }, {
      hasOverride: byName(sc().sections, OVERRIDE_SECTION) !== undefined,
      total: sc().sections.length,
    })
  } finally {
    restoreHome()
    rmSync(home, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// B. 反例：段级 dispose 抛错（且未摘段）时，fiber 兜底必须真的摘掉段
// ══════════════════════════════════════════════════════════════════
{
  const home = mkdtempSync(join(tmpdir(), 'dshc-p1-b-'))
  const restoreHome = setHome(home)
  try {
    const root = join(home, 'dsh-custom')
    ensureStorage(root)
    writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
    writeSessionOverride(root, 'session-b', { system: 'B-初版' })

    const h = bootApply({ injectReturnsFiber: true })
    const agent = h.makeAgent('session-b')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent })
    const sc = () => h.scopeOf(agent)
    const put = (segments) => callApi(h.api, 'PUT', '/api/dsh-custom/sessions/session-b/override', { segments })

    t('B 初始: 4 段 / 1 complete（初始句柄正常）', { total: 4, complete: 1 }, { total: sc().sections.length, complete: completes(sc().sections).length })
    // 隔离：从此刻起只让「写后重注册」那条的段级句柄失效，才能验证 fiber 兜底
    sc().throwOnSectionDispose = true

    await put({ system: 'B-第二版' }) // 走 syncSessionSystem → 复合注销器（段级抛错 + fiber 兜底）
    t('B 再挂: 1 个 complete（旧的已摘、新的已挂）', 1, completes(sc().sections).length)

    const warns = []
    const origWarn = console.warn
    console.warn = (...a) => warns.push(a.join(' '))
    let threw = false
    try { await put({ system: '' }) } catch { threw = true } finally { console.warn = origWarn }

    t('B 清空: HTTP 链路不抛', false, threw)
    t('B 清空: 段被真正摘掉（不是只 warn）', undefined, byName(sc().sections, OVERRIDE_SECTION))
    t('B 清空: complete 段数 0', 0, completes(sc().sections).length)
    t('B 清空: 有段级注销失败的 warn（说明确实走了段级路径）', true, warns.some((w) => w.includes('段级句柄')))
    t('B 清空: 另外三段未被误伤', 3, sc().sections.length)
  } finally {
    restoreHome()
    rmSync(home, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// C. 无新副作用：清空后不残留「只含 system 段的空 fiber」（否则每次保存累积）
// ══════════════════════════════════════════════════════════════════
{
  const home = mkdtempSync(join(tmpdir(), 'dshc-p1-c-'))
  const restoreHome = setHome(home)
  try {
    const root = join(home, 'dsh-custom')
    ensureStorage(root)
    writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
    writeSessionOverride(root, 'session-c', { system: 'C-初版' })

    const h = bootApply({ injectReturnsFiber: true })
    const agent = h.makeAgent('session-c')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent })
    const sc = () => h.scopeOf(agent)
    const put = (segments) => callApi(h.api, 'PUT', '/api/dsh-custom/sessions/session-c/override', { segments })

    const baseFibers = sc().fibers.length
    const baseInject = h.injectCalls.count
    t('C 初始: 1 条 fiber（installScopedDiscipline 的四段共用）', 1, baseFibers)

    await put({ system: 'C-第二版' })
    t('C 再挂: 新增 1 条 fiber（只含 system 段）', 1, sc().fibers.length - baseFibers)
    await put({ system: '' })
    const liveEmpty = sc().fibers.filter((f) => !f.disposed && f.bag.length === 0)
    t('C 清空: 不残留空 fiber', 0, liveEmpty.length)
    t('C 清空: 重注册那条 fiber 已被 dispose', true, sc().fibers.filter((f) => f.disposed).length >= 1)

    // 连续 5 轮挂/清：fiber 总数线性增长但「存活空 fiber」恒为 0，且存活 fiber 数回到基线
    for (let i = 0; i < 5; i++) {
      await put({ system: `C-轮${i}` })
      await put({ system: '' })
    }
    const liveNow = sc().fibers.filter((f) => !f.disposed)
    t('C 五轮挂清: 存活 fiber 数回到基线（1）', 1, liveNow.length)
    t('C 五轮挂清: 存活 fiber 均非空', true, liveNow.every((f) => f.bag.length > 0))
    t('C 五轮挂清: 段数仍为 3、无 complete', { total: 3, complete: 0 }, {
      total: sc().sections.length,
      complete: completes(sc().sections).length,
    })
    t('C inject 调用次数=初始 1 + 非空同步 6（清空不新建 fiber）', baseInject + 6, h.injectCalls.count)
  } finally {
    restoreHome()
    rmSync(home, { recursive: true, force: true })
  }
}

// ══════════════════════════════════════════════════════════════════
// D. 正常路径回归：inject 返回 fiber 时行为不变（复合注销器不引入副作用）
// ══════════════════════════════════════════════════════════════════
{
  const home = mkdtempSync(join(tmpdir(), 'dshc-p1-d-'))
  const restoreHome = setHome(home)
  try {
    const root = join(home, 'dsh-custom')
    ensureStorage(root)
    writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
    writeSessionOverride(root, 'session-d', { system: 'D-初版' })

    const h = bootApply({ injectReturnsFiber: true })
    const agent = h.makeAgent('session-d')
    for (const cb of h.listeners['agent/created'] ?? []) cb({ agent })
    const sc = () => h.scopeOf(agent)
    const put = (segments) => callApi(h.api, 'PUT', '/api/dsh-custom/sessions/session-d/override', { segments })

    t('D 初始: 4 段 / 1 complete / text=初版', { total: 4, complete: 1, text: 'D-初版' }, {
      total: sc().sections.length,
      complete: completes(sc().sections).length,
      text: byName(sc().sections, OVERRIDE_SECTION).text(),
    })
    await put({ system: 'D-第二版' })
    t('D 再挂: 仍只 1 个 complete（不叠加）', 1, completes(sc().sections).length)
    await put({ system: '' })
    t('D 清空: 0 complete / 3 段', { complete: 0, total: 3 }, {
      complete: completes(sc().sections).length,
      total: sc().sections.length,
    })
    t('D 清空: 求值为空', '', sessionSystemTextFor(root, 'session-d'))
    let threw = false
    try { h.disposeAll() } catch { threw = true }
    t('D 整体 dispose 不抛', false, threw)
  } finally {
    restoreHome()
    rmSync(home, { recursive: true, force: true })
  }
}

console.log(lines.join('\n'))
console.log(`\n=== session-p1-recheck: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
