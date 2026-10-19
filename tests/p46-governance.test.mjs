// P46 治理开关（governance.json）：API CRUD＋noExempt 422＋审计落账＋saveSettings merge 回归。
// 失败用例先行（2026-10-18 治理开关批）：本文件先于实现编写，红→绿。
import { makeApi, ensureStorage, saveSettings } from '../src/dsh-custom.ts'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let pass = 0, fail = 0
const t = (name, expect, actual) => {
  const ok = JSON.stringify(expect) === JSON.stringify(actual)
  if (ok) pass++; else { fail++; console.log(`FAIL ${name}: expect=${JSON.stringify(expect)} actual=${JSON.stringify(actual)}`) }
}

const root = mkdtempSync(join(tmpdir(), 'dshc-governance-'))
try {
  ensureStorage(root)
  const govPath = join(root, 'governance.json')

  // ── 0. 种子与默认视图 ──
  t('seed: governance.json 已种子', true, existsSync(govPath))
  const api = makeApi(root, () => null, { hits: 0, denials: 0 }, undefined, undefined, undefined, undefined, { concludeOnPass: false })
  const call = (method, url, body) => new Promise((resolve) => {
    const req = { method, url, on: (ev, cb) => { if (ev === 'data') setTimeout(() => cb(Buffer.from(JSON.stringify(body ?? {}))), 0); if (ev === 'end') setTimeout(() => cb(), 5) } }
    const res = { writeHead: (c) => { res._c = c }, end: (b) => resolve({ code: res._c, body: JSON.parse(String(b)) }) }
    api(req, res)
  })

  const g0 = await call('GET', '/api/dsh-custom/governance')
  t('api: GET 默认 ok', true, g0.body.ok)
  t('api: 默认 l3Enabled=true', true, g0.body.value.l3Enabled)
  t('api: 域目录 10 项且带 noExempt', 10, g0.body.value.domains.length)
  t('api: 编码执行 noExempt=true', true, g0.body.value.domains.find((d) => d.domain === '编码执行')?.noExempt === true)
  t('api: 数据删除 noExempt=false', false, g0.body.value.domains.find((d) => d.domain === '数据删除')?.noExempt)

  // ── 1. PUT 能力开关＋域关闭（合法域） ──
  const p1 = await call('PUT', '/api/dsh-custom/governance', { l3: { enabled: false, domainsOff: ['数据删除'] }, levelChecklist: false })
  t('api: PUT ok', true, p1.body.ok)
  const g1 = await call('GET', '/api/dsh-custom/governance')
  t('api: PUT 后 l3Enabled=false', false, g1.body.value.l3Enabled)
  t('api: 域关闭回读 off=true', true, g1.body.value.domains.find((d) => d.domain === '数据删除')?.off === true)
  t('api: levelChecklist=false 回读', false, g1.body.value.levelChecklist)
  const raw1 = JSON.parse(readFileSync(govPath, 'utf8'))
  t('file: 域关闭已落盘', true, Array.isArray(raw1.l3?.domainsOff) && raw1.l3.domainsOff.includes('数据删除'))

  // ── 2. noExempt 域关闭 → 422 拒绝 ──
  const p2 = await call('PUT', '/api/dsh-custom/governance', { l3: { domainsOff: ['编码执行'] } })
  t('api: noExempt 域关闭 422', 422, p2.code)
  t('api: 422 文案点名域', true, String(p2.body.error).includes('编码执行'))

  // ── 3. 白名单 CRUD ──
  const a1 = await call('POST', '/api/dsh-custom/governance/allowlist', { pattern: 'docker ps', note: '本机例行查询' })
  t('api: 白名单新增 ok', true, a1.body.ok && a1.body.value.allowlist.length === 1)
  const a2 = await call('POST', '/api/dsh-custom/governance/allowlist', { pattern: 'ab' })
  t('api: 超短条目 422', 422, a2.code)
  const a3 = await call('POST', '/api/dsh-custom/governance/allowlist', { pattern: '' })
  t('api: 空 pattern 422', 422, a3.code)
  const a4 = await call('GET', '/api/dsh-custom/governance')
  t('api: 白名单回读 pattern+note', true, a4.body.value.allowlist[0]?.pattern === 'docker ps' && a4.body.value.allowlist[0]?.note === '本机例行查询')
  const a5 = await call('DELETE', '/api/dsh-custom/governance/allowlist?pattern=docker%20ps')
  t('api: 白名单删除 ok', true, a5.body.ok && a5.body.value.allowlist.length === 0)

  // ── 4. concludeOnPass 开关回读 ──
  const c1 = await call('PUT', '/api/dsh-custom/governance', { concludeOnPass: true })
  t('api: concludeOnPass=true 回读', true, c1.body.value.concludeOnPass === true)

  // ── 4b. C7 boot 快照（「待重启」徽标数据面）：当前值 ≠ 启动值 即徽标条件成立 ──
  const b1 = await call('GET', '/api/dsh-custom/governance')
  t('boot: 启动值仍在（false）', false, b1.body.value.boot?.concludeOnPass)
  t('boot: 当前 true ≠ 启动 false（徽标条件成立）', true, b1.body.value.concludeOnPass === true && b1.body.value.boot.concludeOnPass === false)

  // ── 5. 审计落账 ──
  const auditText = readFileSync(join(root, 'audit.jsonl'), 'utf8')
  t('audit: governance-changed 在案', true, auditText.includes('governance-changed'))
  t('audit: allowlist 变更在案', true, auditText.includes('governance-allowlist'))

  // ── 6. saveSettings merge 回归（修复整写丢 userPromptEnabled）──
  writeFileSync(join(root, 'settings.json'), JSON.stringify({ version: 1, injectEnabled: true, overrideEnabled: true, userPromptEnabled: true }, null, 2), 'utf8')
  saveSettings(root, { injectEnabled: false })
  const s1 = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8'))
  t('fix: saveSettings 不再丢 userPromptEnabled', true, s1.userPromptEnabled === true)
  t('fix: 注入开关正常更新', false, s1.injectEnabled)

  // ── 7. C6 域目录单一真源：引擎上报 l3-catalog.json 优先，缺失/坏档回退镜像 ──
  const catalogFile = join(root, 'l3-catalog.json')
  t('catalog: 初始无上报 → mirror', 'mirror', (await call('GET', '/api/dsh-custom/governance')).body.value.catalogSource)
  writeFileSync(catalogFile, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), source: 'rules.json', domains: [{ domain: '自定义域A', noExempt: false }, { domain: '数据删除', noExempt: false }] }), 'utf8')
  const cat1 = await call('GET', '/api/dsh-custom/governance')
  t('catalog: 上报在场 → engine', 'engine', cat1.body.value.catalogSource)
  t('catalog: 域目录以上报为准', ['自定义域A', '数据删除'], cat1.body.value.domains.map((d) => d.domain))
  const cp = await call('PUT', '/api/dsh-custom/governance', { l3: { domainsOff: ['自定义域A'] } })
  t('catalog: 上报域可关闭（写校验同源）', 200, cp.code)
  const badCat = await call('PUT', '/api/dsh-custom/governance', { l3: { domainsOff: ['编码执行'] } })
  t('catalog: 上报目录外的域被拒（未知域 422）', 422, badCat.code)
  await new Promise((r) => setTimeout(r, 20)) // 防同毫秒 mtime 缓存（D3 同族）
  writeFileSync(catalogFile, '{坏档', 'utf8')
  t('catalog: 坏档回退 mirror', 'mirror', (await call('GET', '/api/dsh-custom/governance')).body.value.catalogSource)
  await new Promise((r) => setTimeout(r, 20))
  rmSync(catalogFile, { force: true })
  const cat2 = await call('GET', '/api/dsh-custom/governance')
  t('catalog: 移除上报 → 回退 mirror 10 域', 10, cat2.body.value.domains.length)
} finally {
  rmSync(root, { force: true, recursive: true })
}

console.log(`\n=== p46-governance: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
