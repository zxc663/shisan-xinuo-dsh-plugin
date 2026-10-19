// 会话级注入接线单测（P0 缺口）：验证会话覆盖真正进入装配，而不是「页面显示已保存、模型看不到」。
// 手法：假 agent 捕获 scoped 段配置（name/order/complete/text），逐项核对会话级 > 全局 的取文本口径。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ensureStorage,
  registerDisciplineForAgent,
  sessionDisciplineTextFor,
  sessionUserPromptTextFor,
  sessionLayeredTextFor,
  sessionSystemTextFor,
  writeSessionOverride,
  saveSettings,
  makeApi,
  DISCIPLINE_SECTION,
  DISCIPLINE_ORDER,
  USER_PROMPT_SECTION,
  USER_PROMPT_ORDER,
  SESSION_LAYERED_SECTION,
  SESSION_LAYERED_ORDER,
  OVERRIDE_SECTION,
} from '../src/dsh-custom.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) {
    pass++
    cases.push(`PASS ${name}`)
  } else {
    fail++
    cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`)
  }
}

/** 假 agent：inject 同步回调，捕获每次 section(...) 的配置对象。 */
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

const root = mkdtempSync(join(tmpdir(), 'dshc-sessinj-'))
try {
  ensureStorage(root)
  // 全局基线（用于验证「会话无覆盖 → 回退全局」）
  writeFileSync(join(root, 'discipline.md'), '全局纪律-默认', 'utf8')
  writeFileSync(join(root, 'user-prompt.md'), '全局我的提示词', 'utf8')

  // ── 1. 四段常量与序 ──
  t('段名: layered=dsh-custom:layered', 'dsh-custom:layered', SESSION_LAYERED_SECTION)
  t('段序: layered=-1980', -1980, SESSION_LAYERED_ORDER)
  t('段序: 纪律=-2000 < 我的提示词=-1990 < layered=-1980', true, DISCIPLINE_ORDER < USER_PROMPT_ORDER && USER_PROMPT_ORDER < SESSION_LAYERED_ORDER)

  // ── 2. 会话 discipline 覆盖 vs 回退全局 ──
  writeSessionOverride(root, 'session-abc', { discipline: '会话级纪律' })
  const a1 = makeAgent('session-abc')
  registerDisciplineForAgent(a1.agent, root)
  const d1 = byName(a1.sections, DISCIPLINE_SECTION)
  t('discipline: 会话存在→用会话文本', '会话级纪律', d1.text())
  t('discipline: order/interpolate 不变', { order: DISCIPLINE_ORDER, interpolate: false }, { order: d1.order, interpolate: d1.interpolate })

  const a2 = makeAgent('session-nohit')
  registerDisciplineForAgent(a2.agent, root)
  t('discipline: 会话无覆盖→回退全局 discipline.md', '全局纪律-默认', byName(a2.sections, DISCIPLINE_SECTION).text())

  // ── 3. 会话 user 覆盖 vs 回退全局 user-prompt ──
  writeSessionOverride(root, 'session-abc', { user: '会话级我的提示词' })
  const a2b = makeAgent('session-abc')
  registerDisciplineForAgent(a2b.agent, root)
  t('user: 会话存在→用会话文本', '会话级我的提示词', byName(a2b.sections, USER_PROMPT_SECTION).text())
  const a3 = makeAgent('session-nohit')
  registerDisciplineForAgent(a3.agent, root)
  t('user: 会话无覆盖→回退全局 user-prompt.md', '全局我的提示词', byName(a3.sections, USER_PROMPT_SECTION).text())
  t('user: 段序=-1990', USER_PROMPT_ORDER, byName(a3.sections, USER_PROMPT_SECTION).order)

  // ── 4. layered 不回退全局（全局 layered 是路由表，本就不注入）──
  const a4 = makeAgent('session-nohit')
  registerDisciplineForAgent(a4.agent, root)
  t('layered: 会话无覆盖→空串（不回退全局）', '', byName(a4.sections, SESSION_LAYERED_SECTION).text())
  writeSessionOverride(root, 'session-abc', { layered: '会话级路由表' })
  const a5 = makeAgent('session-abc')
  registerDisciplineForAgent(a5.agent, root)
  t('layered: 会话存在→会话文本', '会话级路由表', byName(a5.sections, SESSION_LAYERED_SECTION).text())

  // ── 5. system 段：空不注册 complete；非空才注册 complete ──
  const a6 = makeAgent('session-nohit')
  registerDisciplineForAgent(a6.agent, root)
  t('system: 会话为空→只注册 3 段', 3, a6.sections.length)
  t('system: 会话为空→无 complete 段', 0, a6.sections.filter((s) => s.complete === true).length)
  t('system: 会话为空→无 override 段', undefined, byName(a6.sections, OVERRIDE_SECTION))

  writeSessionOverride(root, 'session-abc', { system: '会话级系统提示词' })
  const a7 = makeAgent('session-abc')
  registerDisciplineForAgent(a7.agent, root)
  const sys7 = byName(a7.sections, OVERRIDE_SECTION)
  t('system: 会话非空→注册 4 段', 4, a7.sections.length)
  t('system: complete===true 且 order=0', { complete: true, order: 0 }, { complete: sys7.complete, order: sys7.order })
  t('system: text()=会话文本', '会话级系统提示词', sys7.text())

  // ── 6. 热生效：注册后改文件，text() 立即反映新内容 ──
  writeSessionOverride(root, 'session-abc', { discipline: '会话级纪律-第二版', user: '会话级提示词-第二版', system: '系统提示词-第二版' })
  t('热生效: discipline', '会话级纪律-第二版', d1.text())
  t('热生效: user', '会话级提示词-第二版', byName(a5.sections, USER_PROMPT_SECTION).text())
  t('热生效: system', '系统提示词-第二版', sys7.text())

  // ── 7. 总开关最高优先级（会话级不得绕过）──
  saveSettings(root, { injectEnabled: false })
  const a8 = makeAgent('session-abc')
  registerDisciplineForAgent(a8.agent, root)
  t('总开关关: discipline 即使有会话覆盖也为空', '', byName(a8.sections, DISCIPLINE_SECTION).text())
  t('总开关关: 直接求值同样为空', '', sessionDisciplineTextFor(root, 'session-abc', null))
  saveSettings(root, { injectEnabled: true })
  t('总开关开: 会话覆盖恢复', '会话级纪律-第二版', byName(a8.sections, DISCIPLINE_SECTION).text())

  // ── 8. 空 id / 非法 id：不抛异常，四段全走全局回退 ──
  let threw = false
  let emptySections = []
  try {
    const a9 = makeAgent('')
    registerDisciplineForAgent(a9.agent, root)
    emptySections = a9.sections
  } catch {
    threw = true
  }
  t('空 id: 不抛异常', false, threw)
  t('空 id: 仍注册 3 段（system 空不挂 complete）', 3, emptySections.length)
  t('空 id: discipline 回退全局', '全局纪律-默认', byName(emptySections, DISCIPLINE_SECTION).text())
  t('空 id: user 回退全局', '全局我的提示词', byName(emptySections, USER_PROMPT_SECTION).text())
  t('空 id: layered 为空串', '', byName(emptySections, SESSION_LAYERED_SECTION).text())

  let threwBad = false
  let badSections = []
  try {
    const a10 = makeAgent('!!!非法 id!!!')
    registerDisciplineForAgent(a10.agent, root)
    badSections = a10.sections
  } catch {
    threwBad = true
  }
  t('非法 id: 不抛异常', false, threwBad)
  t('非法 id: discipline 回退全局', '全局纪律-默认', byName(badSections, DISCIPLINE_SECTION).text())
  t('非法 id: system 为空串（不误挂 complete）', '', sessionSystemTextFor(root, '!!!非法 id!!!'))

  // ── 9. 文本助手直测（供其它模块复用的一致性）──
  t('助手: sessionLayeredTextFor 无覆盖=空串', '', sessionLayeredTextFor(root, 'session-nohit'))
  t('助手: sessionSystemTextFor 无覆盖=空串', '', sessionSystemTextFor(root, 'session-nohit'))
  t('助手: sessionUserPromptTextFor 无覆盖=全局', '全局我的提示词', sessionUserPromptTextFor(root, 'session-nohit'))
} finally {
  rmSync(root, { recursive: true, force: true })
}

// ── 10. makeApi 第 7 参：会话覆盖写/回滚成功后通知注入层重同步 ──
const root2 = mkdtempSync(join(tmpdir(), 'dshc-sessinj-api-'))
try {
  ensureStorage(root2)
  const seen = []
  const api = makeApi(root2, () => null, { denied: 0, touched: 0 }, undefined, undefined, undefined, (id) => seen.push(id))
  const call = (method, url, body) => new Promise((resolve) => {
    const req = {
      method,
      url,
      on: (ev, cb) => {
        if (ev === 'data') setTimeout(() => cb(Buffer.from(JSON.stringify(body ?? {}))), 0)
        if (ev === 'end') setTimeout(() => cb(), 5)
      },
    }
    const res = { writeHead: (c) => { res._c = c }, end: (b) => resolve({ code: res._c, body: JSON.parse(String(b)) }) }
    api(req, res)
  })
  const r1 = await call('PUT', '/api/dsh-custom/sessions/session-abc/override', { segments: { system: '会话级系统' } })
  t('api: PUT override 成功→通知重同步一次', true, r1.body.ok === true && seen.length === 1 && seen[0] === 'session-abc')
  const r2 = await call('POST', '/api/dsh-custom/sessions/session-abc/rollback', { target: 'official' })
  t('api: POST rollback 成功→再通知一次', true, r2.body.ok === true && seen.length === 2 && seen[1] === 'session-abc')
  t('api: 第 7 参可选（3 参旧调用仍可用）', 'function', typeof makeApi(root2, () => null, { denied: 0, touched: 0 }))
} finally {
  rmSync(root2, { recursive: true, force: true })
}

console.log(cases.join('\n'))
console.log(`\n=== session-injection: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
