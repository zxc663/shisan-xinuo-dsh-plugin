// P0 单测：存储骨架 / 护栏（语义 b 保守子集）/ 会话外改动留痕 / 装配视图数据面 / HTTP 数据面
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  agentsCoexistence,
  buildAssemblyView,
  classifySectionName,
  collectStatus,
  containsPath,
  detectExternalChanges,
  disciplineTextFor,
  ensureStorage,
  guardDecision,
  hashOfFile,
  listBackups,
  makeApi,
  makeRendererLoader,
  pickScopeRule,
  readAssembly,
  readDiscipline,
  readInjectSettings,
  readOverride,
  readScope,
  registerDiscipline,
  renderPromptTolerant,
  resolveHome,
  restoreBackup,
  saveDiscipline,
  saveScope,
  saveSettings,
  snapshot,
  squash,
  storageRoot,
  validateOverrideText,
} from '../src/dsh-custom.ts'

let pass = 0
let fail = 0
function check(label, cond, detail) {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const ROOT = 'D:/ai本地模型/dsh/dsh-custom'

console.log('A. 路径与会话外定位')
check('resolveHome 尊重 DSH_HOME', resolveHome({ DSH_HOME: 'X:/h' }) === 'X:/h')
check('resolveHome 空 DSH_HOME 回退默认', resolveHome({ DSH_HOME: '' }).endsWith('.dsh'))
check('storageRoot 拼 dsh-custom 子目录', storageRoot({ DSH_HOME: 'X:/h' }) === join('X:/h', 'dsh-custom'))
check('squash 归一混合分隔符与大小写', squash('D:\\AI\\x/ y') === 'd:/ai/x/ y')

console.log('B. 路径包含判定（防误伤近邻目录）')
check('反斜杠子路径命中', containsPath('D:\\ai本地模型\\dsh\\dsh-custom\\discipline.md', ROOT))
check('正斜杠子路径命中', containsPath('d:/ai本地模型/dsh/dsh-custom/override.md', ROOT))
check('大小写不敏感命中', containsPath('D:/AI本地模型/DSH/DSH-CUSTOM', ROOT))
check('存储根目录本身命中', containsPath(ROOT, ROOT))
check('近邻 dsh-custom-prompt 不命中', !containsPath('D:/DeepSeek/dsh-plugin-dev/docs/dsh-custom-prompt-research.md', ROOT))
check('近邻 dsh-custom2 不命中', !containsPath('D:/x/dsh-custom2/a.md', ROOT))
check('无关路径不命中', !containsPath('D:/other/file.md', ROOT))

console.log('C. 护栏判定：写工具')
check(
  'write 写存储 → deny',
  guardDecision('write', { file_path: 'D:\\ai本地模型\\dsh\\dsh-custom\\discipline.md', content: 'x' }, ROOT).action === 'deny',
)
check(
  'write 写别处 → allow 且不触碰',
  guardDecision('write', { file_path: 'D:/other/file.md' }, ROOT).action === 'allow' &&
    !guardDecision('write', { file_path: 'D:/other/file.md' }, ROOT).touches,
)
check(
  'edit 写近邻目录 → allow（边界防误伤）',
  guardDecision('edit', { file_path: 'D:/DeepSeek/dsh-plugin-dev/docs/dsh-custom-prompt-research-20261017.md' }, ROOT).action === 'allow',
)
check('deny 附原因文本', String(guardDecision('write', { file_path: ROOT + '/x.md' }, ROOT).reason ?? '').length > 0)

console.log('D. 护栏判定：shell')
check(
  'Set-Content 写存储 → deny',
  guardDecision('shell', { command: `Set-Content -Path 'D:\\ai本地模型\\dsh\\dsh-custom\\discipline.md' -Value 'x'` }, ROOT).action === 'deny',
)
check(
  'Remove-Item 删存储 → deny',
  guardDecision('shell', { command: `Remove-Item 'D:\\ai本地模型\\dsh\\dsh-custom\\override.md'` }, ROOT).action === 'deny',
)
check(
  'JSON 双反斜杠转义形态 → deny',
  guardDecision('shell', { command: `Set-Content 'D:\\\\ai本地模型\\\\dsh\\\\dsh-custom\\\\x.md' 'v'` }, ROOT).action === 'deny',
)
check(
  'Get-Content 读存储 → allow 但留痕触碰',
  (() => {
    const d = guardDecision('shell', { command: `Get-Content 'D:\\ai本地模型\\dsh\\dsh-custom\\discipline.md'` }, ROOT)
    return d.action === 'allow' && d.touches
  })(),
)
check(
  '扩展名 .md 不误判为写动词',
  guardDecision('shell', { command: `Get-Content 'D:\\ai本地模型\\dsh\\dsh-custom\\discipline-md.md'` }, ROOT).action === 'allow',
)
check(
  'shell 无关命令 → allow 且不触碰',
  (() => {
    const d = guardDecision('shell', { command: 'Get-ChildItem D:/other' }, ROOT)
    return d.action === 'allow' && !d.touches
  })(),
)
check('read 工具读存储 → allow（非写）', guardDecision('read', { file_path: ROOT + '/meta.json' }, ROOT).action === 'allow')

// D1 回归（2026-10-17 实机误拦）：只读命令因 `2>&1` 被旧 `>\s*\S` 误判为写 → 修复后必须放行
check(
  '2>&1 流合并不误判为写（D1 回归）',
  (() => {
    const d = guardDecision('pwsh', { command: `Get-ChildItem "D:\\ai本地模型\\dsh\\dsh-custom" -Force | Select-Object Name 2>&1` }, ROOT)
    return d.action === 'allow' && d.touches
  })(),
)
check(
  '2>$null 空重定向不误判',
  guardDecision('pwsh', { command: `Get-Content 'D:\\ai本地模型\\dsh\\dsh-custom\\meta.json' 2>$null` }, ROOT).action === 'allow',
)
check(
  '=> / -> 箭头不误判为重定向',
  guardDecision('pwsh', { command: `Write-Output "a => D:\\ai本地模型\\dsh\\dsh-custom"` }, ROOT).action === 'allow',
)
check(
  '真实重定向写存储 → deny',
  guardDecision('pwsh', { command: `echo x > "D:\\ai本地模型\\dsh\\dsh-custom\\x.md"` }, ROOT).action === 'deny',
)
check(
  'rm 命令位删存储 → deny',
  guardDecision('bash', { command: `rm -rf 'D:\\ai本地模型\\dsh\\dsh-custom\\backups'` }, ROOT).action === 'deny',
)
check(
  'bash -c 内嵌 rm → deny',
  guardDecision('bash', { command: `bash -c "rm 'D:\\ai本地模型\\dsh\\dsh-custom\\discipline.md'"` }, ROOT).action === 'deny',
)
check(
  'Move-Item 写存储 → deny',
  guardDecision('pwsh', { command: `Move-Item 'D:\\ai本地模型\\dsh\\dsh-custom\\a.md' 'D:\\ai本地模型\\dsh\\dsh-custom\\b.md'` }, ROOT).action === 'deny',
)

console.log('E. 存储骨架（临时目录实战）')
const tmp = mkdtempSync(join(tmpdir(), 'dsh-custom-test-'))
try {
  const info = ensureStorage(tmp)
  check('ensureStorage 建目录与种子文件', info.created.length >= 6 && existsSync(join(tmp, 'discipline.md')) && existsSync(join(tmp, 'scope.json')) && existsSync(join(tmp, 'settings.json')))
  check('重复 ensureStorage 不再新建', ensureStorage(tmp).created.length === 0)

  check('首次 establish 后无外部改动告警', detectExternalChanges(tmp).length === 0)
  writeFileSync(join(tmp, 'discipline.md'), '外部手工改动', 'utf8')
  const changes = detectExternalChanges(tmp)
  check('会话外修改被检出（留痕）', changes.length === 1 && changes[0].file === 'discipline.md' && changes[0].to === hashOfFile(join(tmp, 'discipline.md')))
  const auditLines = readFileSync(join(tmp, 'audit.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  check('audit.jsonl 含 external-change 记录', auditLines.some((e) => e.kind === 'external-change'))

  const snapDir = snapshot(tmp, 'test')
  check('快照目录含被跟踪文件', existsSync(join(snapDir, 'discipline.md')) && existsSync(join(snapDir, 'override.md')))
  const backups = readdirSync(join(tmp, 'backups'))
  check('backups 下出现快照目录', backups.length >= 1)

  const st = collectStatus(tmp, { denied: 2, touched: 3 })
  check('collectStatus 汇总文件与护栏计数', st.files.length === 6 && st.guard.denied === 2 && st.files.every((f) => typeof f.hash === 'string'))
  check('TRACKED 已含 user-prompt.md（快照/外部改动/状态面同口径）', st.files.some((f) => f.name === 'user-prompt.md'))
  check('TRACKED 已含 layered-state.json（渐进层启停同口径）', st.files.some((f) => f.name === 'layered-state.json'))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log('F. 装配分区归属（按段名）')
check('本插件段名归属 ours', classifySectionName('dsh-custom:discipline') === 'ours')
check('已验证官方段名归属 official', classifySectionName('harness:identity') === 'official' && classifySectionName('deployment:persona') === 'official')
check('未识别段名归属 other', classifySectionName('some-plugin:thing') === 'other')
check('空名归属 other', classifySectionName('') === 'other')

console.log('G. 装配视图映射（buildAssemblyView）')
const fakeAsm = {
  sections: [
    { name: 'harness:identity', text: 'I' },
    { name: 'dsh-custom:discipline', text: 'D1' },
    { name: 'x:y', text: 'XY' },
  ],
  contexts: [{ name: 'env', text: 'ctx text' }],
  tools: [{ name: 'bash' }, { name: 'read' }],
  variables: { cwd: '/x', model: 'm' },
}
const bv = buildAssemblyView(fakeAsm, 'RENDERED', true)
check('分区映射 name/origin/chars 正确', bv.sections.length === 3 && bv.sections[0].origin === 'official' && bv.sections[1].origin === 'ours' && bv.sections[2].origin === 'other' && bv.sections[1].chars === 2)
check('上下文/工具/变量映射正确', bv.contexts.length === 1 && bv.contexts[0].chars === 8 && bv.tools.join(',') === 'bash,read' && bv.variables.join(',') === 'cwd,model')
check('渲染与降级字段透传', bv.rendered === 'RENDERED' && bv.rendererAvailable === true)
check('scopeLabel 默认与覆写', bv.scopeLabel.includes('全局') && buildAssemblyView(fakeAsm, null, false, null, '会话 abc（作用域实取）').scopeLabel === '会话 abc（作用域实取）')

console.log('H. readAssembly 降级不变量')
{
  const view = await readAssembly({ assemble: async () => fakeAsm })
  check('渲染可用性与 rendered 保持一致', view.rendererAvailable === (view.rendered !== null))
}

console.log('I. HTTP 数据面（makeApi）')
function fakeRes() {
  return {
    code: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.code = code
      this.headers = headers
    },
    end(body) {
      this.body = body
    },
  }
}
function fakeReq(method, url, body) {
  const handlers = {}
  const req = {
    method,
    url,
    on(event, cb) {
      handlers[event] = cb
      return req
    },
  }
  if (body !== undefined || method === 'PUT') {
    queueMicrotask(() => {
      if (body !== undefined) handlers.data?.(Buffer.from(String(body)))
      handlers.end?.()
    })
  }
  return req
}
async function callApi(api, method, url, body) {
  const res = fakeRes()
  await new Promise((resolve) => {
    const origEnd = res.end.bind(res)
    res.end = (body2) => {
      origEnd(body2)
      resolve()
    }
    api(fakeReq(method, url, body), res)
  })
  return { code: res.code, json: res.body ? JSON.parse(res.body) : null }
}
const svcFake = { assemble: async () => fakeAsm }
{
  const apiTmp = mkdtempSync(join(tmpdir(), 'dsh-custom-api-'))
  try {
    const api = makeApi(apiTmp, () => svcFake, { denied: 1, touched: 0 })
    const okA = await callApi(api, 'GET', '/api/dsh-custom/assembly')
    check('assembly 200 且 ok:true', okA.code === 200 && okA.json.ok === true && Array.isArray(okA.json.value.sections))
    const okS = await callApi(api, 'GET', '/api/dsh-custom/status')
    check('status 200 且含 root', okS.code === 200 && okS.json.ok === true && okS.json.value.root === apiTmp)
    const bad = await callApi(api, 'POST', '/api/dsh-custom/assembly')
    check('非 GET → 405', bad.code === 405 && bad.json.ok === false)
    const nf = await callApi(api, 'GET', '/api/dsh-custom/nope')
    check('未知路径 → 404', nf.code === 404)
    const noSvc = makeApi(apiTmp, () => null, { denied: 0, touched: 0 })
    const svcMissing = await callApi(noSvc, 'GET', '/api/dsh-custom/assembly')
    check('服务缺失 → 503', svcMissing.code === 503 && svcMissing.json.ok === false)
  } finally {
    rmSync(apiTmp, { recursive: true, force: true })
  }
}

console.log('J. 渲染器分层解析（makeRendererLoader）')
{
  const base = mkdtempSync(join(tmpdir(), 'dsh-custom-render-'))
  try {
    const pkgDir = join(base, 'node_modules', '@deepseek-ai', 'dsh-system-prompt')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@deepseek-ai/dsh-system-prompt', version: '0.0.0-test', type: 'module', exports: { '.': './index.js' } }) + '\n',
    )
    writeFileSync(
      join(pkgDir, 'index.js'),
      'export function renderPrompt(assembly) { return "FAKE:" + (assembly && assembly.sections ? assembly.sections.length : 0) }\n',
    )
    const storeJ = join(base, 'storage')
    ensureStorage(storeJ)
    const loader = makeRendererLoader({ baseUrl: pathToFileURL(base.endsWith('/') ? base : base + '/').href }, storeJ)
    const mod = await loader()
    check('ctx-baseUrl 策略可解析假包', mod !== null && typeof mod.renderPrompt === 'function')
    check('假 renderPrompt 可用', mod !== null && String(mod.renderPrompt({ sections: [1, 2] })) === 'FAKE:2')
    const auditJ = readFileSync(join(storeJ, 'audit.jsonl'), 'utf8')
    check('解析成功落 audit renderer-resolve 行', auditJ.includes('renderer-resolve') && auditJ.includes('ctx-baseUrl'))
    const none = makeRendererLoader({ baseUrl: 'file:///D:/__dsh_custom_nonexistent__/' }, null)
    check('全部策略失败返回 null（不抛）', (await none()) === null)
    const readBack = await readAssembly({ assemble: async () => fakeAsm }, loader)
    check('readAssembly 注入 loader 后渲染可用且文本正确', readBack.rendererAvailable === true && readBack.rendered === 'FAKE:3')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

console.log('K. 容错渲染（严格渲染被运行时变量阻止时）')
{
  const strictThrower = {
    renderPrompt: () => {
      throw new Error('unknown prompt variable "{{model}}" in section "deployment:persona-prefix"; registered variables: provider')
    },
  }
  const tolerantAsm = {
    sections: [
      { name: 'a', text: 'hi {{model}}!' },
      { name: 'b', text: '' },
      { name: 'c', text: 'literal', interpolate: false },
    ],
    contexts: [],
    tools: [],
    variables: { provider: 'p' },
  }
  const viewT = await readAssembly({ assemble: async () => tolerantAsm }, async () => strictThrower)
  check('严格失败 → 容错渲染可用', viewT.rendererAvailable === true && viewT.rendered === 'hi {{model}}!\n\nliteral')
  check('容错渲染带提示（含未解析变量）', typeof viewT.renderNote === 'string' && viewT.renderNote.includes('{{model}}'))
  const direct = renderPromptTolerant({ sections: [{ name: 'x', text: 'v={{provider}} u={{model}}' }], variables: { provider: 'opencode' } })
  check('renderPromptTolerant 替换已解析、保留未解析', direct.text === 'v=opencode u={{model}}' && direct.unresolved.join(',') === '{{model}}')
}

console.log('L. 纪律前置（读/存/开关/注册/共存）')
{
  const baseL = mkdtempSync(join(tmpdir(), 'dsh-custom-p1-'))
  try {
    ensureStorage(baseL)
    check('settings.json 种子默认开', readInjectSettings(baseL).enabled === true)
    check('空纪律 → 注入文本为空（不注入）', readDiscipline(baseL).text === '')
    const saved = saveDiscipline(baseL, '# 纪律\n测试文本')
    check('保存纪律落盘且返回新状态', saved.sourceText === '# 纪律\n测试文本' && readFileSync(join(baseL, 'discipline.md'), 'utf8') === '# 纪律\n测试文本')
    check('保存后无会话外改动误报', detectExternalChanges(baseL).length === 0)
    check('保存产生快照', readdirSync(join(baseL, 'backups')).length >= 1)
    const off = saveSettings(baseL, { injectEnabled: false })
    check('关开关 → 注入文本为空（纯净）', off.enabled === false && readDiscipline(baseL).text === '')
    saveSettings(baseL, { injectEnabled: true })
    check('开开关 → 注入文本=源文', readDiscipline(baseL).text === '# 纪律\n测试文本')

    let captured = null
    const fakeSvc = {
      section: (s) => {
        captured = s
        return () => {}
      },
    }
    const dispose = registerDiscipline(fakeSvc, baseL)
    check('注册段名/顺序/原文标记正确', captured.name === 'dsh-custom:discipline' && captured.order === -2000 && captured.interpolate === false)
    check('text() 反映当前文本', String(captured.text()) === '# 纪律\n测试文本')
    saveSettings(baseL, { injectEnabled: false })
    check('关后 text() 即空（热生效）', String(captured.text()) === '')
    check('dispose 为函数', typeof dispose === 'function')

    const homeL = join(baseL, 'home')
    mkdirSync(homeL, { recursive: true })
    check('AGENTS 共存：无文件', agentsCoexistence(homeL).exists === false)
    writeFileSync(join(homeL, 'AGENTS.md'), '纪律文本', 'utf8')
    check('AGENTS 共存：有文件（含字节数）', agentsCoexistence(homeL).exists === true && agentsCoexistence(homeL).bytes > 0)
  } finally {
    rmSync(baseL, { recursive: true, force: true })
  }
}

console.log('M. HTTP 数据面（P1 端点：discipline/settings/agents）')
{
  const apiTmp2 = mkdtempSync(join(tmpdir(), 'dsh-custom-api2-'))
  try {
    ensureStorage(apiTmp2)
    const api2 = makeApi(apiTmp2, () => svcFake, { denied: 0, touched: 0 })
    const gd = await callApi(api2, 'GET', '/api/dsh-custom/discipline')
    check('GET discipline 200 且默认开', gd.code === 200 && gd.json.ok === true && gd.json.value.enabled === true)
    const pd = await callApi(api2, 'PUT', '/api/dsh-custom/discipline', JSON.stringify({ text: 'P1 纪律' }))
    check('PUT discipline 200 且落盘', pd.code === 200 && readFileSync(join(apiTmp2, 'discipline.md'), 'utf8') === 'P1 纪律')
    const badType = await callApi(api2, 'PUT', '/api/dsh-custom/discipline', JSON.stringify({ text: 42 }))
    check('PUT discipline 非法体 → 400', badType.code === 400 && badType.json.ok === false)
    const badJson = await callApi(api2, 'PUT', '/api/dsh-custom/discipline', '{oops')
    check('PUT discipline 坏 JSON → 400', badJson.code === 400)
    const ps = await callApi(api2, 'PUT', '/api/dsh-custom/settings', JSON.stringify({ injectEnabled: false }))
    const gs = await callApi(api2, 'GET', '/api/dsh-custom/settings')
    check('PUT/GET settings 开关往返', ps.code === 200 && ps.json.value.enabled === false && gs.json.value.enabled === false)
    const ga = await callApi(api2, 'GET', '/api/dsh-custom/agents')
    check('GET agents 200', ga.code === 200 && ga.json.ok === true && typeof ga.json.value.exists === 'boolean')
    const m405 = await callApi(api2, 'POST', '/api/dsh-custom/discipline', '{}')
    check('discipline 非 GET/PUT → 405', m405.code === 405)
    const gsc = await callApi(api2, 'GET', '/api/dsh-custom/scope')
    check('GET scope 默认空', gsc.code === 200 && Array.isArray(gsc.json.value.rules) && gsc.json.value.rules.length === 0)
    const psc = await callApi(api2, 'PUT', '/api/dsh-custom/scope', JSON.stringify({ rules: [{ path: 'D:\\ws', mode: 'prefix', text: 'X' }] }))
    check('PUT scope 200 且落盘', psc.code === 200 && readScope(apiTmp2).rules.length === 1)
    const pscBad = await callApi(api2, 'PUT', '/api/dsh-custom/scope', JSON.stringify({ rules: [{ path: 'D:\\ws', mode: 'fuzzy', text: 'X' }] }))
    check('PUT scope 非法 mode → 400', pscBad.code === 400)

    // P2：深改接管端点
    const go = await callApi(api2, 'GET', '/api/dsh-custom/override')
    check('GET override 默认关且空', go.code === 200 && go.json.value.enabled === false && go.json.value.text === '')
    const enNoText = await callApi(api2, 'PUT', '/api/dsh-custom/override/enable', JSON.stringify({ enabled: true }))
    check('空文本启用 → 409', enNoText.code === 409 && enNoText.json.ok === false)
    const po = await callApi(api2, 'PUT', '/api/dsh-custom/override', JSON.stringify({ text: '接管文本 {{model}}' }))
    check('PUT override 合法（注册但无值变量放行）→ 200', po.code === 200 && readFileSync(join(apiTmp2, 'override.md'), 'utf8') === '接管文本 {{model}}')
    const poBad = await callApi(api2, 'PUT', '/api/dsh-custom/override', JSON.stringify({ text: '密码 {{bogus}}' }))
    check('PUT override 未知变量 → 422', poBad.code === 422 && String(poBad.json.error).includes('bogus'))
    const enOk = await callApi(api2, 'PUT', '/api/dsh-custom/override/enable', JSON.stringify({ enabled: true }))
    const go2 = await callApi(api2, 'GET', '/api/dsh-custom/override')
    check('启用（探测通过）→ 200 且落档', enOk.code === 200 && go2.json.value.enabled === true)
    const enOff = await callApi(api2, 'PUT', '/api/dsh-custom/override/enable', JSON.stringify({ enabled: false }))
    check('停用 → 200 且落档', enOff.code === 200 && readOverride(apiTmp2).enabled === false)
    const gb = await callApi(api2, 'GET', '/api/dsh-custom/backups')
    check('GET backups 200（含快照）', gb.code === 200 && Array.isArray(gb.json.value.entries) && gb.json.value.entries.length >= 1)
    const brBad = await callApi(api2, 'PUT', '/api/dsh-custom/backups/restore', JSON.stringify({ name: '..\\x' }))
    check('restore 越界路径 → 400', brBad.code === 400)
    const firstSnap = gb.json.value.entries[gb.json.value.entries.length - 1].name
    const brOk = await callApi(api2, 'PUT', '/api/dsh-custom/backups/restore', JSON.stringify({ name: firstSnap }))
    check('restore 合法快照 → 200', brOk.code === 200 && Array.isArray(brOk.json.value.restored))

    // P2：互斥冲突路径（探测 assemble 抛 multiple complete）
    const po2 = await callApi(api2, 'PUT', '/api/dsh-custom/override', JSON.stringify({ text: '冲突探测文本' }))
    check('恢复后重存接管文本 → 200', po2.code === 200)
    const apiConflict = makeApi(apiTmp2, () => ({ assemble: async () => { throw new Error('multiple complete prompt sections are active: "dsh-custom:override", "other:thing"') } }), { denied: 0, touched: 0 })
    const enConflict = await callApi(apiConflict, 'PUT', '/api/dsh-custom/override/enable', JSON.stringify({ enabled: true }))
    check('互斥冲突 → 409 且含对方段名', enConflict.code === 409 && Array.isArray(enConflict.json.conflict) && enConflict.json.conflict.includes('other:thing'))
    check('冲突后自动回退为关闭', readInjectSettings(apiTmp2).overrideEnabled === false)

    // P2+：会话级实取视图（assemble({agent, scope: agent}) 与真实请求同法）
    let receivedContext = null
    const fakeAgent = { id: 'sess-1' }
    const agentsViewFake = {
      list: () => [{ id: 'sess-1', cwd: 'D:\\ws\\a' }],
      resolve: (id) => (id === 'sess-1' ? { agent: fakeAgent, cwd: 'D:\\ws\\a' } : null),
    }
    const scopedSvc = {
      assemble: async (ctx) => {
        receivedContext = ctx
        return fakeAsm
      },
    }
    const api3 = makeApi(apiTmp2, () => scopedSvc, { denied: 0, touched: 0 }, undefined, undefined, agentsViewFake)
    const gsess = await callApi(api3, 'GET', '/api/dsh-custom/sessions')
    check('GET sessions 200', gsess.code === 200 && gsess.json.value.sessions.length === 1 && gsess.json.value.sessions[0].cwd === 'D:\\ws\\a')
    const gas = await callApi(api3, 'GET', '/api/dsh-custom/assembly?session=sess-1')
    check(
      'assembly?session 200 且以 scope=agent 求装配',
      gas.code === 200 && String(gas.json.value.scopeLabel).startsWith('会话 ') && !String(gas.json.value.scopeLabel).includes('作用域实取') && receivedContext !== null && receivedContext.agent === fakeAgent && receivedContext.scope === fakeAgent,
    )
    const gasBad = await callApi(api3, 'GET', '/api/dsh-custom/assembly?session=nope')
    check('assembly 未知会话 → 404', gasBad.code === 404)
  } finally {
    rmSync(apiTmp2, { recursive: true, force: true })
  }
}

console.log('N. 作用域覆盖（匹配/优先级/解析合成）')
{
  const R = (path, mode, text) => ({ path, mode, text })
  check('exact 命中', pickScopeRule([R('D:\\ws\\a', 'exact', 'A')], 'D:\\ws\\a') !== null)
  check('exact 大小写/斜杠归一命中', pickScopeRule([R('d:/WS/A', 'exact', 'A')], 'D:\\ws\\a') !== null)
  check('prefix 命中子路径', pickScopeRule([R('D:\\ws', 'prefix', 'P')], 'D:\\ws\\a\\b') !== null)
  check('contains 命中', pickScopeRule([R('ws\\a', 'contains', 'C')], 'D:\\x\\ws\\a\\y') !== null)
  check('regex 命中（i 标志）', pickScopeRule([R('proj-\\d+$', 'regex', 'R')], 'D:\\ws\\PROJ-42') !== null)
  check('不命中返回 null', pickScopeRule([R('D:\\other', 'prefix', 'X')], 'D:\\ws\\a') === null)
  const pickA = pickScopeRule([R('D:', 'prefix', 'P-long'), R('D:\\ws\\a', 'exact', 'EXACT'), R('D:\\ws', 'prefix', 'P')], 'D:\\ws\\a')
  check('越具体越优先（exact > prefix）', pickA !== null && pickA.text === 'EXACT')
  const pickB = pickScopeRule([R('D:\\ws', 'prefix', 'P-short'), R('D:\\ws\\a', 'prefix', 'P-long')], 'D:\\ws\\a\\b')
  check('同级取更长 prefix', pickB !== null && pickB.text === 'P-long')
  check(
    '空正文规则可命中（=该位置关闭）',
    (() => {
      const r = pickScopeRule([R('D:\\ws', 'prefix', '')], 'D:\\ws\\a')
      return r !== null && r.text === ''
    })(),
  )
  check('非法 regex 跳过不炸', pickScopeRule([R('[', 'regex', 'X'), R('D:', 'prefix', 'P')], 'D:\\ws') !== null)

  const baseN = mkdtempSync(join(tmpdir(), 'dsh-custom-p1b-'))
  try {
    ensureStorage(baseN)
    saveDiscipline(baseN, '全局纪律')
    check('无规则 → 全局文本', disciplineTextFor(baseN, 'D:\\ws\\a') === '全局纪律')
    saveScope(baseN, [{ path: 'D:\\ws', mode: 'prefix', text: '工作区纪律' }])
    check('命中规则 → 覆盖文本', disciplineTextFor(baseN, 'D:\\ws\\a') === '工作区纪律')
    check('cwd 缺省 → 全局文本', disciplineTextFor(baseN, null) === '全局纪律')
    saveScope(baseN, [{ path: 'D:\\ws', mode: 'prefix', text: '' }])
    check('规则空文本 → 该位置关（空）', disciplineTextFor(baseN, 'D:\\ws\\a') === '')
    check('关位置不影响别处', disciplineTextFor(baseN, 'D:\\other') === '全局纪律')
    saveSettings(baseN, { injectEnabled: false })
    check('总开关关 → 一律空', disciplineTextFor(baseN, 'D:\\ws\\a') === '' && disciplineTextFor(baseN, 'D:\\other') === '')
    saveSettings(baseN, { injectEnabled: true })
    const auditN = readFileSync(join(baseN, 'audit.jsonl'), 'utf8')
    check('scope 保存留痕+快照', auditN.includes('scope-saved') && readdirSync(join(baseN, 'backups')).length >= 1)
    let threw = false
    try {
      saveScope(baseN, [{ path: '', mode: 'exact', text: 'x' }])
    } catch {
      threw = true
    }
    check('非法规则拒绝保存', threw)
    check('拒绝后文件未被污染', readScope(baseN).rules.length === 1)
  } finally {
    rmSync(baseN, { recursive: true, force: true })
  }
}

console.log('O. 深改接管（校验/快照恢复/设置）')
{
  // 干跑校验（无 renderer 的解析级兜底）
  check('合法纯文本通过', validateOverrideText('你好', { model: undefined }, null) === null)
  check('已注册但无值变量放行（{{model}}）', validateOverrideText('用 {{model}} 回答', { model: undefined }, null) === null)
  check('未知变量阻止', String(validateOverrideText('{{bogus}}', { model: 'x' }, null)).includes('bogus'))
  check('畸形变量阻止', String(validateOverrideText('{{a b}}', { model: 'x' }, null)).includes('畸形'))
  check('无 renderer 时空变量表下的已知名放行失败=未知阻止', String(validateOverrideText('{{model}}', {}, null)).includes('未知'))
  const strictStub = (asm) => {
    const s = asm.sections[0].text
    for (const m of s.matchAll(/\{\{([^{}]*)\}\}/g)) {
      const name = m[1]
      if (!/^[a-z][a-z0-9_]*$/i.test(name)) throw new Error('malformed prompt variable reference')
      if (!Object.hasOwn(asm.variables, name)) throw new Error(`unknown prompt variable "{{${name}}}"`)
      if (asm.variables[name] === undefined) throw new Error(`prompt variable "{{${name}}}" has no value`)
    }
    return s
  }
  check('render 路径：已知名（值 undefined 被占位）通过', validateOverrideText('用 {{model}}', { model: undefined }, strictStub) === null)
  check('render 路径：未知名阻止', String(validateOverrideText('用 {{bogus}}', { model: 'x' }, strictStub)).includes('unknown'))

  // 设置往返
  const baseO = mkdtempSync(join(tmpdir(), 'dsh-custom-p2-'))
  try {
    ensureStorage(baseO)
    check('overrideEnabled 默认关', readInjectSettings(baseO).overrideEnabled === false)
    saveSettings(baseO, { overrideEnabled: true })
    check('overrideEnabled 往返', readInjectSettings(baseO).overrideEnabled === true && readInjectSettings(baseO).enabled === true)
    saveSettings(baseO, { injectEnabled: false })
    check('两开关互不干扰', readInjectSettings(baseO).overrideEnabled === true && readInjectSettings(baseO).enabled === false)

    // 快照与恢复
    writeFileSync(join(baseO, 'override.md'), 'OV-原始', 'utf8')
    const snap1 = snapshot(baseO, 'test-o')
    writeFileSync(join(baseO, 'override.md'), 'OV-改写', 'utf8')
    const backups = listBackups(baseO)
    check('listBackups 含记录且标记 hasOverride', backups.length >= 1 && backups.some((b) => b.hasOverride))
    const name1 = backups.find((b) => b.files.includes('override.md')).name
    const restored = restoreBackup(baseO, name1)
    check('恢复快照后内容逐字回滚', readFileSync(join(baseO, 'override.md'), 'utf8') === 'OV-原始' && restored.restored.includes('override.md'))
    check('恢复前自动再拍快照（可逆）', listBackups(baseO).length >= backups.length + 1)
    const auditO = readFileSync(join(baseO, 'audit.jsonl'), 'utf8')
    check('恢复留痕 backup-restored', auditO.includes('backup-restored'))
    let threwO = false
    try {
      restoreBackup(baseO, '..\\..\\etc')
    } catch {
      threwO = true
    }
    check('越界路径拒绝', threwO)
    let threwO2 = false
    try {
      restoreBackup(baseO, 'no-such-snap')
    } catch {
      threwO2 = true
    }
    check('不存在快照拒绝', threwO2)
    void snap1
  } finally {
    rmSync(baseO, { recursive: true, force: true })
  }
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
