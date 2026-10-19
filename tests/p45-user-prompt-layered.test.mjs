// P4/P5 单测：user-prompt 三段装配（我的提示词）＋渐进加载层管理（存储+API 面）
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ensureStorage,
  readUserPrompt,
  saveUserPrompt,
  userPromptSectionName,
  userPromptTextFor,
  listLayered,
  readLayeredSection,
  saveLayeredSection,
  resetLayeredSection,
  toggleLayeredSection,
  deleteLayeredSection,
  makeApi,
} from '../src/dsh-custom.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

const root = mkdtempSync(join(tmpdir(), 'dshc-p45-'))
try {
  ensureStorage(root)

  // ── user-prompt 存储 ──
  const up0 = readUserPrompt(root)
  t('up: 初始=空+默认开', { enabled: true, text: '' }, { enabled: up0.enabled, text: up0.text })
  saveUserPrompt(root, '# 我的偏好\n优先中文回复')
  const up1 = readUserPrompt(root)
  t('up: 保存后可读', '# 我的偏好\n优先中文回复', up1.text)
  saveUserPrompt(root, '# 我的偏好', false)
  const up2 = readUserPrompt(root)
  t('up: 关开关后 enabled=false', false, up2.enabled)
  t('up: 段名=dsh-custom:user-prompt', 'dsh-custom:user-prompt', userPromptSectionName())

  // ── user-prompt 装配文本（三段序：常驻核心→我的提示词→官方）──
  saveUserPrompt(root, '# 我的偏好', true) // 前面关过开关，这里重开再测
  t('装配: 开+有文本→注入文本', '# 我的偏好', userPromptTextFor(root))
  saveUserPrompt(root, '', true)
  t('装配: 空=不注入（空串）', '', userPromptTextFor(root))
  saveUserPrompt(root, '# X', false)
  t('装配: 关=不注入', '', userPromptTextFor(root))
  saveUserPrompt(root, '# 我的偏好', true)

  // ── 渐进加载层管理（出厂源=包内 content/layered 副本）──
  const list0 = listLayered(root)
  t('layered: 出厂分节非空且含 l2f', true, list0.sections.some((s) => s.name === 'l2f-full-workflow.md'))
  t('layered: 出厂全部未改+启用', true, list0.sections.every((s) => !s.modified && s.enabled))
  const sec0 = list0.sections.find((s) => s.name === 'clarify-protocol.md')
  t('layered: 分节带强制级标注（M/S）', true, sec0.force === 'M' || sec0.force === 'S')

  // 用户改动
  saveLayeredSection(root, 'clarify-protocol.md', '# 用户改过的澄清协议')
  const list1 = listLayered(root)
  const sec1 = list1.sections.find((s) => s.name === 'clarify-protocol.md')
  t('layered: 改后 modified=true', true, sec1.modified)
  t('layered: 读到用户文本', '# 用户改过的澄清协议', readLayeredSection(root, 'clarify-protocol.md').text)

  // 恢复出厂
  resetLayeredSection(root, 'clarify-protocol.md')
  t('layered: 恢复出厂后 modified=false', false, listLayered(root).sections.find((s) => s.name === 'clarify-protocol.md').modified)
  t('layered: 恢复后文本=出厂', sec0.text, readLayeredSection(root, 'clarify-protocol.md').text)

  // 开关
  toggleLayeredSection(root, 'goal-mode.md', false)
  t('layered: 停用后 enabled=false', false, listLayered(root).sections.find((s) => s.name === 'goal-mode.md').enabled)
  toggleLayeredSection(root, 'goal-mode.md', true)
  t('layered: 重新启用', true, listLayered(root).sections.find((s) => s.name === 'goal-mode.md').enabled)

  // 越权路径防护（分节名只允许安全字符）
  let refused = false
  try { saveLayeredSection(root, '../../evil.md', '# x') } catch { refused = true }
  t('layered: 越权分节名拒绝', true, refused)
  refused = false
  try { saveLayeredSection(root, 'a\\b.md', '# x') } catch { refused = true }
  t('layered: 反斜杠分节名拒绝', true, refused)

  // 中文出厂名（00-加载清单.md）：此前受 ASCII 白名单所限读不到（「内容」弹窗 404 无反应）——回归
  const cnSec = readLayeredSection(root, '00-加载清单.md')
  t('layered: 中文出厂名可读', true, cnSec !== null && cnSec.text.length > 0)

  // 自建分节（中文名亦可）：保存→列出→读回→删除；出厂分节不可删
  saveLayeredSection(root, '我的测试流程.md', '# 自建内容')
  const custom = listLayered(root).sections.find((s) => s.name === '我的测试流程.md')
  t('layered: 自建中文名分节入库并可见', true, !!custom && custom.modified === true && custom.force === 'X')
  t('layered: 自建分节读回文本', '# 自建内容', readLayeredSection(root, '我的测试流程.md').text)
  deleteLayeredSection(root, '我的测试流程.md')
  t('layered: 自建分节删除后不再列出', undefined, listLayered(root).sections.find((s) => s.name === '我的测试流程.md'))
  t('layered: 出厂分节不可删', false, deleteLayeredSection(root, 'goal-mode.md').ok)

  // ── API 面（user-prompt + layered）──
  const api = makeApi(root, () => null, { hits: 0, denials: 0 })
  const call = (method, url, body) => new Promise((resolve) => {
    const req = { method, url, on: (ev, cb) => { if (ev === 'data') setTimeout(() => cb(Buffer.from(JSON.stringify(body ?? {}))), 0); if (ev === 'end') setTimeout(() => cb(), 5) } }
    const res = { writeHead: (c) => { res._c = c }, end: (b) => resolve({ code: res._c, body: JSON.parse(String(b)) }) }
    api(req, res)
  })
  const r1 = await call('GET', '/api/dsh-custom/user-prompt')
  t('api: GET user-prompt ok', true, r1.body.ok && r1.body.value.text === '# 我的偏好')
  const r2 = await call('PUT', '/api/dsh-custom/user-prompt', { text: '# 改', enabled: true })
  t('api: PUT user-prompt ok', true, r2.body.ok && r2.body.value.text === '# 改')
  const r3 = await call('GET', '/api/dsh-custom/layered')
  t('api: GET layered 列表 ok', true, r3.body.ok && Array.isArray(r3.body.value.sections) && r3.body.value.sections.length > 0)
  const r4 = await call('GET', '/api/dsh-custom/layered/goal-mode.md')
  t('api: GET 单节 ok', true, r4.body.ok && r4.body.value.text.length > 0)
  const r5 = await call('PUT', '/api/dsh-custom/layered/goal-mode.md', { text: '# 用户版目标模式' })
  t('api: PUT 单节 ok+modified', true, r5.body.ok && r5.body.value.modified === true)
  const r6 = await call('POST', '/api/dsh-custom/layered/goal-mode.md/reset')
  t('api: POST reset ok', true, r6.body.ok && r6.body.value.modified === false)
  const r7 = await call('POST', '/api/dsh-custom/layered/goal-mode.md/toggle', { enabled: false })
  t('api: POST toggle ok', true, r7.body.ok && r7.body.value.enabled === false)
  const r8 = await call('GET', '/api/dsh-custom/layered/..%2Fevil.md')
  t('api: 越权分节名 404/拒绝', true, !r8.body.ok)
  const r9 = await call('GET', '/api/dsh-custom/layered/' + encodeURIComponent('00-加载清单.md'))
  t('api: 中文出厂名 GET ok（内容弹窗数据源）', true, r9.body.ok && r9.body.value.name === '00-加载清单.md')
  const r10 = await call('PUT', '/api/dsh-custom/layered/' + encodeURIComponent('临时自建.md'), { text: '# 临时' })
  t('api: 中文自建名 PUT 新增 ok', true, r10.body.ok && r10.body.value.name === '临时自建.md')
  const r11 = await call('DELETE', '/api/dsh-custom/layered/' + encodeURIComponent('临时自建.md'))
  t('api: 自建分节 DELETE ok', true, r11.body.ok && r11.body.value.deleted === true)
  const r12 = await call('GET', '/api/dsh-custom/layered/' + encodeURIComponent('临时自建.md'))
  t('api: 删除后 GET 404', true, !r12.body.ok)
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(cases.join('\n'))
console.log(`\n=== p45-storage: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
