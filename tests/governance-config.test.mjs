// 治理开关（governance.json）回归：装载/fail-closed/noExempt 强制/白名单词边界/热读/env 优先。
// 失败用例先行（2026-10-18 治理开关批）：本文件先于实现编写，红→绿。
import { compileGovernance, loadGovernanceFile, readGovernanceCached, governancePath, effectiveRulesFor, matchGovernanceAllowlist, GOVERNANCE_DEFAULT, L3_ASK_GUIDANCE, loadRulesFile, normalizeCmdFingerprint } from '../src/shisan-xinuo-core.ts'
import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('..', import.meta.url))
const TD = join(repo, 'memory', 'tmp', 'governance-test')
rmSync(TD, { force: true, recursive: true })
mkdirSync(TD, { recursive: true })

let pass = 0, fail = 0
const t = (name, expect, actual) => {
  const ok = JSON.stringify(expect) === JSON.stringify(actual)
  if (ok) pass++; else { fail++; console.log(`FAIL ${name}: expect=${JSON.stringify(expect)} actual=${JSON.stringify(actual)}`) }
}

// ── 1. compileGovernance：完整配置/默认/坏根 ──
{
  const { cfg, errors } = compileGovernance({
    version: 1,
    l3: { enabled: false, domainsOff: ['数据删除', '编码执行'], allowlist: [{ pattern: 'docker ps -a', note: '本机例行查询' }] },
    levelChecklist: false, compactionSignal: false, concludeOnPass: true,
  })
  t('l3.enabled=false 生效', false, cfg.l3Enabled)
  t('noExempt 域关闭被忽略（引擎侧第二道）', ['数据删除'], cfg.domainsOff)
  t('noExempt 忽略必须落 error（不静默）', true, errors.some((e) => e.includes('编码执行') && e.includes('不可豁免')))
  t('白名单条目保留', 1, cfg.allowlist.length)
  t('白名单 note', '本机例行查询', cfg.allowlist[0].note)
  t('levelChecklist=false', false, cfg.levelChecklist)
  t('compactionSignal=false', false, cfg.compactionSignal)
  t('concludeOnPass=true', true, cfg.concludeOnPass)
}
{
  const { cfg, errors } = compileGovernance({ version: 1 })
  t('空对象=全默认', true, cfg.l3Enabled && cfg.levelChecklist && cfg.compactionSignal && !cfg.concludeOnPass && cfg.domainsOff.length === 0 && cfg.allowlist.length === 0)
  t('空对象无 error', 0, errors.length)
}
{
  const { cfg, errors } = compileGovernance(null)
  t('坏根=默认+error', true, cfg.l3Enabled && errors.length > 0)
}
{
  const { errors } = compileGovernance({ version: 2 })
  t('version 非 1 报错', true, errors.some((e) => e.includes('version')))
}
{
  const { cfg } = compileGovernance({ l3: { enabled: 'yes' } })
  t('l3.enabled 非 boolean 回落默认', true, cfg.l3Enabled)
}

// ── 2. 白名单条目校验：空 pattern/超短条目拒绝 ──
{
  const { cfg, errors } = compileGovernance({ l3: { allowlist: [{ pattern: '' }, { pattern: 'rm' }, { pattern: 'ok cmd', note: 'x' }] } })
  t('空 pattern 报错不入表', 1, cfg.allowlist.length)
  t('超短条目（<4）报错不入表', true, errors.some((e) => e.includes('allowlist[1]')))
}

// ── 3. loadGovernanceFile：缺文件/坏 JSON/正常往返 ──
{
  const r = loadGovernanceFile(join(TD, 'absent.json'))
  t('缺文件=默认+valid:false', false, r.valid)
  t('缺文件=防护不变（l3Enabled true）', true, r.cfg.l3Enabled)
}
{
  const p = join(TD, 'broken.json')
  writeFileSync(p, '{not json', 'utf8')
  const r = loadGovernanceFile(p)
  t('坏 JSON=默认', true, r.cfg.l3Enabled && r.cfg.allowlist.length === 0)
  t('坏 JSON 带 reason', true, r.valid === false && (r.reason ?? '').includes('JSON'))
}
{
  const p = join(TD, 'ok.json')
  writeFileSync(p, JSON.stringify({ version: 1, l3: { enabled: false, allowlist: [{ pattern: 'git status', note: '' }] } }), 'utf8')
  const r = loadGovernanceFile(p)
  t('正常往返', false, r.cfg.l3Enabled)
  t('正常往返 allowlist', 'git status', r.cfg.allowlist[0]?.raw)
}

// ── 4. readGovernanceCached：mtime 热读（页面保存即生效） ──
{
  const p = join(TD, 'hot.json')
  writeFileSync(p, JSON.stringify({ version: 1, l3: { enabled: false } }), 'utf8')
  t('热读第一次=false', false, readGovernanceCached(p).l3Enabled)
  writeFileSync(p, JSON.stringify({ version: 1, l3: { enabled: true } }), 'utf8')
  const future = Date.now() / 1000 + 5
  utimesSync(p, future, future) // 强推 mtime 变化（同秒写入也失效）
  t('mtime 变化后热读=true', true, readGovernanceCached(p).l3Enabled)
}

// ── 5. governancePath：env > DSH_HOME > ~/.dsh 回退（对齐 dsh-custom resolveHome 口径） ──
{
  const oldEnv = process.env.SHISANUO_GOVERNANCE, oldHome = process.env.DSH_HOME
  try {
    process.env.SHISANUO_GOVERNANCE = 'D:/tmp/gov-custom.json'
    t('env 优先', 'D:/tmp/gov-custom.json', governancePath())
    delete process.env.SHISANUO_GOVERNANCE
    process.env.DSH_HOME = 'D:/ai本地模型/dsh'
    t('DSH_HOME 拼接', join('D:/ai本地模型/dsh', 'dsh-custom', 'governance.json'), governancePath())
    delete process.env.DSH_HOME
    t('无 DSH_HOME 回退 ~/.dsh', true, governancePath().includes(join('.dsh', 'dsh-custom', 'governance.json')))
  } finally {
    if (oldEnv !== undefined) process.env.SHISANUO_GOVERNANCE = oldEnv; else delete process.env.SHISANUO_GOVERNANCE
    if (oldHome !== undefined) process.env.DSH_HOME = oldHome; else delete process.env.DSH_HOME
  }
}

// ── 6. matchGovernanceAllowlist：归一化子串＋词边界（大小写不敏感；防词内误匹配） ──
{
  const list = compileGovernance({ l3: { allowlist: [{ pattern: 'docker ps' }, { pattern: 'Get-ChildItem D:\\tmp' }] } }).cfg.allowlist
  t('子串命中（大小写不敏感）', 'docker ps', matchGovernanceAllowlist(list, 'docker ps -a')?.raw)
  t('包装态命中', 'docker ps', matchGovernanceAllowlist(list, 'powershell -Command "docker ps"')?.raw)
  t('词内不命中（docker psx ≠ docker ps）', null, matchGovernanceAllowlist(list, 'docker psx'))
  t('大写命令命中', 'docker ps', matchGovernanceAllowlist(list, 'DOCKER PS -A')?.raw)
  t('第二条命中', 'Get-ChildItem D:\\tmp', matchGovernanceAllowlist(list, 'Get-ChildItem D:\\tmp | Select Name')?.raw)
  t('空表=null', null, matchGovernanceAllowlist([], 'anything here'))
  t('不相关命令=null', null, matchGovernanceAllowlist(list, 'Remove-Item x'))
}

// ── 7. effectiveRulesFor：域关闭过滤 + noExempt 强制保留 ──
{
  const rules = loadRulesFile(join(repo, 'content', 'rules.json')).rules
  t('前置：规则包含 数据删除 与 编码执行', true, rules.patterns.some((p) => p.domain === '数据删除') && rules.patterns.some((p) => p.domain === '编码执行'))
  const gov = compileGovernance({ l3: { domainsOff: ['数据删除'] } }).cfg
  const eff = effectiveRulesFor(gov, rules)
  t('非 noExempt 域被滤除', false, eff.patterns.some((p) => p.domain === '数据删除'))
  t('noExempt 域强制保留', true, eff.patterns.some((p) => p.domain === '编码执行'))
  t('其余域保留', true, eff.patterns.some((p) => p.domain === '权限变更'))
  t('domainsOff 为空=原对象复用（零开销）', rules, effectiveRulesFor(GOVERNANCE_DEFAULT, rules))
  // 行为级：关闭 数据删除 后 rm 命令不再命中，编码执行仍拦
  const { judgeL3With } = await import('../src/shisan-xinuo-core.ts')
  t('行为级：rm 放行（域关闭）', null, judgeL3With(eff, 'rm -rf ./build'))
  t('行为级：编码执行仍拦', '编码执行', judgeL3With(eff, 'powershell -EncodedCommand AAAA'))
}

// ── 8. 引导语常量（审批卡 reason 拼接与测试单源） ──
{
  t('引导语含页面路径', true, L3_ASK_GUIDANCE.includes('治理开关'))
}

console.log(`\n=== governance-config: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
