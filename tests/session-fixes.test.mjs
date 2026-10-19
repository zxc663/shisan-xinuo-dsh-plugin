// QA 缺陷回归（D1/D2/D3 + P1 注销句柄）：
//   D1 system complete 段组装期文本可变空 → 现不变量「text() 永不返回空串」（回落全局接管 / 最后非空值）
//   D2 rollback previous 不清理「快照之后新增的段」→ 现摘除并计入 cleared
//   D3 mtime 缓存同时间片不失效 → 现写后主动失效（写→立即读必读到新值）
//   P1 注销句柄不得依赖宿主返回值 → 段级 dispose 为主句柄，fiber.dispose 仅作补充
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  apply,
  ensureStorage,
  readSessionOverride,
  registerDisciplineForAgent,
  rollbackSession,
  saveSettings,
  sessionSystemTextFor,
  writeSessionOverride,
  OVERRIDE_SECTION,
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
/** 读审计留痕（只取解析成功的行）。 */
function auditEntries(root) {
  const p = join(root, 'audit.jsonl')
  if (!existsSync(p)) return []
  const out = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue
    try { out.push(JSON.parse(line)) } catch { /* 坏行忽略（与 stats 口径一致） */ }
  }
  return out
}
const countKind = (root, kind) => auditEntries(root).filter((e) => e.kind === kind).length

// ══════════════════════════════════════════════════════════════════
// D1：注册时非空 → 文件被外部删除 → text() 永不空串
// ══════════════════════════════════════════════════════════════════
const root = mkdtempSync(join(tmpdir(), 'dshc-fix-d1-'))
try {
  ensureStorage(root)
  const id = 'session-d1'
  writeSessionOverride(root, id, { system: '系统初版' })
  const a = makeAgent(id)
  registerDisciplineForAgent(a.agent, root)
  const sys = byName(a.sections, OVERRIDE_SECTION)
  t('D1 注册时非空: complete 段已注册', true, sys !== undefined && sys.complete === true)
  t('D1 注册时非空: text()=会话文本', '系统初版', sys.text())

  // 外部删除会话 system.md（模拟「绕过插件直接删文件」）
  unlinkSync(join(root, 'sessions', id, 'system.md'))
  t('D1 外部删除后: 直接求值为空串（文件确实没了）', '', sessionSystemTextFor(root, id))
  t('D1 外部删除后: 段仍注册（挂不挂在注册期定死）', true, byName(a.sections, OVERRIDE_SECTION) !== undefined)
  const afterDelete = byName(a.sections, OVERRIDE_SECTION).text()
  t('D1 外部删除后: text() 回落最后非空值', '系统初版', afterDelete)
  t('D1 外部删除后: text() 不返回空串', true, afterDelete !== '')
  t('D1 外部删除后: 连续多次求值仍非空', ['系统初版', '系统初版', '系统初版'], [sys.text(), sys.text(), sys.text()])

  // 回落留痕只写一次（闭包布尔量）
  const emptyAudits = auditEntries(root).filter((e) => e.kind === 'session-system-empty-at-assemble')
  t('D1 回落留痕只写一次', 1, emptyAudits.length)
  t('D1 回落留痕 fallback=last-nonempty', 'last-nonempty', emptyAudits[0]?.fallback)
  t('D1 回落留痕带 session', id, emptyAudits[0]?.session)

  // 会话文本恢复后：更新 lastNonEmpty 并优先返回会话文本
  writeSessionOverride(root, id, { system: '系统二版' })
  t('D1 恢复后: 优先会话文本', '系统二版', sys.text())
  unlinkSync(join(root, 'sessions', id, 'system.md'))
  t('D1 再次删除后: 回落最近一次非空（系统二版，不是初版）', '系统二版', sys.text())
  t('D1 再次删除后: 留痕仍只有一次（注册期内只记一次）', 1, countKind(root, 'session-system-empty-at-assemble'))

  // 全局深改开着且非空 → 回落全局接管文本
  const id2 = 'session-d1-global'
  writeSessionOverride(root, id2, { system: '会话系统-将被删' })
  writeFileSync(join(root, 'override.md'), '全局接管文本', 'utf8')
  saveSettings(root, { overrideEnabled: true })
  const b = makeAgent(id2)
  registerDisciplineForAgent(b.agent, root)
  const sys2 = byName(b.sections, OVERRIDE_SECTION)
  t('D1 有全局接管: 注册期先返回会话文本', '会话系统-将被删', sys2.text())
  unlinkSync(join(root, 'sessions', id2, 'system.md'))
  t('D1 有全局接管: 会话失效→回落全局接管文本', '全局接管文本', sys2.text())
  t('D1 有全局接管: 回落不空', true, sys2.text().trim().length > 0)
  const globalAudits = auditEntries(root).filter((e) => e.kind === 'session-system-empty-at-assemble' && e.session === id2)
  t('D1 有全局接管: 留痕 fallback=global-override', 'global-override', globalAudits[0]?.fallback)
  t('D1 有全局接管: 留痕一次', 1, globalAudits.length)

  // 全局深改关着但 override.md 里有文本 → 不得回落（开关优先），仍回落最后非空值
  saveSettings(root, { overrideEnabled: false })
  const id4 = 'session-d1-global-off'
  writeSessionOverride(root, id4, { system: '会话系统-四' })
  const d = makeAgent(id4)
  registerDisciplineForAgent(d.agent, root)
  const sys4 = byName(d.sections, OVERRIDE_SECTION)
  t('D1 全局关: 注册期返回会话文本', '会话系统-四', sys4.text())
  unlinkSync(join(root, 'sessions', id4, 'system.md'))
  t('D1 全局关: 回落最后非空值（不读全局文件文本）', '会话系统-四', sys4.text())

  // 全局深改开着但文本被清空 → 仍回落最后非空值（不返回空串）
  writeFileSync(join(root, 'override.md'), '   \n', 'utf8')
  saveSettings(root, { overrideEnabled: true })
  const id3 = 'session-d1-global-empty'
  writeSessionOverride(root, id3, { system: '会话系统-三' })
  const c = makeAgent(id3)
  registerDisciplineForAgent(c.agent, root)
  const sys3 = byName(c.sections, OVERRIDE_SECTION)
  t('D1 全局为空: 注册期返回会话文本', '会话系统-三', sys3.text())
  unlinkSync(join(root, 'sessions', id3, 'system.md'))
  t('D1 全局为空: 回落最后非空值（不返回空串）', '会话系统-三', sys3.text())
  saveSettings(root, { overrideEnabled: false })
} finally {
  rmSync(root, { recursive: true, force: true })
}

// ══════════════════════════════════════════════════════════════════
// D2：rollback previous 必须清理「快照之后新增的段」
// ══════════════════════════════════════════════════════════════════
const root2 = mkdtempSync(join(tmpdir(), 'dshc-fix-d2-'))
try {
  ensureStorage(root2)
  const id = 'session-d2'
  writeSessionOverride(root2, id, { discipline: '纪律-v1' }) // v1
  writeSessionOverride(root2, id, { discipline: '纪律-v2', system: '系统-v2' }) // v2（快照 v1）
  t('D2 回滚前: v2 含 system', '系统-v2', readSessionOverride(root2, id).system)

  const rb = rollbackSession(root2, id, 'previous')
  t('D2 回滚后: discipline 恢复 v1', '纪律-v1', readSessionOverride(root2, id).discipline)
  t('D2 回滚后: system.md 文件已不存在', false, existsSync(join(root2, 'sessions', id, 'system.md')))
  t('D2 回滚后: read 返回 system=null', null, readSessionOverride(root2, id).system)
  t('D2 回滚后: cleared 含 system', true, rb.cleared.includes('system'))
  t('D2 回滚后: restored 语义不变（只含 discipline）', ['discipline'], rb.restored)
  t('D2 回滚后: 直接求值 system 为空串', '', sessionSystemTextFor(root2, id))

  // 回滚后重新注册：不再误挂 complete（旧行为会继续注入「本该回滚掉」的文本）
  const ag = makeAgent(id)
  registerDisciplineForAgent(ag.agent, root2)
  t('D2 回滚后重注册: 只 3 段（无 complete）', 3, ag.sections.length)
  t('D2 回滚后重注册: 无 override 段', undefined, byName(ag.sections, OVERRIDE_SECTION))

  // 反向情形：快照里有、当前没有的段仍要恢复（不能被「清理」逻辑误删）
  const id2 = 'session-d2-restore'
  writeSessionOverride(root2, id2, { discipline: 'A', system: 'S-A' }) // v1
  writeSessionOverride(root2, id2, { discipline: 'B', system: '' }) // v2（快照 v1；system 被删）
  t('D2 反向: v2 已无 system', null, readSessionOverride(root2, id2).system)
  const rb2 = rollbackSession(root2, id2, 'previous')
  t('D2 反向: restored 含 discipline 与 system', ['discipline', 'system'], rb2.restored)
  t('D2 反向: system 内容恢复为 v1', 'S-A', readSessionOverride(root2, id2).system)
  t('D2 反向: cleared 为空（无多余段可清）', [], rb2.cleared)

  // official 分支不受影响：全清 + cleared 含全部存在段
  const rb3 = rollbackSession(root2, id2, 'official')
  t('D2 official: cleared 含 discipline/system', true, rb3.cleared.includes('discipline') && rb3.cleared.includes('system'))
  t('D2 official: 目录段全清', { discipline: null, user: null, layered: null, system: null }, readSessionOverride(root2, id2))
} finally {
  rmSync(root2, { recursive: true, force: true })
}

// ══════════════════════════════════════════════════════════════════
// D3：同一时间片内「写 → 立即读」必须读到新值（真实链路：writeSessionOverride → sessionSystemTextFor）
// ══════════════════════════════════════════════════════════════════
const root3 = mkdtempSync(join(tmpdir(), 'dshc-fix-d3-'))
try {
  ensureStorage(root3)
  const id = 'session-d3'
  const stale = []
  for (let i = 0; i < 50; i++) {
    const v = `系统-第${String(i)}版-${'x'.repeat(i % 7)}`
    writeSessionOverride(root3, id, { system: v })
    const got = sessionSystemTextFor(root3, id)
    if (got !== v) stale.push({ i, expect: v, actual: got })
  }
  t('D3 同时间片写读 50 轮：零陈旧', [], stale)

  // 四段同时验证（discipline/user/layered 也走同一条 readCachedFile）
  const id2 = 'session-d3-all'
  const stale2 = []
  for (let i = 0; i < 20; i++) {
    const seg = { discipline: `D${String(i)}`, user: `U${String(i)}`, layered: `L${String(i)}`, system: `S${String(i)}` }
    writeSessionOverride(root3, id2, seg)
    const got = readSessionOverride(root3, id2)
    if (got.discipline !== seg.discipline || got.user !== seg.user || got.layered !== seg.layered || got.system !== seg.system) {
      stale2.push({ i, got })
    }
  }
  t('D3 四段连续写读 20 轮：零陈旧', [], stale2)

  // 删除后立即读：必须立刻看到「没了」（缓存不能残留旧文本）
  const id3 = 'session-d3-del'
  writeSessionOverride(root3, id3, { system: '会被删掉' })
  t('D3 删除前: 读到文本', '会被删掉', sessionSystemTextFor(root3, id3))
  writeSessionOverride(root3, id3, { system: '' })
  t('D3 删除后立即读: 空串（无旧值残留）', '', sessionSystemTextFor(root3, id3))
} finally {
  rmSync(root3, { recursive: true, force: true })
}

// ══════════════════════════════════════════════════════════════════
// P1：宿主 inject 不回传 fiber 时，注销仍必须生效（不能靠 text() 回落兜住旧文本）
// 手法：apply 级 mock ctx（inject 返回 undefined）＋ mock scope（section 返回段级 dispose，
//       该 dispose 能从注册表里移除该段），走真实 API 的「保存 → 重同步 → 清空」链路。
// ══════════════════════════════════════════════════════════════════
const completes = (sections) => sections.filter((s) => s.complete === true)

/** 极简 HTTP 调用器。 */
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

/**
 * mock scope：section() 把段推进共享注册表并返回「能移除该段」的段级 dispose；
 * fiber(cb) 收集本次 cb 内创建的段的移除函数，返回 fiber 句柄。
 * @param opts.sectionDisposeThrows=true 时段级 dispose 抛错（用于验证 fiber 兜底仍执行）
 */
function makeFiberScope(opts = {}) {
  const sections = []
  let bag = null
  const scope = {
    sections,
    systemPrompt: {
      section(cfg) {
        sections.push(cfg)
        const remove = () => {
          const i = sections.indexOf(cfg)
          if (i >= 0) sections.splice(i, 1)
        }
        if (bag !== null) bag.push(remove)
        if (opts.sectionDisposeThrows === true) {
          return () => { throw new Error('段级 dispose 炸了') }
        }
        return remove
      },
    },
    effect(fn) {
      const d = fn()
      if (typeof d === 'function' && bag !== null) bag.push(d)
      return { dispose() { if (typeof d === 'function') d() } }
    },
    fiber(cb) {
      const local = []
      const prev = bag
      bag = local
      try {
        cb(scope)
      } finally {
        bag = prev
      }
      return {
        dispose() {
          while (local.length > 0) {
            const d = local.pop()
            try { d() } catch { /* fiber 内单段失败不阻塞 */ }
          }
        },
      }
    },
  }
  return scope
}

/** 起一个 apply 级宿主；返回该 agent 的作用域注册表与 API handler。 */
function bootHost(opts = {}) {
  const home = mkdtempSync(join(tmpdir(), 'dshc-fix-host-'))
  const prevHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const agentScope = makeFiberScope(opts)
  const agent = {
    id: 'session-host',
    session: { header: { cwd: null } },
    ctx: {
      inject: (_svcs, cb) => {
        const fiber = agentScope.fiber(cb)
        // 关键：模拟「宿主不回传 fiber」
        return opts.injectReturnsFiber === false ? undefined : fiber
      },
    },
  }
  const agentsMap = new Map([[agent.id, agent]])
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
  const globalScope = makeFiberScope()
  const ctx = {
    effect(fn) {
      const d = fn()
      return { dispose() { if (typeof d === 'function') d() } }
    },
    inject(svcs, cb) {
      if (svcs[0] === 'systemPrompt') return globalScope.fiber(cb)
      if (svcs[0] === 'agents') {
        cb({ agents: agentsApi, on: (ev, fn) => { ;(listeners[ev] ??= []).push(fn); return () => {} } })
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
  let disposeAll = null
  try {
    disposeAll = apply(ctx)
  } finally {
    console.log = origLog
  }
  return {
    agentScope,
    api: routes[0].handler,
    disposeAll,
    restore() {
      if (prevHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = prevHome
      rmSync(home, { recursive: true, force: true })
    },
  }
}

const putSeg = (api, id, segments) => callApi(api, 'PUT', `/api/dsh-custom/sessions/${id}/override`, { segments })

// ── P1-a：inject 返回 undefined（宿主不回传 fiber）──
{
  const host = bootHost({ injectReturnsFiber: false })
  try {
    t('P1 无 fiber: 初始 0 个 complete', 0, completes(host.agentScope.sections).length)

    await putSeg(host.api, 'session-host', { system: '初版' })
    t('P1 无 fiber: 挂非空后 1 个 complete', 1, completes(host.agentScope.sections).length)
    t('P1 无 fiber: text()=初版', '初版', completes(host.agentScope.sections)[0].text())

    await putSeg(host.api, 'session-host', { system: '' })
    t('P1 无 fiber: 清空后 0 个 complete（不靠 text() 回落）', 0, completes(host.agentScope.sections).length)

    // QA 复现的失败路径：再挂 → 再清
    await putSeg(host.api, 'session-host', { system: '第二版' })
    t('P1 无 fiber: 再挂后 1 个 complete', 1, completes(host.agentScope.sections).length)
    await putSeg(host.api, 'session-host', { system: '' })
    t('P1 无 fiber: 再清空后 0 个 complete（QA 复现路径已修）', 0, completes(host.agentScope.sections).length)

    // 连续「挂→清」3 轮：挂时 ≤1，清后必为 0
    const rounds = []
    for (let i = 0; i < 3; i++) {
      await putSeg(host.api, 'session-host', { system: `第${String(i + 3)}版` })
      const mounted = completes(host.agentScope.sections).length
      await putSeg(host.api, 'session-host', { system: '' })
      const cleared = completes(host.agentScope.sections).length
      rounds.push({ mounted, cleared })
    }
    t('P1 无 fiber: 连续挂清 3 轮，挂时 ≤1、清后为 0', [{ mounted: 1, cleared: 0 }, { mounted: 1, cleared: 0 }, { mounted: 1, cleared: 0 }], rounds)
  } finally {
    host.restore()
  }
}

// ── P1-b：段级 dispose 抛错 → 不崩、告警、fiber 兜底仍摘段 ──
{
  const host = bootHost({ injectReturnsFiber: true, sectionDisposeThrows: true })
  const warns = []
  const origWarn = console.warn
  console.warn = (...a) => { warns.push(a.map((x) => String(x)).join(' ')) }
  try {
    await putSeg(host.api, 'session-host', { system: '兜底版' })
    t('P1 dispose 抛错: 挂上后 1 个 complete', 1, completes(host.agentScope.sections).length)
    const r = await putSeg(host.api, 'session-host', { system: '' })
    t('P1 dispose 抛错: 清空请求不崩（200 ok）', true, r.code === 200 && r.body.ok === true)
    t('P1 dispose 抛错: fiber 兜底仍摘段 → 0 个 complete', 0, completes(host.agentScope.sections).length)
    t('P1 dispose 抛错: 有 console.warn 告警（非空 catch）', true, warns.some((w) => w.includes('段级句柄')))
  } finally {
    console.warn = origWarn
    host.restore()
  }
}

console.log(lines.join('\n'))
console.log(`\n=== session-fixes: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
