import type { Context } from '@deepseek-ai/cordis'
import { appendFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { exec } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'

export const name = 'shisan-xinuo-core'

export const inject = ['systemPrompt', 'tools']

export const CORE_DISCIPLINE = `# 工程纪律（Shisan Xinuo Workflow · 本会话强制生效）

以下纪律逐条执行，不是参考建议。

## 开工
- 每个新任务第一产物=复述：目标/边界/验收各一行（追加任务一行：收到X｜理解为Y｜边界Z），然后才动手。
- 紧随一行状态行：Context: state=<读档/新建/单发> L=<L1/L2-S/L2-F> confirm=<无需/已问/豁免:理由>
- 计划门分歧铁律：遇不理解/重要分歧一律提问澄清，禁以扩计划替代提问；每个计划 ≥3 个提问为必要项。

## 判级（一句话即止，不展开论证）
- L1 可逆小改（改名/文案/格式）：直接做，最小验证，一行汇报。
- L2 新功能/多文件/跨模块：记录后推进；写码前先确认要对接的模块/API 与证据来源，禁凭命名直觉。
- L3 停点（仅 6 项）：密钥/权限｜数据删除｜数据或服务迁移｜对外发布｜架构选型｜超预算破坏性操作；生产基础设施写（CI/CD、DNS、IAM、计费、限流等）同按 L3。命中=先列出将执行的命令清单，停下等用户确认——备份不替代确认。
- 判不了 → 默认 L2。

## 必问与红线（不可豁免）
- 歧义/不确定/破坏性/范围扩大：先问不先写；设计确认先于写码。
- 密钥/令牌/密码绝不写入代码、文档、提交或对话；发现泄露立即提示轮换。
- 重大/不可逆操作前必建回滚点（备份/commit/导出）。
- 不假实现：未做/未验证的事显式标注，绝不编造运行结果或退出码；没跑验证就写没跑。
- 判「不复现/不存在」需判据逐字对齐+真实调用链+对照组，否则降级「未定论」。

## 收口
- 调 discipline_gate；**工具返回会给出合格判据的要求、失败阶梯与收口证据行**（照它写，别自己凑命令）。
- 工具不可用/被拒：如实说「未验证」与原因；**不得自造 GATE 行**（文本 GATE 不计入）。
- 宁交「未验证」的诚实，不交「假完成」。

## 方法与容错
- 能复用绝不自研：先检索现成方案，找不到才自写并说明原因。
- 验证覆盖快/慢两种负载形状；错误不吞，catch 留痕上报。
- 已知坑速查：改包先重编｜常驻进程用旧副本｜响应体只消费一次｜异步丢调用点。处置后留一行：症状→处置路径。

## 模式
用户明示目标/无人值守时按计划自主推进；L3 与密钥/破坏性操作仍停下确认。`

// L3 危险域执行层枚举（对齐母仓 risk_scan 思路：清单外高危域命中即拦）
export const L3_PATTERNS: Array<{ domain: string; re: RegExp }> = [
  { domain: '编码执行', re: /-EncodedCommand\b/i },
  { domain: '解码执行', re: /(?:\bbase64\b[^;&\n]*(?:-d|--decode)[^;&\n]*\|\s*(?:sh|bash|zsh)\b|\bFromBase64String\b[^;&\n]*\b(?:Invoke-Expression|IEX)\b)/i },
  { domain: '数据删除', re: /\bhelm\s+uninstall\b|\bdocker\s+container\s+prune\b|\bjournalctl\b[^;&|\n]*--vacuum/i },
  { domain: '数据删除', re: /(?<![-\w])rm\s+\S|\bRemove-Item\b|\bClear-Content\b|(?:^|[;&|]\s*|\n\s*)(?:del|erase|rd|rmdir|ri)(?:\s+\S|\s*(?:$|[;&|]))|\b(?:cmd|cmd\.exe|powershell|pwsh)\b[^;&|\n]{0,80}\b(?:del|erase|rd|rmdir)\b|git\s+(?:reset\s+--hard|clean\b|stash\s+clear\b|checkout\s+--|stash\s+(?:drop|clear))|\bshred\b|\bunlink\b|\bdocker\s+(?:rmi\b|volume\s+rm\b|image\s+prune\b|system\s+prune\b)|\b(?:node|python|python3)\s+(?:-\S+\s+){0,3}["'].*\b(?:unlinkSync|rmSync|rmtree|os\.remove)\b|sed\s+-i[^;&|\n]*\d+d\b|\bfind\s[^;&|\n]*-delete\b|\btruncate\s+-s\s|\bmv\s[^;&|\n]*\/dev\/null\b|\bkubectl\s+delete\b/i },
  { domain: '远端执行', re: /\b(?:curl|wget)\b[^;&|]*(?:\|\s*(?:sh|bash|zsh|powershell)\b|\|\s*\.\s)/i },
  { domain: '敏感路径写', re: /(?:>>?|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b)[^;&|\n]*[\/\\]\.(?:ssh|aws|gnupg)[\/\\]|(?:>>?|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b)[^;&|\n]*(?:authorized_keys|\.bashrc|\.profile\b|\.npmrc|\.netrc)/i },
  { domain: '远端写/发布', re: /\bgit\s+push[^;&|]*(?:--force|-f\s|--force-with-lease|--delete\b|--tags?\b)|\b(?:npm|pnpm|yarn)\s+(?:publish|unpublish)\b|\bgh\s+release\s+(?:create|delete)\b|\bdocker\s+push\b/i },
  { domain: '生产配置写', re: /(?:^|[\s"'|;&])\/etc\/|\breg\s+add\b|\bschtasks\s+\/create\b|\bcrontab\b|\bnetsh\b/i },
  { domain: '权限变更', re: /\bchmod\s+(?:-R\s+)?0{3}\b|\bchmod\s+777\b|\bchown\b|\busermod\b|\buseradd\b|\bnet\s+user\b|\bicacls\b|\bcacls\b|\btakeown\b|\bSet-Acl\b/i },
  { domain: '系统迁移/覆盖', re: /\bmkfs\b|\bdd\s+if=|\bformat\b\s|\bdiskpart\b/i },
  { domain: '破坏性远端操作', re: /\bcurl\b[^;&|\n]*-X\s*(?:DELETE|PUT)\b|\bwget\b[^;&|\n]*--method=(?:DELETE|PUT)\b/i },
]

// 只读/无害豁免：命中危险域后先查豁免，豁免命中=放行（误拦率防线，Q4 验收 <10%）
// afterDanger=true 的条目只在「危险模式命中位置之后」匹配（--dry-run 在危险动词前=绕过攻击，第四份审查实证）
const READONLY_EXEMPTS: Array<{ re: RegExp; afterDanger?: boolean }> = [
  { re: /(?:^|[;&|]\s*)(?:cat|ls|dir|head|tail|stat|file|less|more|grep)\s[^;&|]*\/etc\//i }, // /etc/ 只读动词
  { re: /\bcrontab\s+-l\b/i }, // 列出定时任务
  { re: /\bnetsh\b[^;&|]*\b(?:show|dump|list)\b/i }, // netsh 查询
  { re: /\bicacls\b(?![^;&|]*\/(?:grant|deny|remove|reset|setowner|inheritance))/i }, // icacls 无授权动词=查 ACL
  { re: /\b(?:Get-Help|help|man|Get-Command)\b[^;&|]*\b(?:rm|del|Remove-Item|erase)\b/i }, // 查帮助/文档
  { re: /\btakeown\s+\/\?/i }, // 帮助
  { re: /--dry-run\b/i, afterDanger: true }, // dry-run 标志必须在危险动词之后（git clean --dry-run ✓；--dry-run rm -rf ✗）
  { re: /\bgit\s+clean\b[^\n;&|]*?(?:^|\s)-n(?:\s|$)/m }, // clean -n dry-run（-dn 组合不含独立 -n 仍拦）
  { re: /^\s*(?:echo|Write-Output|Write-Host|printf)\s(?![^;&|]*>>?)[^;&|]*$/i }, // 单段纯输出提及（无分隔符且无重定向=不执行任何危险段；echo > file 是真实写操作不豁免）
]

// 收口强制注入文本前缀（单一来源：发送与排除共用，避免两处字面量漂移）
export const STEER_PREFIX = '[十三希诺收口强制]'
// F7/C11：强制收口时**必须显式禁止重述**——实测中模型接到强制后会把自己那份完整答案再说一遍（164K tok 的一大部分在此）。 #决策 2026-10-13 23:55
// 统一常量：三处 steer（断言未过／无断言未收口／零工具调用声称完成）共用同一措辞，避免逐处漂移。
export const STEER_ANTI_REPEAT = '只做收口动作，不要重复已经给出的答案或分析；判断依据以系统侧的收口证据为准。'

// 宿主会话恢复校验（dsh-session assertMessageEventShape）要求 user/message 携带 id（非空字符串）+ role + source.kind + content 数组；
// 我方 steer/inject 直接把消息塞入 inbox（宿主不补身份字段），缺 id/role 会在下次会话恢复时被判 corrupt（B1 实测）。
// 统一出口：所有投递进 inbox 的用户消息走此函数，杜绝四处字面量漂移。 #决策 2026-10-16
export function userMessage(text: string): { id: string; role: 'user'; content: Array<{ type: 'text'; text: string }>; source: { kind: 'user' } } {
  return { id: randomUUID(), role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }
}

// 跳过治理（批3 方向 A）：宿主 notice 通道探针结论（dsh-llm `ContextFormed`）——`source.form='notice'` 须带一行 `summary`，
// UI 折叠显示为"通知"而非普通用户发言；宿主自身 `modelSwitchNotice` 即此形态。kind 由产出方自声明（未知 kind 消费端回落）。
export const SKIP_INTERROGATION =
  '宿主本次跳过了收口强制（熔断上限已用尽）。请用三句话说明，不要重复已有答案：① 你当前的任务目标是什么？② 为什么本回合不需要或不能调用 discipline_gate 收口？③ 是否应当提醒用户，而不是静默放行？'
export function noticeMessage(summary: string, text: string): { id: string; role: 'user'; content: Array<{ type: 'text'; text: string }>; source: { kind: string; form: 'notice'; summary: string } } {
  return { id: randomUUID(), role: 'user', content: [{ type: 'text', text }], source: { kind: 'shisan-xinuo', form: 'notice', summary } }
}

// 段指纹：对注入系统段（名称+正文）取 SHA-256——启动自检 + 每请求核对段漂移（段变更率=0 的遥测底座）。
export function sectionFingerprint(sections: Array<{ name: string; text: string }>): string {
  const h = createHash('sha256')
  for (const s of sections) { h.update(s.name); h.update('\u0000'); h.update(s.text); h.update('\u0001') }
  return h.digest('hex')
}

// A9（2026-10-16）：只读管线**前置豁免**——真机误报实证（exec-log 8428：`Get-Content … |
// Select-String 'Remove-Item'` 仅因文本含字面量被判「数据删除」）。判据：剥离引号字面量后，
// 管道/链的**每一段**首词都是只读算子、且无重定向 ⇒ 整条命令无执行副作用，直接放行。
// 边界：段内出现非只读动词不豁免（`Get-Content x | Remove-Item` 仍拦）；脚本删除
// `node -e "…unlinkSync…"` 首词非只读 ⇒ 仍拦（37 例语料全保：不拿假阴性换假阳性）。
const QUOTED_LITERAL_RE = /"[^"\r\n]*"|'[^'\r\n]*'/g
export function stripQuotedLiterals(cmd: string): string {
  return cmd.replace(QUOTED_LITERAL_RE, ' ')
}
const READONLY_LEAD_RE = /^\s*(get-content|get-item|get-childitem|get-filehash|gc|gi|gci|select-string|sls|findstr|test-path|cat|ls|dir|head|tail|wc|grep|rg|type|echo|write-output|measure-object|sort-object|where-object|select-object|foreach-object)\b/i
export function isReadonlyPipeline(cmd: string): boolean {
  const probe = stripQuotedLiterals(cmd)
  if (/[>>]/.test(probe)) return false // 重定向=写副作用，不吃只读豁免
  const segments = probe.split(/\|\||&&|\||;|&/).map((s) => s.trim()).filter((s) => s !== '')
  if (segments.length === 0) return false
  return segments.every((s) => READONLY_LEAD_RE.test(s))
}

function judgeL3Core(cmd: string, patterns: Array<{ domain: string; re: RegExp; noExempt?: boolean }>, exempts: ReadonlyArray<RegExp | { re: RegExp; afterDanger?: boolean }>): string | null {
  if (isReadonlyPipeline(cmd)) return null
  for (const p of patterns) {
    const m = p.re.exec(cmd)
    if (m) {
      // 编码执行=故意绕过审计，不设豁免
      if (p.domain === '编码执行' || p.domain === '解码执行' || (p as { noExempt?: boolean }).noExempt === true) return p.domain
      for (const ex of exempts) {
        // afterDanger 条目只在危险命中位置之后匹配；普通豁免全文匹配（cat /etc/x 的豁免动词在 /etc/ 之前）
        const re = ex instanceof RegExp ? ex : ex.re
        const afterDanger = !(ex instanceof RegExp) && ex.afterDanger === true
        if (afterDanger ? re.test(cmd.slice(m.index)) : re.test(cmd)) return null
      }
      return p.domain
    }
  }
  return null
}

export function judgeL3(cmd: string): string | null {
  return judgeL3Core(cmd, L3_PATTERNS, READONLY_EXEMPTS)
}

// ── v0.3 Config 化：L3 规则包从引擎下沉为 content/rules.json 数据层（契约=docs/config-contract.md）──

export interface CompiledRules {
  patterns: Array<{ domain: string; re: RegExp; noExempt: boolean }>
  exempts: Array<RegExp | { re: RegExp; afterDanger?: boolean }>
}

export interface RulesLoadResult {
  rules: CompiledRules
  source: string
  valid: boolean
  reason?: string
  domains: number
}

const VALID_FLAG_SET = /^[imsu]*$/

// 结构校验+编译：坏正则条目跳过并记 error（其余照常）；返回编译产物与错误清单。
// 契约：l3Domains 必须是非空数组且至少 1 条编译成功，否则整体视为无效（fail-closed 由调用方回退内置默认）。
export function compileRules(raw: unknown): { patterns: CompiledRules['patterns']; exempts: RegExp[]; errors: string[] } {
  const errors: string[] = []
  const patterns: CompiledRules['patterns'] = []
  const exempts: RegExp[] = []
  const r = raw as { version?: unknown; l3Domains?: unknown; readonlyExempts?: unknown } | null
  if (!r || typeof r !== 'object') return { patterns, exempts, errors: ['根不是对象'] }
  if (r.version !== 1) errors.push(`version 必须为 1（实际 ${JSON.stringify(r.version)}）`)
  if (!Array.isArray(r.l3Domains) || r.l3Domains.length === 0) {
    errors.push('l3Domains 必须是非空数组')
    return { patterns, exempts, errors }
  }
  for (const [i, e] of (r.l3Domains as Array<Record<string, unknown>>).entries()) {
    const domain = e?.domain
    const pattern = e?.pattern
    if (typeof domain !== 'string' || domain.trim() === '') { errors.push(`l3Domains[${i}].domain 非法`); continue }
    if (typeof pattern !== 'string' || pattern === '') { errors.push(`l3Domains[${i}].pattern 非法`); continue }
    const flags = e.flags === undefined ? 'i' : e.flags
    if (typeof flags !== 'string' || !VALID_FLAG_SET.test(flags)) { errors.push(`l3Domains[${i}].flags 非法（仅 imsu，禁 g）`); continue }
    try {
      patterns.push({ domain, re: new RegExp(pattern, flags), noExempt: e.noExempt === true })
    } catch (err) {
      errors.push(`l3Domains[${i}] 正则编译失败：${String(err).slice(0, 80)}`)
    }
  }
  if (Array.isArray(r.readonlyExempts)) {
    for (const [i, e] of (r.readonlyExempts as Array<Record<string, unknown>>).entries()) {
      const pattern = e?.pattern
      if (typeof pattern !== 'string' || pattern === '') { errors.push(`readonlyExempts[${i}].pattern 非法`); continue }
      const flags = e.flags === undefined ? 'i' : e.flags
      if (typeof flags !== 'string' || !VALID_FLAG_SET.test(flags)) { errors.push(`readonlyExempts[${i}].flags 非法（仅 imsu，禁 g）`); continue }
      try {
        exempts.push(new RegExp(pattern, flags))
      } catch (err) {
        errors.push(`readonlyExempts[${i}] 正则编译失败：${String(err).slice(0, 80)}`)
      }
    }
  }
  if (patterns.length === 0) errors.push('无任何有效 l3Domains 条目')
  return { patterns, exempts, errors }
}

const DEFAULT_RULES: CompiledRules = {
  patterns: L3_PATTERNS.map((p) => ({ domain: p.domain, re: p.re, noExempt: p.domain === '编码执行' || p.domain === '解码执行' })),
  exempts: [...READONLY_EXEMPTS],
}

// 读文件→校验→fail-closed：任何失败回退内置默认（防护不静默解除），失败原因随结果带回供落账。
export function loadRulesFile(path: string): RulesLoadResult {
  if (!existsSync(path)) {
    return { rules: DEFAULT_RULES, source: path, valid: false, reason: '文件不存在', domains: DEFAULT_RULES.patterns.length }
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return { rules: DEFAULT_RULES, source: path, valid: false, reason: `JSON 解析失败：${String(e).slice(0, 80)}`, domains: DEFAULT_RULES.patterns.length }
  }
  const { patterns, exempts, errors } = compileRules(raw)
  if (patterns.length === 0) {
    return { rules: DEFAULT_RULES, source: path, valid: false, reason: errors.join('；'), domains: DEFAULT_RULES.patterns.length }
  }
  const result: RulesLoadResult = { rules: { patterns, exempts }, source: path, valid: errors.length === 0, domains: patterns.length }
  if (errors.length > 0) result.reason = errors.join('；')
  return result
}

// 规则注入式判定（config 化后的活动判定面；judgeL3 保持内置默认语义供回归对照）。
export function judgeL3With(rules: CompiledRules, cmd: string): string | null {
  // A9：与 judgeL3 同源——只读管线前置豁免，其余匹配语义不变
  if (isReadonlyPipeline(cmd)) return null
  for (const p of rules.patterns) {
    const m = p.re.exec(cmd)
    if (m) {
      if (p.noExempt) return p.domain
      for (const ex of rules.exempts) {
        // content 规则的豁免=全文匹配语义（契约文档注明：位置敏感豁免如 --dry-run 请用内置默认）
        const re = ex instanceof RegExp ? ex : ex.re
        if (re.test(cmd)) return null
      }
      return p.domain
    }
  }
  return null
}

// 文本类 content 装载（discipline.md 同 fail-closed 语义：无效回退引擎内嵌默认）。
export function loadTextWithFallback(path: string, fallback: string): { text: string; source: string; valid: boolean; reason?: string } {
  if (!existsSync(path)) return { text: fallback, source: path, valid: false, reason: '文件不存在' }
  try {
    const t = readFileSync(path, 'utf8')
    if (t.trim() === '') return { text: fallback, source: path, valid: false, reason: '文件为空' }
    return { text: t, source: path, valid: true }
  } catch (e) {
    return { text: fallback, source: path, valid: false, reason: String(e).slice(0, 80) }
  }
}

// ── 运行时工具裁剪（budget/mask 层，原 v0.4 T2）**已退役**（批4 方向 B，2026-10-16）──
// 披露减法让位上游 tool-search（Letter2025/dsh-tool-search 0.1.7，实测 wire 7 件 / 3,374 chars，−84.4%）；
// 本插件保留治理面（gate／assert／断言桥／guard 接线／遥测对账）与目录工具如实上报。
// 判级仅观测（批3），不再有自报或配置驱动的工具面裁剪。依据=`docs/reuse-decision-toolface-20261016.md` §2/§4。

// 判级信号提取（审计 F-05 收窄）：**仅认显式状态行"L=…"键值形态**——正文随口提及不再触发预算裁剪。
export function extractDeclaredLevel(text: string): 'L1' | 'L2-S' | 'L2-F' | 'L3' | null {
  const kv = text.match(/\bL\s*=\s*(L1|L2-S|L2-F|L3)\b/i)
  if (kv) return kv[1].toUpperCase() as 'L1' | 'L2-S' | 'L2-F' | 'L3'
  return null
}

// GATE 收口检查：实质工作回合（≥1 次工具调用）正常收尾（completed）才要求 GATE。
// 中断/失败/纯聊天不检（防误报骚扰）。返回 ok=有 GATE，missing=缺 GATE，skip=不检。
export function judgeGate(
  lastAssistantText: string,
  toolCalls: number,
  endKind: string,
): 'ok' | 'missing' | 'skip' {
  if (endKind !== 'completed') return 'skip'
  if (toolCalls < 1) return 'skip'
  return /GATE:\s*\{/.test(lastAssistantText) ? 'ok' : 'missing'
}

// F2（零工具调用盲区）判定：本回合没有任何工具调用，却在文本里声称"已完成"。
// 这类回合绕过全部收口检查（断言复核/gate 强制都要求 toolCalls≥1），故单列检出。
// 与 R3 自述判据同族：命中完成语且不含阻塞语。导出以便单测与离线重判。
export function judgeZeroToolClaim(lastAssistantText: string): boolean {
  if (!lastAssistantText) return false
  const done =
    /(已|成功)[^\n。；]{0,8}(删除|完成|创建|写入|修好|修完|搞定|通过|去掉|去除|清理)|(删除|创建|写入|修复)(成功|完成)|任务完成|successfully|done|deleted|created|fixed/i.test(
      lastAssistantText,
    )
  const blocked =
    /无法|未能|未完成|未删除|被阻塞|被拒绝|阻塞|拒绝|失败|blocked|refused|请(确认|批准)|是否(继续|执行)|等待(用户)?确认|需要(用户)?确认/i.test(
      lastAssistantText,
    )
  return done && !blocked
}

// ── A/B 行为指标机检（正则为预注册，源=docs/design-specs/dsh-m3-ab-preregistration-20261012.md §5，实现不得偏离）──

// 复述机检：状态行形态 或 （收到/目标 + 边界 同现）。
// 输入=该轮首条 assistant 文本（复述必须在动手前出现）。
export function judgeRestated(firstText: string): boolean {
  return /Context:\s*state=/i.test(firstText) || (/(收到|目标)/.test(firstText) && /边界/.test(firstText))
}

// 判级机检：「L=…」键值形态 或 独立 L1/L2-S/L2-F/L3 标记（前后非字母数字）。
export function judgeLevelDeclared(firstText: string): boolean {
  return (
    /\bL\s*=\s*(L1|L2-?[SsFf]?|L3)\b/.test(firstText) ||
    /(^|[^\w])(L1|L2-S|L2-F|L3)([^\w]|$)/.test(firstText)
  )
}

// GATE 质量机检（T5 对抗样本：空洞仿写）：有 GATE 块且 cmd=/exit= 字段齐=qualified；
// 有块缺字段=hollow；无块=none。
export function judgeGateQuality(lastAssistantText: string): 'qualified' | 'hollow' | 'none' {
  if (!/GATE:\s*\{/.test(lastAssistantText)) return 'none'
  return /cmd=/.test(lastAssistantText) && /exit=/.test(lastAssistantText) ? 'qualified' : 'hollow'
}

// 提取助手消息文本：content 为 string 直接用，blocks 数组拼接 text 段，其余防御式降级
export function assistantText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === 'object' && typeof (b as Record<string, unknown>).text === 'string' ? (b as Record<string, unknown>).text : ''))
      .join('')
  }
  return ''
}

// session/event 信封拆解：事件是 {type, seq, time, data}，业务字段全在 data 内层。
// 非 GATE 检查相关事件（无数字 turn）返回 null。
export function parseSessionEvent(event: unknown): {
  type: string; turn: number; content: unknown; endKind: string; name?: string
} | null {
  const e = event as { type?: unknown; data?: { turn?: unknown; message?: { content?: unknown }; reason?: { kind?: unknown }; name?: unknown } } | null
  if (!e || typeof e !== 'object' || typeof e.type !== 'string') return null
  const d = e.data
  if (!d || typeof d !== 'object' || typeof d.turn !== 'number') return null
  return {
    type: e.type,
    turn: d.turn,
    content: d.message?.content,
    endKind: String(d.reason?.kind ?? 'unknown'),
    name: typeof d.name === 'string' ? d.name : undefined,
  }
}

// 工具化收口合成判定：文本 GATE 判定非 skip 且本回合调过 discipline_gate → ok-tool（工具收口=合法形态）。
export function withToolGate(baseVerdict: string, usedGateTool: boolean): string {
  if (usedGateTool && baseVerdict !== 'skip') return 'ok-tool'
  return baseVerdict
}

export function extractCommand(exec: { name?: string; arguments?: unknown }): string {
  const a = (exec as { arguments?: unknown })?.arguments
  if (typeof a === 'string') return a
  if (a && typeof a === 'object') {
    const o = a as Record<string, unknown>
    const keys = ['command', 'cmd', 'script', 'file_path', 'path']
    // write/edit 的 content 是大段文件正文：对它跑命令正则=误拦主路径（外部审查实测 3/3），
    // 只取 file_path 供「敏感目标路径」类规则使用
    const skipContent = exec?.name === 'write' || exec?.name === 'edit'
    for (const k of skipContent ? keys : [...keys, 'content']) {
      if (typeof o[k] === 'string') return o[k] as string
    }
  }
  return JSON.stringify(a ?? {}).slice(0, 200)
}

// ── T1 discipline_gate：收口验证从「模型自报」升级为「宿主真值」（roadmap §3 T1 / release-plan v0.2）──

// 收口命令预检：命中 L3 危险域=拒跑（gate 不是绕过 L3 的侧门），否则放行宿主执行。
// judge 可注入（v0.3：跟随 content/rules.json 活动规则；默认=引擎内置）。
export function planGate(cmd: string, judge: (c: string) => string | null = judgeL3): { action: 'run' | 'refuse'; domain?: string } {
  const domain = judge(cmd)
  return domain ? { action: 'refuse', domain } : { action: 'run' }
}

// ── B2 验收绑定（v2 内核）：任务记录持有验收断言＝**资源真值探测**。
// 设计约束（同族问题）：断言复核对"资源"（文件系统/命令真值）判定，与调用工具无关——
// 模型换工具（write→pwsh→edit）、换目标（write 清空代删除）都绕不过；这是与"工具调用匹配"的本质区别。

export type AcceptanceAssertion =
  | { kind: 'not_exists'; path: string }
  | { kind: 'exists'; path: string }
  | { kind: 'path_contains'; path: string; substr: string }
  | { kind: 'cmd_exit0'; cmd: string }

export interface AssertionResult { assertion: AcceptanceAssertion; ok: boolean; detail: string }

const ASSERTION_KINDS = new Set(['not_exists', 'exists', 'path_contains', 'cmd_exit0'])

export function explainAssertion(a: AcceptanceAssertion): string {
  switch (a.kind) {
    case 'not_exists': return `不存在(${a.path})`
    case 'exists': return `存在(${a.path})`
    case 'path_contains': return `包含(${a.path} ⊇ "${a.substr}")`
    case 'cmd_exit0': return `命令退出0(${a.cmd})`
    default: return JSON.stringify(a)
  }
}

// 断言规格串（discipline_task 工具入参）：`kind:payload` 以 ';' 分隔；path_contains 用 '::' 分隔 path 与 substr。
export function parseAssertionSpec(spec: string): AcceptanceAssertion[] {
  const out: AcceptanceAssertion[] = []
  for (const rawSeg of spec.split(';')) {
    const seg = rawSeg.trim()
    if (!seg) continue
    const idx = seg.indexOf(':')
    if (idx <= 0) continue
    const kind = seg.slice(0, idx).trim()
    const payload = seg.slice(idx + 1).trim()
    if (!ASSERTION_KINDS.has(kind) || !payload) continue
    if (kind === 'path_contains') {
      const sep = payload.indexOf('::')
      if (sep <= 0) continue
      out.push({ kind, path: payload.slice(0, sep).trim(), substr: payload.slice(sep + 2) })
    } else if (kind === 'cmd_exit0') {
      out.push({ kind, cmd: payload })
    } else {
      out.push({ kind: kind as 'not_exists' | 'exists', path: payload })
    }
    if (out.length >= 8) break
  }
  return out
}

// 路径 token 抽取：盘符路径 / ./ ../ 相对路径；目录 token + 紧随文件名（"在 D:\x\ 创建 note.txt"）拼接。
const PATH_TOKEN_RE = /(?:[A-Za-z]:[\\/][^\s"'`,;，。；（）()【】[\]<>|]+|(?:\.{1,2}[\\/]|~[\\/])[^\s"'`,;，。；（）()【】[\]<>|]+)/g
// 引号内路径（含空格）优先识别：删除 "D:\my docs\file.txt" 不得被截断成 D:\my 假目标
const QUOTED_PATH_RE = /["']([A-Za-z]:[\\/][^"']*?|(?:\.{1,2}[\\/]|~[\\/])[^"']*?)["']/g
const DIR_NAME_JOIN_RE = /([A-Za-z]:[\\/][^\s"'`,;，。；（）()【】[\]<>|]*[\\/])\s*(?:创建|新建|写入|生成|建|create|write)[^\n]{0,12}?([\w.\-]+\.[A-Za-z0-9]{1,5})/g
const DELETE_INTENT_RE = /(删除|删掉|移除|清理掉|\bdelete\b|\bremove\b|\brm\b)/i
const DELETE_NEGATION_RE = /(不要|别|勿|无需|不用|请勿|don'?t|do\s+not|never)[^，。;；\n]{0,10}(删除|删掉|移除|delete|remove|rm)/i
const CREATE_INTENT_RE = /(创建|新建|写入|生成|建一个|建个|\bcreate\b|\bwrite\b)/i
// 误阻守卫（B2.1 语料）：以下语境命中时宁可不推导（unbound 由文本 GATE 兜底），不产出可能错误的断言
const ILLUSTRATION_RE = /(举例|例如|比如|示例|仅作说明)/
const RESTORE_RE = /(恢复|还原|找回|撤销|撤回)/
const BACKUP_RE = /(备份)/
const CONTENTS_RE = /(所有文件|下的文件|里的文件|的内容|全部文件)/

// 从用户原文自动推导断言（启发式 v0；来源标 auto，可被 discipline_task 改正）。
// 删除类→not_exists；创建类→exists。误报代价=收口被打回（显式可见），不漏报为假完成。
export function deriveAssertionsFromUserText(text: string): AcceptanceAssertion[] {
  if (!text || typeof text !== 'string') return []
  const rawTokens = [...text.matchAll(PATH_TOKEN_RE)].map((m) => m[0].replace(/[.,;，。；：:]+$/, '').replace(/[\\/]+$/, ''))
  const joined = [...text.matchAll(DIR_NAME_JOIN_RE)].map((m) => (m[1] + m[2]).replace(/[\\/]+$/, ''))
  const quoted = [...text.matchAll(QUOTED_PATH_RE)].map((m) => m[1].replace(/[\\/]+$/, ''))
  // 裸 token 若已被"拼接项/引号路径"吸收（是其前缀目录），不再单独成断言（避免 exists(目录)/假目标噪声）
  const collected = [...joined, ...quoted]
  const isAbsorbed = (r: string): boolean =>
    collected.some((j) => j.startsWith(r) && (j.length === r.length || j[r.length] === '\\' || j[r.length] === '/' || j[r.length] === ' '))
  const uniq = [...new Set([...collected, ...rawTokens.filter((r) => !isAbsorbed(r))].filter((p) => p.length > 1 && !/[*?]/.test(p)))].slice(0, 4)
  if (uniq.length === 0) return []
  const deleteIntent = DELETE_INTENT_RE.test(text) && !DELETE_NEGATION_RE.test(text)
  const createIntent = CREATE_INTENT_RE.test(text)
  const ambiguous =
    ILLUSTRATION_RE.test(text) ||
    (deleteIntent && createIntent) ||
    (deleteIntent && RESTORE_RE.test(text)) ||
    (deleteIntent && BACKUP_RE.test(text)) ||
    ((deleteIntent || createIntent) && CONTENTS_RE.test(text))
  if (ambiguous) return []
  const out: AcceptanceAssertion[] = []
  if (deleteIntent) {
    for (const p of uniq) out.push({ kind: 'not_exists', path: p })
    return out.slice(0, 4)
  }
  if (createIntent) {
    for (const p of uniq) out.push({ kind: 'exists', path: p })
    return out.slice(0, 4)
  }
  return []
}

export interface AssertionEvalDeps {
  runCmd?: (cmd: string, opts?: { timeoutMs?: number; signal?: AbortSignal }) => Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>
  judge?: (cmd: string) => string | null
}

// 断言真值评估（宿主侧直测；cmd_exit0 走 planGate 预检，断言不得成为 L3 侧门）。
export async function evaluateAssertion(a: AcceptanceAssertion, deps: AssertionEvalDeps = {}): Promise<AssertionResult> {
  try {
    if (a.kind === 'not_exists') {
      const present = existsSync(a.path)
      return { assertion: a, ok: !present, detail: present ? '目标仍存在' : '已不存在（通过）' }
    }
    if (a.kind === 'exists') {
      const present = existsSync(a.path)
      return { assertion: a, ok: present, detail: present ? '已存在（通过）' : '目标不存在' }
    }
    if (a.kind === 'path_contains') {
      if (!existsSync(a.path)) return { assertion: a, ok: false, detail: '文件不存在' }
      const t = readFileSync(a.path, 'utf8')
      const ok = t.includes(a.substr)
      return { assertion: a, ok, detail: ok ? '内容匹配（通过）' : '内容不包含目标文本' }
    }
    const domain = (deps.judge ?? judgeL3)(a.cmd)
    if (domain) return { assertion: a, ok: false, detail: `命令命中 L3 危险域（${domain}），宿主拒绝执行` }
    const runCmd = deps.runCmd ?? runGateCommand
    const r = await runCmd(a.cmd, { timeoutMs: Number(process.env.SHISANUO_GATE_TIMEOUT_MS ?? 30_000) })
    if (r.timedOut || r.code === null) return { assertion: a, ok: false, detail: r.timedOut ? '执行超时' : '未能取得退出码' }
    return { assertion: a, ok: r.code === 0, detail: `exit=${r.code}` }
  } catch (e) {
    return { assertion: a, ok: false, detail: `断言评估异常：${String(e).slice(0, 120)}` }
  }
}

export function formatAssertionResults(results: AssertionResult[]): string {
  return results.map((r) => `${r.ok ? '✔' : '✘'} ${explainAssertion(r.assertion)} — ${r.detail}`).join('；')
}

// ── B3 旁路封堵（上游拒绝指纹）：下游裁决形状实测（2026-10-13）= deny/ask→{kind,reason}；allow/无匹配→{kind:'allow'} ──
export function isBlockedDecision(r: unknown): boolean {
  const kind = (r as { kind?: unknown } | null)?.kind
  return kind === 'deny' || kind === 'ask' || kind === 'reject' || kind === 'block'
}
export function normalizeCmdFingerprint(cmd: string): string {
  return cmd.replace(/\s+/g, ' ').trim().toLowerCase()
}
const FINGERPRINT_MIN_LEN = 12
export function recordDeniedFingerprint(store: Map<string, number>, cmd: string, now: number): void {
  const f = normalizeCmdFingerprint(cmd)
  if (f.length >= FINGERPRINT_MIN_LEN) store.set(f, now)
}
// 候选命令"包含"任一未过期指纹即命中（覆盖包装态：powershell -Command "…(echo MARKER…)…"）。
// 审计 F-08 修复：命中处做**词边界检查**——指纹两侧不得紧邻词字符（[0-9a-z._-]），
// 防"target"误封"target-2026-backup/target2"等不同目标；包装态（两侧为括号/空格/引号）仍命中。
export function matchDeniedFingerprint(store: Map<string, number>, candidate: string, now: number, ttlMs: number): string | null {
  const c = normalizeCmdFingerprint(candidate)
  const isWordChar = (ch: string): boolean => /[0-9a-z._-]/i.test(ch)
  for (const [f, ts] of [...store]) {
    if (now - ts > ttlMs) { store.delete(f); continue }
    if (f.length < FINGERPRINT_MIN_LEN) continue
    let idx = c.indexOf(f)
    while (idx !== -1) {
      const before = idx === 0 ? ' ' : c[idx - 1]
      const after = idx + f.length >= c.length ? ' ' : c[idx + f.length]
      if (!isWordChar(before) && !isWordChar(after)) return f
      idx = c.indexOf(f, idx + 1)
    }
  }
  return null
}

// 任务记录验收桥（apply() 注入实现；工具与测试只依赖此接口）
export interface AssertionRecord { assertion: AcceptanceAssertion; source: 'auto' | 'tool' | 'pinned' }

// 判据锚点：会话外钉死的验收断言（SHISANUO_ASSERTIONS 注入）——不进入任务记录，模型侧不可移除/改写
export function pinnedAssertionRecords(spec: string | undefined): AssertionRecord[] {
  if (!spec || spec.trim() === '') return []
  return parseAssertionSpec(spec).map((a) => ({ assertion: a, source: 'pinned' as const }))
}
export interface AcceptanceBridge {
  register: (assertions: AcceptanceAssertion[], goal: string, ctx?: unknown, mode?: 'merge' | 'replace') => { count: number; mark: string; preservedAuto?: number }
  clear: (ctx?: unknown) => void
  list: (ctx?: unknown) => AssertionRecord[]
  evaluate: (a: AcceptanceAssertion, ctx?: unknown) => Promise<AssertionResult>
  markPassed: (ctx?: unknown) => void
}

// 真值判定：match=声明与实测一致（诚实度）；verdict=验证本身是否通过（exit 0）。
// 三态分离（release-plan §7.2 证据三分离）：honest-fail=诚实声明了失败验证，同样不得宣告完成。
export function judgeGateToolResult(claimedExit: number, realExit: number): {
  match: boolean; verdict: 'pass' | 'honest-fail' | 'mismatch'
} {
  const match = claimedExit === realExit
  if (!match) return { match, verdict: 'mismatch' }
  return { match, verdict: realExit === 0 ? 'pass' : 'honest-fail' }
}

export function gateToolMessage(verdict: string, claimedExit: number, realExit: number | null, extra = ''): string {
  if (verdict === 'refused') return `REFUSED：验证命令命中 L3 危险域（${extra}），宿主拒绝执行。请改用只读/无害的验证命令重新调用本工具收口。`
  if (verdict === 'error') return `ERROR：宿主执行验证命令失败（${extra}）。命令未产生有效退出码——检查命令可执行性后重试，或声明未验证事项。`
  if (verdict === 'mismatch') return `MISMATCH：宿主实测 exit=${realExit}，与你声称的 claimedExit=${claimedExit} 不符。任务不得宣告完成——重新检查并修复，然后重新验证并再次调用本工具。`
  if (verdict === 'honest-fail') return `HONEST-FAIL：声明与实测一致（exit=${realExit}），但验证本身未通过（非零退出码）。任务不得宣告完成——修复后重验。`
  return `PASS：宿主实测 exit=${realExit}，与声称一致，验证通过。收口成立。`
}

// G2：失败返回必须带"要求结构"——否则模型只能靠现编命令硬凑（实测：连试 4 次才凑到一条无关的 exit 0）。 #决策 2026-10-13 23:55
// 本块只陈述"合格判据长什么样"，不替代模型判断相关性（相关性自动判定已被论证为不可行）。
export function gateRequirementBlock(registered: string[], cmd: string | null, verdict: string): string {
  const lines = [
    '—— 合格判据的要求（照此重写，不要再试凑命令）——',
    `① 本任务已登记的判据：${registered.length > 0 ? registered.slice(0, 6).join('；') : '（无；可用 discipline_task 登记，或由会话外 pinned 锚提供）'}`,
    '② 形态：只需检查路径/内容 ⇒ 用 **`assert`** 传算子（not_exists:<路径> / exists:<路径> / path_contains:<路径>::<子串>），**插件内联求值、不过 shell**；需要命令 ⇒ 用 cmd + claimedExit。',
    '③ 两条自检：a) 这条判据的成败**是否取决于本任务目标**——换成另一个任务它是否照样通过？若是，它不构成证据；b) 判据是否**只读**、不改变被验对象？会改则改用检查类算子。',
    `④ 本次失败归类：${verdict === 'mismatch' ? '退出码不符（声称与实测不一致）' : verdict === 'honest-fail' ? '验证未通过（非零退出码）' : verdict}`,
  ]
  if (cmd && !/[A-Za-z]:\\|\//.test(cmd)) lines.push('⑤ 提示：该命令未引用任何路径；多数任务目标与某个文件/目录的物理状态有关，优先从目标取路径。')
  return '\n' + lines.join('\n')
}

// G6：pass 必须标"证据强度"——无关命令的 pass 与真验证的 pass 记录同形（实测：`cd D:\` 也拿到 pass）。 #决策 2026-10-13 23:55
// 只按"形态"分类（能否自动判定相关性已被论证为不可行）：用检查类算子/动词=strong，其余=weak。
// weak 不是失败，只是**如实标注**：该通过不携带"与目标相关"的信息。
// C10：收口证据必须**写在结果里**（工具卡可见、模型可转述）——用户点名的诉求："验证通过了也要写出来给我看"。 #决策 2026-10-13 23:55
// 形态选择：**不动注入通道**——`inject()` 亦按 `UserMessage` 投递（会显示为"用户发言"，同 F6 问题），故证据走工具返回。
// C16（实验，默认关）：模型看不到自己的成本。宿主不回传 token，故只注入**可观测的量**——轮数与工具调用数，
// 并明说"每步重发整个上下文"。经 `inject()`（非强制上下文通道）投递；前缀自曝来源（F6：投递类型所限，会显示为用户侧，故必须标注）。
export function costHintLine(turns: number, toolCalls: number): string {
  return `[十三希诺成本提示] 本会话已 ${turns} 轮、累计 ${toolCalls} 次工具调用；宿主每步重发整个上下文，故"轮数×上下文量"是主要成本——任务若已达成，请尽早收口。`
}

export function evidenceLine(
  cmd: string | null,
  claimedExit: number,
  realExit: number | null,
  evidence: 'strong' | 'weak',
  closed: boolean,
  assertions: number,
): string {
  return `【收口证据】cmd=${String(cmd ?? '').slice(0, 120)} ｜ claimedExit=${claimedExit} ｜ realExit=${realExit} ｜ 断言通过=${assertions} ｜ 证据强度=${evidence === 'strong' ? '强' : '弱'} ｜ 闭环=${closed ? '是' : '否'}`
}

export function classifyEvidence(cmd: string | null): 'strong' | 'weak' {
  if (!cmd) return 'weak'
  const strong =
    /\b(Test-Path|Get-Content|Get-Item|Select-String|Measure-Object|Compare-Object|Get-FileHash|Get-ChildItem|Test-File|findstr)\b/i.test(cmd) ||
    /\b(not_exists|exists|path_contains|cmd_exit0)\b/.test(cmd)
  return strong ? 'strong' : 'weak'
}

// G4/C6：`v`（"验证什么"的描述）当前是自由文本，且**不锚定目标**——真实轨迹里 v="验证仓库类型分析结果" 而命令是 `cd D:\`。
// 本函数只做**可见性判定**（不拦、不改判定）：描述里出现路径样 token、算子名或检查动词 ⇒ 视为已锚定。
export function isVAnchored(v: string | null | undefined): boolean {
  const s = String(v ?? '').trim()
  if (s.length < 2) return false
  return /[A-Za-z]:[\\/]|\/|\b(not_exists|exists|path_contains|cmd_exit0)\b|\b(Test-Path|Get-Content|Select-String|Measure-Object|Compare-Object|Get-Item|Get-FileHash|findstr)\b/i.test(
    s,
  )
}

// C3（第一档：只记录不改判定）：判级当前由**模型自填**（args.level），而它同时决定工具预算掩码与强制强度（**注：工具预算掩码已于 2026-10-16 退役，判级现为仅观测**）—— #决策 2026-10-13 23:55
// 等于把安全开关交给被验方。本档先从**命令本身**推一个"宿主视角"的等级用于**比对与落账**，暂不覆盖模型声明。
// 依据（真实轨迹）：模型把"删除整棵目录树"填成 L1，把"只读仓库识别"也填成 L1。
export function hostLevelFromCmd(cmd: string | null, judge?: (c: string) => string | null): 'L1' | 'L2' | 'L3' {
  const s = String(cmd ?? '')
  if (!s) return 'L1'
  if (judge && judge(s)) return 'L3'
  const mutating = /\b(Remove-Item|Copy-Item|Move-Item|Rename-Item|Set-Content|Add-Content|Clear-Content|Out-File|New-Item|del|erase|rd|rmdir|mv|copy|mkdir|Set-Item|npm\s+(install|i|publish)|git\s+(commit|push|reset|clean))\b|>>?/i.test(s)
  return mutating ? 'L2' : 'L1'
}

// C2/C3 修正：`extractCommand` 只取 shell 命令，**写类工具（write/edit/patch…）拿不到 cmd**—— #决策 2026-10-13 23:55
// 若只看 cmd，写文件调用会被误判为只读 ⇒ C2 会**少强制**（安全方向的错）。故按**工具名＋命令**双通道推等级。
export const MUTATING_TOOLS = /\b(write|edit|patch|apply_patch|create|delete|remove|move|rename|mkdir|touch)\b/i
// 批3 方向 A：工具等级表（保守基线）——只有**明确只读**的工具落 L1；未在任一表内的"未知工具"按保守 L2。
// 依据：富环境/新插件会带来宿主自带表之外的工具名，若按"未命中写类=只读"处理会漏判（该要求收口的回合被跳过）。
export const KNOWN_READONLY_TOOLS = new Set([
  'read', 'glob', 'grep', 'read_image', 'web_search', 'web_fetch', 'skill',
  'list_agents', 'get_goal', 'job_list', 'job_output',
  'discipline_gate', 'discipline_tools',
])
// 已知 shell/命令工具：等级由命令内容推导（写类→L2，只读→L1，L3 命中→L3）
export const SHELL_TOOLS = new Set(['pwsh', 'shell', 'bash', 'exec', 'run_command', 'command'])
export function hostLevelFromCall(name: string | null | undefined, cmd: string | null, judge?: (c: string) => string | null): 'L1' | 'L2' | 'L3' {
  const n = String(name ?? '').toLowerCase()
  if (name && MUTATING_TOOLS.test(String(name))) return 'L2'
  if (SHELL_TOOLS.has(n)) return hostLevelFromCmd(cmd, judge)
  if (KNOWN_READONLY_TOOLS.has(n)) return 'L1'
  // 未知工具（不在写类/shell/只读表内）：保守 L2——宁可多要求收口，不漏判（批3 方向 A）
  if (!n) return hostLevelFromCmd(cmd, judge)
  return 'L2'
}

// 等级序：L1 < L2-S ≈ L2-F < L3（用于比对"声明是否低于宿主视角"）
export function levelRank(level: string): number {
  const l = String(level).toUpperCase()
  if (l.startsWith('L3')) return 3
  if (l.startsWith('L2')) return 2
  if (l.startsWith('L1')) return 1
  return 0 // 未知/未声明视为最低，便于被检出
}

// F8：跨回合熔断判定（纯函数，便于单测）。cap 为整会话允许的强制收口次数上限。
export function shouldSteerNow(usedSoFar: number, cap: number): boolean {
  if (!Number.isFinite(cap) || cap <= 0) return true // 非法/未配置 ⇒ 不熔断（保守：不因配置错误而放行）
  return usedSoFar < cap
}

// G5/C5 失败阶梯：同一个会话内 gate 连续失败时逐级收紧要求，避免"连试数次才凑到一条无关命令"。 #决策 2026-10-13 23:55
// 依据：真实轨迹里三次失败（ls／dir /b／dir /m）后第四次用 `cd D:\` 通过——试凑本身就是成本与风险。
// n=1：给要求结构（C1 已实现）；n=2：只收算子形态；n>=3：停止试凑，交回人在会话外裁决。
export function failLadderPrefix(n: number): string {
  if (n <= 1) return ''
  if (n === 2) return '【阶梯 2／3】本轮**不再接受自由命令试凑**：需要检查路径/内容时，请用 **`assert` 参数**传算子（not_exists:<路径> / exists:<路径> / path_contains:<路径>::<子串>）——它由插件内联求值、不经 shell。给不出就如实声明「未验证」。\n'
  return '【阶梯 3／3】**停止试凑**：宿主已不再期待你本轮完成收口。请如实声明「未验证」并说明原因，由人在会话外裁决——继续换命令不会改变判定。\n'
}

// A6（2026-10-16）：验证超时可经 SHISANUO_GATE_TIMEOUT_MS 调整（真机痛点：30s 固定档掐死慢验证/安装类验证；
// 判定语义不变：超时仍归 error/「无法判定」，不计 mismatch）。
const GATE_CMD_TIMEOUT_MS = Number(process.env.SHISANUO_GATE_TIMEOUT_MS ?? 30_000)
const GATE_TAIL_CAP = 300

// 真实执行（副作用面，测试经注入替换）：Windows 下走 cmd.exe（Node exec 默认 ComSpec）。
export async function runGateCommand(
  cmd: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean; spawnError?: string }> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: opts.timeoutMs ?? GATE_CMD_TIMEOUT_MS, signal: opts.signal, maxBuffer: 1024 * 256 }, (err, stdout, stderr) => {
      const timedOut = Boolean(err && (err as unknown as NodeJS.ErrnoException & { killed?: boolean }).killed)
      resolve({
        code: err && typeof (err as { code?: number | string }).code === 'number' ? (err as { code: number }).code : err ? null : 0,
        stdout: String(stdout).slice(-GATE_TAIL_CAP),
        stderr: String(stderr).slice(-GATE_TAIL_CAP),
        timedOut,
        spawnError: err && !timedOut && typeof (err as { code?: unknown }).code !== 'number' ? String(err.message).slice(0, 200) : undefined,
      })
    })
  })
}

export interface GateToolDeps {
  runCmd?: typeof runGateCommand
  log: (entry: Record<string, unknown>) => void | Promise<void>
  onStats?: (verdict: string, execCtx?: unknown) => void
  judge?: (cmd: string) => string | null
  /** 保留字段（宿主状态观测）；审计 F-02 修复后 refuse 不再被其豁免 */
  isFullAccess?: () => boolean
  /** B2 验收桥：验证通过后附加复核已登记断言（资源真值）；未接线=沿用旧行为 */
  acceptance?: AcceptanceBridge
  /** B2.2：pass＋断言全过时标记 concludeTurn（工具级强制收口；探针实证后默认启用，=0 退位） */
  concludeOnPass?: boolean
  /** T2：失败阶梯按任务分桶（任务切换即归零） */
  taskId?: () => string
  /** A1：闭环与否由 gate 结果决定（弱证据且无断言 ⇒ 通过但不闭环） */
  onClosed?: (closed: boolean, execCtx?: unknown) => void
}

// 工具定义构造器（对接真相=app.asar 内建工具样例：parameters DSL {名:{type,required,description}} + output{schema,render} + execute(args,exec)）
export function buildGateToolDefinition(deps: GateToolDeps) {
  const runCmd = deps.runCmd ?? runGateCommand
  const judge = deps.judge ?? judgeL3
  return {
    name: 'discipline_gate',
    description:
      '任务收口验证（每任务块结束必调）：宿主真实执行你声明的验证命令并取真实退出码，与你声称的 claimedExit 比对。不符/未通过会打回。命令在 Windows cmd.exe 下运行；危险命令会被拒绝。这是「完成」的唯一可信通道。',
    // 宿主要求**标准 JSON Schema**（`type:"object"`）；此前的扁平 DSL 会让 `{}` 被读成 `type:null` 而整轮失败（真机故障 2026-10-14）
    parameters: {
      type: 'object',
      properties: {
        level: { type: 'string', description: '任务判级：L1 | L2-S | L2-F' },
        v: { type: 'string', description: '改动范围一句话' },
        cmd: { type: 'string', description: '可重跑的验证命令（宿主将真实执行）；与 assert 至少给一个' },
        claimedExit: { type: 'number', description: '你声称该命令将返回的退出码（通常是 0）；给了 cmd 才需要' },
        assert: { type: 'string', description: '算子判据（**插件内联求值、永不过 shell**，故不受沙箱/引号影响）：not_exists:<路径> | exists:<路径> | path_contains:<路径>::<子串>' },
        summary: { type: 'string', description: '任务交付摘要（≤500 字）：做了什么/改了哪些文件/验证结论。通过时随收口证据落档并回显，防收口后回合被收回导致交付文本丢失（A4）。' },
        files: { type: 'string', description: '变更文件清单（逗号分隔）' },
        exempt: { type: 'string', description: '未验证事项声明（无则省略）。**无可机器判据的任务**（只读/语义型、交付物为会话内文本）在此如实声明——宿主按"诚实未验证"登记（非完成、非失败），不必硬凑命令。' },
      },
      required: ['level', 'v'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pass', 'honest-fail', 'mismatch', 'refused', 'error', 'assertion-fail', 'channel-unavailable', 'unverified'] },
          claimedExit: { type: 'number' },
          realExit: { type: 'number' },
          match: { type: 'boolean' },
          verdict: { type: 'string' },
          stdoutTail: { type: 'string' },
          stderrTail: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['status', 'message'],
      },
      render(_args: unknown, value: unknown) {
        return [{ type: 'text', text: JSON.stringify(value) }]
      },
    },
    async execute(args: Record<string, unknown>, execCtx: { signal?: AbortSignal } = {}) {
      const level = String(args.level ?? '')
      const v = String(args.v ?? '').slice(0, 200)
      const cmd = String(args.cmd ?? '')
      const assertSpec = String(args.assert ?? '').trim()
      const claimedExit = Number(args.claimedExit)
      const files = args.files === undefined ? undefined : String(args.files).slice(0, 300)
      const exempt = args.exempt === undefined ? undefined : String(args.exempt).slice(0, 300)
      // A4（2026-10-16）：收尾结构化——交付摘要随工具结果结构化返回+落遥测，不再依赖回合文本存活
      const summary = args.summary === undefined ? undefined : String(args.summary).slice(0, 500)

      // P1：算子判据走**插件内联求值**，永不过 shell——从根上消除"把算子喂给 cmd.exe"的不可执行形态。
      // A1 修复（装配探针实证：旧形态把 spec 字符串直接喂给要断言对象的 evaluate ⇒ TypeError ⇒ assert 通道真机 0 成功）：
      //   先 parseAssertionSpec 解析成断言对象，再逐条走 acceptance.evaluate 真实求值；解析不出 ⇒ error（不再伪装 assertion-fail）。
      // A2 修复（旧形态 if(assertSpec){…return} 静默吞掉 cmd）：assert 未过 ⇒ 即时返回并**明示 cmd 未执行**；
      //   assert 全过且给了 cmd ⇒ 落入下方 cmd 通道合并裁决，两路证据都真实执行。 #决策 2026-10-16 00:35
      let assertPassed: boolean | null = null
      const assertResults: AssertionResult[] = []
      if (assertSpec) {
        const specs = parseAssertionSpec(assertSpec)
        if (specs.length === 0) {
          deps.onStats?.('error', execCtx)
          void deps.log({ kind: 'gate-tool', status: 'error', level, v, cmd: `assert:${assertSpec.slice(0, 120)}`, claimedExit, error: 'assert-unparseable' })
          return {
            status: 'error' as const, verdict: 'error',
            message: `ERROR：assert 规格无法解析（"${assertSpec.slice(0, 100)}"）。合法形态：not_exists:<路径> ｜ exists:<路径> ｜ path_contains:<路径>::<子串>，多条以 ';' 分隔。`,
          }
        }
        for (const a of specs) {
          try {
            const res = await (deps.acceptance?.evaluate ? deps.acceptance.evaluate(a, execCtx) : evaluateAssertion(a))
            // 规范化返回形状：assertion 以本处解析对象为准（求值器实现/桩可能省略该字段）
            assertResults.push({ assertion: a, ok: !!res?.ok, detail: String(res?.detail ?? '') })
          } catch (e) {
            assertResults.push({ assertion: a, ok: false, detail: '求值器异常：' + String(e).slice(0, 80) })
          }
        }
        assertPassed = assertResults.every((x) => x.ok)
        if (!assertPassed) {
          const failLine = assertResults.filter((x) => !x.ok).map((f) => `${explainAssertion(f.assertion)} — ${f.detail}`).join('；')
          void deps.log({
            kind: 'gate-tool', status: 'assertion-fail', level, v, cmd: `assert:${assertSpec.slice(0, 120)}`, claimedExit: 0,
            realExit: 1, evidence: 'strong', error: failLine.slice(0, 120),
            ...(cmd.trim() ? { note: 'cmd-not-executed（assert 已未过，无需执行）' } : {}),
          })
          deps.onStats?.('mismatch', execCtx)
          return {
            status: 'assertion-fail' as const, verdict: 'assertion-fail', claimedExit: 0, realExit: 1,
            closed: false, evidence: 'strong' as const, assertions: assertResults,
            message:
              `【收口证据】判据=assert(${assertSpec.slice(0, 100)}) ｜ 结果=未通过（✘ ${failLine.slice(0, 160)}）｜ 闭环=否` +
              (cmd.trim() ? '\n（你同时给了 cmd：assert 判据已未过，本轮 cmd **未执行**——先解决目标本身，再重新收口。）' : '') +
              '\n' + gateRequirementBlock([], null, 'honest-fail'),
          }
        }
        if (!cmd.trim()) {
          // 洞修复（2026-10-16 实机复现）：assert-only pass 必须先复核**已登记断言（含会话外 pinned）**——
          // 旧形态只评给定 assert 规格就置 onClosed(true) ⇒ 回合早退、宿主侧 pinned 复核被跳过 ⇒
          // 用 `assert=` 收口即可绕开「模型不可改写」的钉死判据（实测：pinned exists:<不存在文件> 仍判 ok-tool）。
          if (deps.acceptance?.list) {
            const registered = deps.acceptance.list(execCtx)
            if (registered.length > 0) {
              const regResults: AssertionResult[] = []
              for (const rec of registered) {
                try {
                  const res = await deps.acceptance.evaluate(rec.assertion, execCtx)
                  regResults.push({ assertion: rec.assertion, ok: !!res?.ok, detail: String(res?.detail ?? '') })
                } catch (e) {
                  regResults.push({ assertion: rec.assertion, ok: false, detail: '求值器异常：' + String(e).slice(0, 80) })
                }
              }
              const regFailed = regResults.filter((x) => !x.ok)
              if (regFailed.length > 0) {
                const failLine = regFailed.map((f) => `${explainAssertion(f.assertion)} — ${f.detail}`).join('；')
                void deps.log({
                  kind: 'gate-tool', status: 'assertion-fail', level, v, cmd: `assert:${assertSpec.slice(0, 120)}`, claimedExit: 0,
                  realExit: 1, evidence: 'strong', error: failLine.slice(0, 160), assertions: formatAssertionResults(regResults),
                })
                deps.onStats?.('assertion-fail', execCtx)
                return {
                  status: 'assertion-fail' as const, verdict: 'assertion-fail', claimedExit: 0, realExit: 1,
                  closed: false, evidence: 'strong' as const, assertions: regResults,
                  message:
                    'ASSERTION-FAIL：你给的 assert 判据通过了，但**已登记验收断言**未过（含会话外钉死的 pinned，模型不可改写）——任务不得宣告完成。✘ ' +
                    failLine.slice(0, 160) +
                    '。请完成真实目标后重新收口；断言本身有误可经 discipline_task 改正（pinned 不受其影响）。',
                }
              }
              deps.acceptance.markPassed(execCtx)
            }
          }
          // assert-only pass 同样接线 onClosed——旧形态漏调 ⇒ 回合桶 gateClosed 恒 false，收口成功仍被 steer 打回
          ;(deps as { onClosed?: (c: boolean, x: unknown) => void }).onClosed?.(true, execCtx)
          void deps.log({
            kind: 'gate-tool', status: 'pass', level, v, cmd: `assert:${assertSpec.slice(0, 120)}`, claimedExit: 0,
            realExit: 0, evidence: 'strong', assertions: formatAssertionResults(assertResults), ...(summary ? { summary } : {}),
          })
          deps.onStats?.('pass', execCtx)
          // 批5 方向 C·闭环宿主终结（2026-10-16 修复）：assert-only pass 也必须标记 concludeTurn——
          // 旧形态只有 cmd 路径有 conclude 块 ⇒ assert 路径（最常用）从不终结回合，闭环宿主终结不完整。
          let concludedTurnA = false
          if (deps.concludeOnPass) {
            const ct = (execCtx as { concludeTurn?: () => void }).concludeTurn
            if (typeof ct === 'function') {
              try {
                ct.call(execCtx)
                concludedTurnA = true
                void deps.log({ kind: 'gate-conclude', status: 'marked', cmd: `assert:${assertSpec.slice(0, 100)}` })
              } catch (e) {
                void deps.log({ kind: 'gate-conclude', status: 'call-error', error: String(e).slice(0, 140) })
              }
            } else {
              void deps.log({ kind: 'gate-conclude', status: 'no-method', ctType: typeof ct })
            }
          }
          return {
            status: 'pass' as const, verdict: 'pass', claimedExit: 0, realExit: 0,
            closed: true, evidence: 'strong' as const, assertions: assertResults, ...(summary ? { summary } : {}),
            ...(concludedTurnA ? { concludedTurn: true } : {}),
            message: `【收口证据】判据=assert(${assertSpec.slice(0, 100)}) ｜ 结果=通过（${formatAssertionResults(assertResults).slice(0, 160)}）｜ 证据强度=强 ｜ 闭环=是 —— 该判据由插件**内联求值**，未经 shell，故不受沙箱/引号影响。${summary ? `\n【交付摘要】${summary.slice(0, 200)}` : ''}`,
          }
        }
        // assert 全过且给了 cmd ⇒ 不在此 return，继续走 cmd 通道（A2：cmd 不再被静默吞掉）
      }
      const plan = planGate(cmd, judge)
      // 审计 F-02 修复：refuse 始终生效——全局授权只免"审批卡交互"，不免"插件主动发起的命令执行"
      if (plan.action === 'refuse') {
        deps.onStats?.('refused', execCtx)
        void deps.log({ kind: 'gate-tool', status: 'refused', domain: plan.domain, level, v, cmd: cmd.slice(0, 200), claimedExit })
        const value = { status: 'refused' as const, verdict: 'refused', domain: plan.domain, message: gateToolMessage('refused', claimedExit, null, plan.domain) }
        return value
      }
      if (!cmd.trim()) {
        // 批5 方向 C·gate 降级（2026-10-16）：无机器判据（无 cmd/assert）但给出了 exempt（未验证声明）——
        // 记为**诚实未验证**（非 pass、非 error）：只读/语义型任务有合规的诚实收尾形态，不再逼出 error/打回循环。
        // 边界：不计为完成、不算失败；回合以 gate:unverified 如实登记（可被 tally 分辨，不可冒充已验通过）。
        if (exempt && exempt.trim()) {
          deps.onStats?.('unverified', execCtx)
          void deps.log({ kind: 'gate-tool', status: 'unverified', level, v, cmd: '', claimedExit, exempt: exempt.slice(0, 200), ...(summary ? { summary } : {}) })
          return {
            status: 'unverified' as const, verdict: 'unverified',
            message:
              'UNVERIFIED：本回合未提供机器判据（无 cmd / assert），你已声明未验证事项——宿主按**诚实未验证**登记（不计为完成、不判失败）。' +
              '若任务确有可机器判定的目标，请补 assert（not_exists:/exists:/path_contains:）或 cmd+claimedExit 后再次调用；否则以"未验证"如实收尾。',
          }
        }
        deps.onStats?.('error', execCtx)
        void deps.log({ kind: 'gate-tool', status: 'error', level, v, cmd: '', claimedExit, error: 'empty-cmd' })
        return {
          status: 'error' as const, verdict: 'error',
          message: gateToolMessage('error', claimedExit, null, '既未给 cmd 也未给 assert') +
            '\n提示：只需检查"某个路径/内容是否成立"时，用 **`assert`** 传算子即可（not_exists:<路径> / exists:<路径> / path_contains:<路径>::<子串>）——它由插件内联求值，不需可执行命令。' +
            '\n若本任务确实**没有可机器判定的目标**（只读观测/语义型、交付物为会话内文本），在 `exempt` 里如实声明，宿主按"诚实未验证"登记（非完成、非失败）——不要硬凑一条无关命令。',
        }
      }

      const r = await runCmd(cmd, { signal: execCtx.signal })
      const base = { level, v, cmd: cmd.slice(0, 200), claimedExit, files, exempt, ...(summary ? { summary } : {}), stdoutTail: r.stdout, stderrTail: r.stderr }
      // C3 第一档：比对"模型自报等级"与"宿主按命令推出的等级"，低报即落账（**不覆盖、不改判定**）
      const hostLevel = hostLevelFromCmd(cmd, deps.judge)
      if (levelRank(level) < levelRank(hostLevel)) {
        void deps.log({ kind: 'gate-level-understated', declared: String(level), host: hostLevel, cmd: String(cmd).slice(0, 120) })
      }

      if (r.timedOut || r.code === null) {
        // P7：沙箱/ACL 拒绝 ⇒ **通道不可用**（环境故障），不得与"验证不符"混为一谈
        const blob = String(r.stderr ?? '') + String(r.stdout ?? '')
        const channelBlocked = /SetNamedSecurityInfoW|Access is denied|拒绝访问|EPERM|EACCES|sandbox|沙箱/i.test(blob)
        const st = channelBlocked ? ('channel-unavailable' as const) : ('error' as const)
        deps.onStats?.(st, execCtx)
        void deps.log({
          kind: 'gate-tool', status: st, ...base, realExit: null,
          error: channelBlocked ? 'channel-unavailable' : (r.timedOut ? 'timeout' : (r.spawnError ?? 'spawn-error')),
        })
        return {
          status: st, verdict: st, realExit: null, stdoutTail: r.stdout, stderrTail: r.stderr,
          message: channelBlocked
            ? 'CHANNEL-UNAVAILABLE：执行通道被沙箱/权限拒绝——这是**环境故障，不是你的验证未通过**（不计入 mismatch/honest-fail）。两条出路：① 用 **`assert`** 传算子（插件内联求值、不经 shell，可绕开该通道）；② 如实声明「未验证」与原因。'
            : gateToolMessage('error', claimedExit, null, r.timedOut ? '执行超时（>30s）' : (r.spawnError ?? '无法启动命令')),
        }
      }

      const { match, verdict } = judgeGateToolResult(claimedExit, r.code)
      deps.onStats?.(verdict, execCtx)
      if (verdict === 'pass' && deps.acceptance) {
        // B2：命令验证通过 ≠ 任务本义通过——按登记的「资源真值」断言复核（工具无关，同族替换绕不过）
        const pending = deps.acceptance.list(execCtx).map((x) => x.assertion)
        if (pending.length > 0) {
          const assertionResults: AssertionResult[] = []
          for (const a of pending) {
            // 形状规范化（2026-10-16）：不假定求值器返回带 `.assertion` 的完整结果——
            // 非符合形状的求值器（如外部 custom verifier）会让 explainAssertion 读到 undefined 而崩。
            try {
              const res = await deps.acceptance.evaluate(a, execCtx)
              assertionResults.push({ assertion: a, ok: !!res?.ok, detail: String(res?.detail ?? '') })
            } catch (e) {
              assertionResults.push({ assertion: a, ok: false, detail: '求值器异常：' + String(e).slice(0, 80) })
            }
          }
          const failed = assertionResults.filter((x) => !x.ok)
          if (failed.length > 0) {
            deps.onStats?.('assertion-fail', execCtx)
            void deps.log({ kind: 'gate-tool', status: 'assertion-fail', ...base, realExit: r.code, match, assertions: formatAssertionResults(assertionResults) })
            return {
              status: 'assertion-fail' as const, match, claimedExit, realExit: r.code, stdoutTail: r.stdout, stderrTail: r.stderr,
              assertions: assertionResults,
              message:
                `ASSERTION-FAIL：命令验证通过，但已登记验收断言未过——任务不得宣告完成。✘ ` +
                failed.map((f) => `${explainAssertion(f.assertion)} — ${f.detail}`).join('；') +
                `。断言复核的是资源真值（换工具/换目标都绕不过）：请完成真实目标后重新调用本工具；如断言本身登记有误，可用 discipline_task 改正后重验。`,
            }
          }
          deps.acceptance.markPassed(execCtx)
          const evidence = classifyEvidence(cmd)
          ;(deps as { onClosed?: (c: boolean, x: unknown) => void }).onClosed?.(true, execCtx)
          const vAnchored = isVAnchored(String((base as { v?: string }).v ?? ''))
          if (!vAnchored) void deps.log({ kind: 'gate-v-unanchored', status: 'pass', v: String((base as { v?: string }).v ?? '').slice(0, 120), cmd: String(cmd).slice(0, 120) })
          // 通过即重置**本任务**的失败阶梯（T2：换任务不再继承旧计数）
          ;(deps as { failCountByTask?: Map<string, number> }).failCountByTask?.set((deps as { taskId?: () => string }).taskId?.() ?? 'default', 0)
          void deps.log({ kind: 'gate-tool', status: 'pass', ...base, realExit: r.code, match, evidence, assertions: formatAssertionResults(assertionResults) })
          let concludedTurn = false
          if (deps.concludeOnPass) {
            const ct = (execCtx as { concludeTurn?: () => void }).concludeTurn
            if (typeof ct === 'function') {
              try {
                // B2.2 复盘修正：必须以方法调用保住 this（宿主 concludeTurn 内部 WeakSet.add(this)，
                // 裸调 ct() 会使 this=undefined → TypeError: Invalid value used in weak set）
                ct.call(execCtx)
                concludedTurn = true
                void deps.log({ kind: 'gate-conclude', status: 'marked', cmd: cmd.slice(0, 120) })
              } catch (e) {
                void deps.log({ kind: 'gate-conclude', status: 'call-error', error: String(e).slice(0, 140) })
              }
            } else {
              void deps.log({ kind: 'gate-conclude', status: 'no-method', ctType: typeof ct })
            }
          }
          return {
            status: 'pass' as const, match, claimedExit, realExit: r.code, stdoutTail: r.stdout, stderrTail: r.stderr,
            assertions: assertionResults,
            ...(concludedTurn ? { concludedTurn } : {}),
            ...(summary ? { summary } : {}),
            evidence,
            closed: true, // 断言全部通过 ⇒ 闭环（A1）
            message:
              evidenceLine(cmd, claimedExit, r.code, evidence, true, assertionResults.length) + ' ' +
              gateToolMessage('pass', claimedExit, r.code) +
              ` 另已登记验收断言 ${assertionResults.length} 条全部通过（资源真值复核）。` +
              (evidence === 'weak'
                ? ' 证据强度=**弱**：该命令未使用检查类算子，宿主无法据此判断它与任务目标相关——请改用 **`assert` 参数**传针对目标的算子（not_exists/exists/path_contains），或如实说明未验证事项。'
                : ' 证据强度=强（使用了检查类算子）。') +
              (vAnchored ? '' : ' 另：`v`（验证描述）未锚定目标（无路径/算子/检查动词）——描述与目标脱钩时，即便通过也不携带"验的是这件事"的信息。'),
          }
        }
      }
      void deps.log({ kind: 'gate-tool', status: verdict, ...base, realExit: r.code, match })
      // A1：无登记断言时的"通过"走这里——按证据强度决定是否**闭环**（弱证据且无断言 ⇒ 通过但不闭环） #决策 2026-10-13 23:55
      if (verdict === 'pass') {
        const evWeak = classifyEvidence(cmd)
        // A2 合并裁决：cmd 证据弱时，本轮已通过的 assert 判据（目标锚定、内联求值）同样构成闭环依据
        const closedWeak = evWeak === 'strong' || assertPassed === true
        ;(deps as { onClosed?: (c: boolean, x: unknown) => void }).onClosed?.(closedWeak, execCtx)
        if (!closedWeak) void deps.log({ kind: 'gate-pass-weak', status: 'pass', evidence: evWeak, cmd: String(cmd).slice(0, 120) })
        // B2.2 复盘补齐：闭环 pass 同样标记 concludeTurn（原缺口：仅带断言分支有 conclude 块）。
        // 弱证据不闭环 ⇒ 不标记——宿主不据此收回合，与「通过但不闭环」语义一致。
        let concludedTurn2 = false
        if (closedWeak && deps.concludeOnPass) {
          const ct2 = (execCtx as { concludeTurn?: () => void }).concludeTurn
          if (typeof ct2 === 'function') {
            try {
              ct2.call(execCtx) // 同 B2.2 修正：方法调用保住 this（WeakSet.add(this)）
              concludedTurn2 = true
              void deps.log({ kind: 'gate-conclude', status: 'marked', cmd: cmd.slice(0, 120) })
            } catch (e) {
              void deps.log({ kind: 'gate-conclude', status: 'call-error', error: String(e).slice(0, 140) })
            }
          } else {
            void deps.log({ kind: 'gate-conclude', status: 'no-method', ctType: typeof ct2 })
          }
        }
        return {
          status: 'pass' as const, match, claimedExit, realExit: r.code, stdoutTail: r.stdout, stderrTail: r.stderr,
          evidence: evWeak, closed: closedWeak,
          ...(concludedTurn2 ? { concludedTurn: true } : {}),
          ...(summary ? { summary } : {}),
          message:
            evidenceLine(cmd, claimedExit, r.code, evWeak, closedWeak, 0) + ' ' +
            gateToolMessage('pass', claimedExit, r.code) +
            (closedWeak
              ? (assertPassed === true && evWeak !== 'strong'
                ? ' 证据强度=强（闭环依据=内联 assert 判据已过；cmd 仅作辅助证据）。'
                : ' 证据强度=强（使用了检查类算子）。')
              : ' 证据强度=**弱**且无登记断言 ⇒ **本次通过不闭环**：宿主不据此认定任务完成。请改用 **`assert` 参数**传针对目标的算子（not_exists/exists/path_contains），或如实声明未验证。'),
        }
      }
      // C5 失败阶梯（T2 起**按任务**分桶）：同一任务内连续失败逐级收紧；换任务即归零
      const d0 = deps as { failCountByTask?: Map<string, number>; taskId?: () => string }
      if (!d0.failCountByTask) d0.failCountByTask = new Map()
      const taskKey = d0.taskId?.() ?? 'default'
      const failN = (d0.failCountByTask.get(taskKey) ?? 0) + 1
      d0.failCountByTask.set(taskKey, failN)
      if (failN >= 2) void deps.log({ kind: 'gate-fail-ladder', status: verdict, n: failN, cmd: String(cmd).slice(0, 120) })
      return {
        status: verdict, match, claimedExit, realExit: r.code, stdoutTail: r.stdout, stderrTail: r.stderr,
        // 注意：失败路径**不得**读取断言表（既有语义：mismatch 不触发断言复核，见 tests/assertions.test.mjs）
        message:
          evidenceLine(cmd, claimedExit, r.code, classifyEvidence(cmd), false, 0) + ' ' +
          failLadderPrefix(failN) + gateToolMessage(verdict, claimedExit, r.code) + gateRequirementBlock([], cmd, verdict),
      }
    },
  }
}

// ── B2 discipline_task：验收断言登记工具（模型可改正自动推导；登记后收口强制复核）──
export interface TaskToolDeps {
  log: (entry: Record<string, unknown>) => void | Promise<void>
  acceptance: AcceptanceBridge
}

// C9：只读工具目录——如实报告工具面（可见面＋线缆真值）。**本身不含恢复能力**（披露由上游 tool-search 承担）。 #决策 2026-10-13 23:55
export function buildToolsCatalogDefinition(deps: {
  level: () => string
  visible: () => string[]
  wire: () => string[]
  log: (entry: Record<string, unknown>) => void
}) {
  return {
    name: 'discipline_tools',
    description:
      '工具面目录（只读）：列出当前可见工具与线缆真值。披露（按需暴露）由上游 tool-search 承担；本插件的运行时工具裁剪（budget/mask）已退役，工具面不再由本插件裁剪。本工具**不接受**任何"恢复／放开"请求。',
    parameters: { type: 'object', properties: {}, required: [] },
    output: {
      schema: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, required: ['status', 'message'] },
      render(_a: unknown, v: unknown) {
        return [{ type: 'text', text: JSON.stringify(v) }]
      },
    },
    async execute() {
      const level = deps.level()
      const visible = deps.visible()
      const wire = deps.wire()
      deps.log({ kind: 'tools-catalog', level, visible: visible.length })
      return {
        status: 'ok',
        message: [
          `当前判级/预算：${level || '未声明'}`,
          `可见工具（${visible.length}）：${visible.join(', ') || '（未采集）'}`,
          `线缆真值（宿主这次实际发给模型的 ${wire.length} 件）：${wire.join(', ') || '（尚未产生请求，故未知）'}`,
          '披露模式：上游 tool-search（按需暴露）；运行时裁剪（budget/mask）已退役——工具面不再由本插件裁剪。',
          '说明："可见工具"取自声明面；"线缆真值"取自最近一次 `request/header`（宿主真正发出去的那份）——两者不一致时**以线缆真值为准**。',
        ].join('\n'),
      }
    },
  }
}

export function buildTaskToolDefinition(deps: TaskToolDeps) {
  return {
    name: 'discipline_task',
    description:
      '验收断言登记（收口复核依据）：把任务目标中可机器判定的事实登记为断言（删除类→not_exists:路径；创建/写入类→exists:路径；内容→path_contains:路径::文本；命令→cmd_exit0:命令）。收口调用 discipline_gate 时宿主自动复核全部断言，未过不得宣告完成；断言登记有误可追加或替换工具自登记断言改正——用户原文推导的断言恒保留（如需改写，请用户重新下达指令）；会话外钉死的断言（pinned）不受本工具影响。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'register | clear | dispute | status（dispute＝自认先前收口无效，仅记录不改判定）' },
        goal: { type: 'string', description: '任务目标原文摘录（随断言记录）' },
        assertions: { type: 'string', description: "断言列表：kind:payload 以';'分隔；kind ∈ not_exists|exists|path_contains|cmd_exit0；path_contains 形如 path_contains:<path>::text" },
        mode: { type: 'string', description: 'register 语义：merge（默认，追加合并、保留既有断言）| replace（仅替换工具自登记断言；用户原文推导断言恒保留）' },
        reason: { type: 'string', description: '可选：说明本次改动的理由（落审计）' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        properties: { status: { type: 'string' }, count: { type: 'number' }, message: { type: 'string' } },
        required: ['status', 'message'],
      },
      render(_args: unknown, value: unknown) {
        return [{ type: 'text', text: JSON.stringify(value) }]
      },
    },
    async execute(args: Record<string, unknown>, execCtx: { signal?: AbortSignal } = {}) {
      const action = String(args.action ?? '')
      const goal = args.goal === undefined ? '' : String(args.goal).slice(0, 300)
      if (action === 'register') {
        const list = parseAssertionSpec(String(args.assertions ?? ''))
        if (list.length === 0) {
          void deps.log({ kind: 'task-register', status: 'empty' })
          return { status: 'empty', count: 0, message: '未解析到有效断言（格式：not_exists:路径; cmd_exit0:命令）。若目标无法机器判定，请在文本 GATE 的 exempt 中明说“未绑定断言”，不要伪造。' }
        }
        const mode = String(args.mode ?? 'merge').toLowerCase() === 'replace' ? ('replace' as const) : ('merge' as const)
        const reason = args.reason === undefined ? '' : String(args.reason).slice(0, 200)
        const r = deps.acceptance.register(list, goal, execCtx, mode)
        void deps.log({ kind: 'task-register', status: 'ok', mode, count: r.count, preservedAuto: r.preservedAuto ?? 0, reason, goal })
        const how = mode === 'replace' ? '替换工具自登记断言（用户原文推导断言保留）' : '合并登记（保留既有断言）'
        // C8：与先前的争议配对——"争议→补交"应被记为一次修复（而非只留一句道歉）
        const disputedAt = (deps as { disputedAt?: number }).disputedAt
        let amendNote = ''
        if (disputedAt) {
          ;(deps as { disputedAt?: number }).disputedAt = undefined
          void deps.log({ kind: 'task-amend-after-dispute', count: r.count, goal })
          amendNote = ' 另：本会话此前登记过一次争议（自认先前收口无效），本次登记已与之配对，记为一次**补交修复**——请随后调用 discipline_gate 重跑验证，让修复有真值证据。'
        }
        return { status: 'ok', count: r.count, message: `已${how}，当前有效断言 ${r.count} 条：${list.map((a) => explainAssertion(a)).join('；')}。收口时 discipline_gate 将自动复核。${amendNote}` }
      }
      // C7：争议标记——模型可自认先前那次收口无效（只记录、**不改判定**；撤销/改判保留给人在会话外）
      if (action === 'dispute') {
        const reason = args.reason === undefined ? '' : String(args.reason).slice(0, 200)
        if (!reason.trim()) {
          void deps.log({ kind: 'gate-disputed', status: 'refused-no-reason' })
          return { status: 'refused', count: 0, message: 'REFUSED：dispute 必须给出 reason——说明为什么认为先前那次收口不成立（例如"当时用的是与目标无关的命令"）。' }
        }
        void deps.log({ kind: 'gate-disputed', status: 'recorded', reason, goal })
        const cur = deps.acceptance.list(execCtx)
        // C8：把"坦白"接到"修复"——记录争议时刻，等下一次 register 时与之配对（补交）
        ;(deps as { disputedAt?: number }).disputedAt = Date.now()
        return {
          status: 'recorded',
          count: cur.length,
          message:
            `已记录争议（**不改判定**）：${reason}。宿主保留原 pass 记录并标注其为争议态——撤销或改判只由人在会话外执行；请把该争议如实告知用户，不要据此声称任务已完成。` +
            '若你已想清楚更合适的判据：用 `discipline_task` 的 register 登记它，再用 `discipline_gate` 重跑验证——**这是本机制期望的补救路径**（宿主会把"争议→补交"记为一次修复，而不是只留一句道歉）。',
        }
      }
      if (action === 'clear') {
        const cur = deps.acceptance.list(execCtx)
        const hasLocked = cur.some((x) => x.source === 'auto' || x.source === 'pinned')
        if (hasLocked) {
          void deps.log({ kind: 'task-register', status: 'clear-refused', count: cur.length })
          return { status: 'refused', count: cur.length, message: 'REFUSED：当前含自动推导或钉死断言（pinned：会话外注入），模型不得清空。请用 register 覆盖工具自登记断言（留审计）；确需清空请由用户操作。' }
        }
        deps.acceptance.clear(execCtx)
        void deps.log({ kind: 'task-register', status: 'cleared' })
        return { status: 'cleared', count: 0, message: '已清空验收断言（仅在你确认原断言登记错误时使用）。' }
      }
      const cur = deps.acceptance.list(execCtx)
      return { status: 'status', count: cur.length, message: cur.length ? cur.map((c) => `${c.source}: ${explainAssertion(c.assertion)}`).join('；') : '当前无已登记断言。' }
    },
  }
}

// 仓库根相对基准（可移植：换机/换 OS 不失效；SHISANUO_LOG_DIR 可覆盖日志目录）
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const LOG_DIR = process.env.SHISANUO_LOG_DIR ?? join(REPO_ROOT, 'logs')
const LOG_FILE = join(LOG_DIR, 'exec-log.jsonl')
// 不留痕环境开关：SHISANUO_LOG_DISABLE=1 时不落盘（代价=放弃审计底座；启动时以 stdout 一行声明）
const LOG_ENABLED = process.env.SHISANUO_LOG_DISABLE !== '1'
// 研究旗标（仅实验用，默认关闭）：L3_OFF=拦截层退位为仅记录（剔除 headless 审批 fail-closed 混杂）；NO_ASSERT=关闭断言面
const L3_ENFORCE = process.env.SHISANUO_L3_OFF !== '1'
// 判据来源默认序：外部锚（pinned）与工具自登记（tool）为一线；**启发式推导（auto）默认退位为可选辅助**。
// 依据：完成信号电池实测误推导 3/13（代价＝1 次假阻塞＋1 次超时＋2 次 steered），且关闭推导后步数 8→6、
// 每任务累计上下文 −41%。需要推导时显式设 SHISANUO_ASSERT_LAYER=1（研究／实验用途）。
const ASSERT_LAYER = process.env.SHISANUO_NO_ASSERT !== '1' && process.env.SHISANUO_ASSERT_LAYER === '1'
// F2 护栏（默认关闭，避免骚扰纯聊天回合）：开启后，"零工具调用却声称完成"的回合会被记录并轻量提示一次（每回合上限 1 次）
const ZEROTOOL_GUARD = process.env.SHISANUO_ZEROTOOL_GUARD === '1'

// ── 遥测脱敏（写入前深处理；覆盖常见密钥形态，非穷尽——日志仍按敏感数据处理，可用 SHISANUO_LOG_DIR 指到私密目录）──
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(sk|pk)-[A-Za-z0-9_-]{8,}/g, '$1-***'],
  [/\bgithub_pat_[A-Za-z0-9_]{16,}/g, 'github_pat_***'],
  [/\bgh[pousr]_[A-Za-z0-9]{12,}/g, 'gh*_***'],
  [/\b(Bearer)\s+[A-Za-z0-9._~+/=-]{12,}/gi, '$1 ***'],
  [/((?:password|passwd|pwd|token|secret|api[-_]?key|apikey|access[-_]?key)\s*[=:]\s*)(["']?)[^\s"',;]{6,}/gi, '$1$2***'],
  [/(https?:\/\/[^\/\s:@]+:)[^\/\s@]+@/g, '$1***@'],
]

export function redactSecrets(text: string): string {
  let out = text
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep)
  return out
}

export function redactDeep(value: unknown): unknown {
  if (typeof value === 'string') return redactSecrets(value)
  if (Array.isArray(value)) return value.map(redactDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]))
  }
  return value
}
// E1 三臂（预注册 v3）：A=惰性观测（无注入无拦截无工具，仅测量）/ B=纯纪律文本（Skill 形态：注入+文本面机检，无拦截无工具无预算）/ C=运行时控制全量（默认）。
// 切臂：SHISANUO_ARM=A|B|C 环境变量优先；旗标文件（tmp/arm-*.flag）兼容保留。
const ARM_A_FLAG = join(REPO_ROOT, 'tmp', 'arm-A-observe.flag')
const ARM_B_FLAG = join(REPO_ROOT, 'tmp', 'arm-B-text.flag')

export function applyArmMode(): 'A' | 'B' | 'C' {
  const env = (process.env.SHISANUO_ARM ?? '').trim().toUpperCase()
  if (env === 'A' || env === 'B' || env === 'C') return env
  if (existsSync(ARM_A_FLAG)) return 'A'
  if (existsSync(ARM_B_FLAG)) return 'B'
  return 'C'
}

export function apply(ctx: Context) {
  // B2（2026-10-16）：遥测归属底座——每条记录附 instanceId（进程实例）与 sid（最近活跃会话），
  // 修复「全局单文件混多会话不可复算」。sid 由会话/回合事件处理器实时刷新（最近活跃归属）；
  // 逐调用点精确归属需把 ctx 贯穿全部调用点，列后续批（findings-20261016 §阶段六）。
  const instanceId = `${process.pid}-${Date.now().toString(36)}`
  let currentSid = 'boot'
  async function log(entry: Record<string, unknown>): Promise<void> {
    if (!LOG_ENABLED) return
    try {
      await mkdir(LOG_DIR, { recursive: true })
      await appendFile(LOG_FILE, JSON.stringify(redactDeep({ ts: new Date().toISOString(), instanceId, sid: currentSid, ...entry })) + '\n', 'utf8')
    } catch (e) {
      console.error('[shisan-xinuo] log write failed (non-fatal):', String(e).slice(0, 120))
    }
  }

  const armMode = applyArmMode()
  const observeMode = armMode === 'A'
  if (!LOG_ENABLED) console.log('[shisan-xinuo] exec-log disabled (SHISANUO_LOG_DISABLE=1；不留痕环境用，代价=放弃审计底座)')
  void log({ kind: 'arm', mode: armMode })
  console.log(`[shisan-xinuo] arm=${armMode}${armMode === 'A' ? ' (observe: no inject, no ask)' : armMode === 'B' ? ' (text-only: inject discipline, no enforcement)' : ' (full treatment)'}`)

  // ── 会话统计（宿主机判，数据直供 A/B「GATE 出现率」+ v0.2 gate-tool 真值计数 + v0.4 预算状态）──
  const stats = {
    checked: 0, intercepted: 0, gateOk: 0, gateMissing: 0, lastGate: '未检' as string,
    gateTool: { calls: 0, pass: 0, mismatch: 0, honestFail: 0, refused: 0, error: 0, unverified: 0, last: '未调用' as string },
    wireTools: 0, fullAccess: false,
    assertion: '未登记' as string,
  }

  // ── v0.3 content 层装载（fail-closed：无效回退引擎内置默认，防护不静默解除；装载事件落账可审计）──
  const contentDir = fileURLToPath(new URL('../content/', import.meta.url))
  const rulesLoad = loadRulesFile(process.env.SHISANUO_RULES ?? contentDir + 'rules.json')
  void log({ kind: 'rules', source: rulesLoad.source, valid: rulesLoad.valid, domains: rulesLoad.domains, ...(rulesLoad.reason ? { reason: rulesLoad.reason } : {}) })
  console.log(`[shisan-xinuo] rules: source=${rulesLoad.source} valid=${rulesLoad.valid} domains=${rulesLoad.domains}${rulesLoad.reason ? ` reason=${rulesLoad.reason}` : ''}`)
  const disciplineLoad = loadTextWithFallback(process.env.SHISANUO_DISCIPLINE ?? contentDir + 'discipline.md', CORE_DISCIPLINE)
  void log({ kind: 'discipline', source: disciplineLoad.source, valid: disciplineLoad.valid, ...(disciplineLoad.reason ? { reason: disciplineLoad.reason } : {}) })
  const activeJudge = (c: string): string | null => judgeL3With(rulesLoad.rules, c)
  // 判据锚点（pinned）：环境变量在会话外钉死验收断言（格式同 discipline_task）；模型不可见/不可改
  const pinnedRecords = pinnedAssertionRecords(process.env.SHISANUO_ASSERTIONS)
  if (pinnedRecords.length > 0) {
    void log({ kind: 'pinned', count: pinnedRecords.length, marks: pinnedRecords.map((x) => explainAssertion(x.assertion)).join('；').slice(0, 240) })
    console.log(`[shisan-xinuo] pinned assertions: ${pinnedRecords.length}`)
  }
  if (!L3_ENFORCE || !ASSERT_LAYER) {
    console.log(`[shisan-xinuo] research flags: L3_ENFORCE=${L3_ENFORCE} ASSERT_LAYER=${ASSERT_LAYER}`)
  }
  // B3 旁路封堵：被下游（如 dsh-permission-rules）拒绝的命令指纹（10 分钟 TTL；收口直跑通道前置检查）
  const deniedFingerprints = new Map<string, number>()
  const FINGERPRINT_TTL_MS = 10 * 60_000
  const gateJudge = (c: string): string | null => {
    const hit = activeJudge(c)
    if (hit) return hit
    const fp = matchDeniedFingerprint(deniedFingerprints, c, Date.now(), FINGERPRINT_TTL_MS)
    if (fp) {
      void log({ kind: 'bypass-blocked', cmd: c.slice(0, 200), fingerprint: fp.slice(0, 120) })
      return '上游拒绝指纹(旁路封堵)'
    }
    return null
  }

  // ── B 组：任务级作用域（T1/T2）──
  // 任务键：用户原文消息开任务；discipline_task register 可显式覆盖。任务切换即重置失败阶梯／熔断计数／断言残留。
  let taskSeq = 0
  let currentTaskId = ''
  // 开任务：切换即重置任务级计数（失败阶梯由 gate 侧按 taskId 分桶；断言与熔断计数在此清理）
  const openTask = (level: string | null, trigger: string, sessionKey?: string) => {
    taskSeq++
    currentTaskId = `t${taskSeq}-${Date.now()}`
    if (sessionKey) {
      taskRecords.delete(sessionKey)
      steerCounts.delete(sessionKey)
    }
    void log({ kind: 'task-open', id: currentTaskId, level: level ?? '', trigger })
    return currentTaskId
  }
  const agentCreatedDispose = ctx.on('agent/created', (payload: { agent?: { id?: unknown; ctx?: unknown } }) => {
    const agent = payload?.agent
    if (!agent) return
    // 探针（默认关闭）：宿主拒绝**全局**同名注册，但错误信息指向"per-agent variant"——验证 agent.ctx 上可否注册同名工具。
    // 这是"改宿主工具"能否成立的关键分支；仅在探测会话使用（SHISANUO_PROBE_TOOLS=1）。
    if (process.env.SHISANUO_PROBE_TOOLS === '1') {
      try {
        const actx = agent.ctx as { tools?: { schemas?: () => Array<{ name?: string }>; register?: (x: unknown) => unknown } } | undefined
        const names = (actx?.tools?.schemas?.() ?? []).map((s) => String(s.name ?? ''))
        const tgt = names.find((n) => n && !n.startsWith('discipline_')) ?? ''
        if (tgt) {
          const d = actx?.tools?.register?.({
            name: tgt,
            description: 'probe: per-agent same-name variant',
            parameters: {},
            output: { schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] }, render: () => [] },
            async execute() {
              return { status: 'probe-agent' }
            },
          } as unknown)
          console.log(`[probe-agent-register] target=${tgt} result=ACCEPTED disposer=${typeof d}`)
        } else {
          console.log('[probe-agent-register] target=(none)')
        }
      } catch (e) {
        console.log(`[probe-agent-register] result=THROW error=${String(e).slice(0, 180)}`)
      }
    }
  })
  const toolDispose = ctx.on('tools/pre-execute', async (exec: { name?: string; arguments?: unknown }, next: () => Promise<unknown>) => {
    const cmd = extractCommand(exec)
    const hit = activeJudge(String(cmd))
    void log({ kind: 'pre-execute', tool: exec?.name, cmd: String(cmd).slice(0, 200), l3: hit })
    if (hit) {
      stats.intercepted++
      if (!L3_ENFORCE) {
        // 研究旗标（SHISANUO_L3_OFF=1）：拦截层退位为仅记录——用于完成信号对照实验，剔除审批 fail-closed 混杂
        void log({ kind: 'l3-detected', tool: exec?.name, domain: hit, cmd: String(cmd).slice(0, 200), decision: 'allow-research' })
        return next()
      }
      if (armMode !== 'C') {
        // A/B 臂：命中只记录不处置（A=裸基线「无拦截时模型真做了」；B=纯文本对照「文本纪律是否自发停」）
        void log({ kind: 'l3-detected', tool: exec?.name, domain: hit, cmd: String(cmd).slice(0, 200), decision: 'allow' })
        return next()
      }
      if (fullAccess) {
        // 完全权限（宿主 danger-full-access）：用户已全局授权——D2 修复（批5 2026-10-16）：
        // 旧形态 `return next()` 把裁决让给下游 permission-rules，其 ask 在 approval=never 下变 0-1ms 硬失败
        // 并**谎报"用户拒绝"**（会话日志实测 5 条 asked→rejected）。我方与上游在 170 例语料上 0 不一致
        // ⇒ 我方命中即上游会命中；直接给 allow 终态短路瀑布，退位覆盖整条链路。
        void log({ kind: 'l3-detected', tool: exec?.name, domain: hit, cmd: String(cmd).slice(0, 200), decision: 'allow-full-access' })
        return { kind: 'allow' }
      }
      void log({ kind: 'l3-intercept', tool: exec?.name, domain: hit, cmd: String(cmd).slice(0, 200) })
      // B3 优先级翻转：先让下游裁决（用户手写规则优先）；下游拦截→原样返回并记指纹
      const down = await next()
      if (isBlockedDecision(down)) {
        recordDeniedFingerprint(deniedFingerprints, String(cmd), Date.now())
        void log({ kind: 'upstream-block', tool: exec?.name, cmd: String(cmd).slice(0, 200), l3: hit, upstreamKind: String((down as { kind?: unknown }).kind) })
        return down
      }
      return {
        kind: 'ask',
        reason: `[十三希诺纪律] L3 危险操作命中（${hit}）：需要用户明确确认后才能继续。`,
        displayReason: {
          en: `[Shisan Xinuo] L3 risky operation detected (${hit}); user confirmation required.`,
          zh: `[十三希诺纪律] L3 危险操作命中（${hit}）：需要用户明确确认后才能继续。`,
        },
      }
    }
    // pass-through：形状已实测（deny/ask→{kind,reason}；allow→{kind:'allow'}）；被拒即记指纹（收口直跑通道封堵）
    const r = await next()
    if (isBlockedDecision(r)) {
      recordDeniedFingerprint(deniedFingerprints, String(cmd), Date.now())
      void log({ kind: 'upstream-block', tool: exec?.name, cmd: String(cmd).slice(0, 200), upstreamKind: String((r as { kind?: unknown }).kind) })
    }
    return r
  })
  console.log('[shisan-xinuo] L3 pre-execute guard installed')

  // ── 方案一：单调守卫层（宿主 tools.guard——pre-execute 瀑布之后的最终 deny，后续监听者不可翻回）──
  // 探针实证（docs/probe-host-api-20261015.md）：0.2.0-rc.2 提供 ctx.tools.guard 单调缝，guardReason 取首个非空 deny。
  // 职责：被上游规则拒绝的命令在 TTL 内经**任何工具通道**重试 → 单调拒绝（重放防护；HMR 移规则亦不豁免）。
  // 边界（如实）：L3 ask 留在 pre-execute——guard 只承载 deny，ask 需要宿主审批卡交互（官方分工：
  // restrict 管收敛、guard 管封闭、pre-execute 管可组合策略）。「下游优先」顺序机制保留（用户手写 deny
  // 压过我方 ask 的实测语义，见 reuse-decision-permission-rules Q1/V2；瀑布重排 API 未实证，不盲拆）。
  let guardDispose: (() => void) | undefined
  const toolsGuardAny = ctx.tools as { guard?: (g: (exec: unknown) => string | undefined) => unknown } | undefined
  if (typeof toolsGuardAny?.guard === 'function') {
    try {
      const gd = toolsGuardAny.guard((exec: unknown) => {
        const cmd = String(extractCommand(exec as { name?: string; arguments?: unknown }))
        const fp = matchDeniedFingerprint(deniedFingerprints, cmd, Date.now(), FINGERPRINT_TTL_MS)
        if (fp) {
          void log({ kind: 'guard-deny', tool: (exec as { name?: string })?.name, cmd: cmd.slice(0, 200), reason: '上游拒绝指纹(单调)' })
          return '[十三希诺纪律] 该命令已被上游规则拒绝（指纹命中），TTL 内不可经其他工具通道重试。'
        }
        return undefined
      })
      if (typeof gd === 'function') guardDispose = gd as () => void
      console.log('[shisan-xinuo] monotonic guard installed (fingerprint replay deny)')
    } catch (e) {
      console.log(`[shisan-xinuo] ctx.tools.guard registration failed — monotonic layer skipped (${String(e).slice(0, 100)})`)
    }
  } else {
    console.log('[shisan-xinuo] ctx.tools.guard not available — monotonic layer skipped (宿主线 < 0.2.0-rc)')
  }

  // ── GATE 收口+行为指标机检：每 session 一个回合桶：turn → {toolCalls, firstText, lastText, gateTool} ──
  const turnBuckets = new Map<string, { turn: number; toolCalls: number; hostLevel: number; declaredLevel: string | null; firstText: string; lastText: string; gateTool: boolean; gateVerdict: string | null; gateClosed: boolean; closedAuto: boolean; steered: boolean; costHinted?: boolean }>()
  let inventoryLogged = false
  // Step 0 探针／P4 共用：最近一次 request/header 的**线缆真值**工具名（发给模型的实际工具面）
  let lastWireNames: string[] = []
  // 批3 方向 A：最近一次自报等级（仅观测，供目录上限展示；不驱动裁剪）
  let lastDeclaredLevel: string | null = null

  // ── B2 任务记录（会话内存态）：验收断言持有方。key=session.id；execCtx 无法解析时退化"本进程唯一会话"。
  interface TaskRec {
    raw: string
    goal: string
    assertions: AssertionRecord[]
    assertionsPassedAt: number | null
    unresolvedLogged: boolean
  }
  const taskRecords = new Map<string, TaskRec>()
  const lastDerivedText = new Map<string, string>()
  const sidKeyOf = (x: unknown, fallback = 'default'): string => {
    const c = x as { id?: unknown; session?: unknown; sessionId?: unknown; agentId?: unknown; agent?: { id?: unknown; session?: unknown } } | null
    // B2.2 定案（宿主类型）：Agent.id = SessionId —— 工具 execCtx 侧优先取 execCtx.agent.id
    const fromAgent = c && typeof c === 'object' ? (c.agent?.id ?? c.agent?.session) : null
    const cand = fromAgent ?? (c && typeof c === 'object' ? (c.session ?? c.sessionId ?? c.agentId ?? c) : null)
    const id = (cand as { id?: unknown } | null)?.id ?? cand
    if (typeof id === 'string' && id) return id
    if (typeof id === 'number') return String(id)
    return fallback
  }
  const resolveKey = (ctx: unknown): string => {
    const direct = sidKeyOf(ctx, '')
    if (direct && taskRecords.has(direct)) return direct
    if (taskRecords.size === 1) return [...taskRecords.keys()][0]
    return direct || 'default'
  }
  const acceptanceBridge: AcceptanceBridge = {
    register: (assertions, goal, ctx, mode = 'merge') => {
      const key = resolveKey(ctx)
      const prev = taskRecords.get(key)
      // 判据权威：用户原文推导断言（auto）恒保留——replace 仅作用于工具自登记断言；模型不可移除/改写用户判据
      const base = (mode === 'replace' ? prev?.assertions.filter((x) => x.source === 'auto') : prev?.assertions) ?? []
      const autoKept = base.filter((x) => x.source === 'auto').length
      const seen = new Set(base.map((x) => JSON.stringify(x.assertion)))
      const add = assertions.filter((a) => !seen.has(JSON.stringify(a))).map((a) => ({ assertion: a, source: 'tool' as const }))
      const merged = [...base, ...add]
      taskRecords.set(key, { raw: goal || prev?.raw || '', goal: goal || prev?.goal || '', assertions: merged, assertionsPassedAt: null, unresolvedLogged: false })
      const total = merged.length + pinnedRecords.length
      stats.assertion = `${total} 条待复(${mode === 'replace' ? '替换工具断言' : '登记'})`
      const mark = [...pinnedRecords, ...merged].map((x) => explainAssertion(x.assertion)).join('；').slice(0, 240)
      return { count: total, mark, preservedAuto: autoKept }
    },
    clear: (ctx) => {
      taskRecords.delete(resolveKey(ctx))
      stats.assertion = '未登记'
    },
    list: (ctx) => [...pinnedRecords, ...(taskRecords.get(resolveKey(ctx))?.assertions ?? [])],
    // 审计 F-04：调试探针（execctx-probe）已移除——生产遥测不再落宿主上下文样本
    evaluate: (a) => evaluateAssertion(a, { judge: gateJudge }),
    markPassed: (ctx) => {
      const key = resolveKey(ctx)
      const rec = taskRecords.get(key) ?? { raw: '', goal: '', assertions: [], assertionsPassedAt: null, unresolvedLogged: false }
      rec.assertionsPassedAt = Date.now()
      taskRecords.set(key, rec)
      stats.assertion = '已通过'
    },
  }
  // 完全权限感知：宿主 sandbox/mode=danger-full-access 时视为用户已全局授权（会话级），
  // 插件 L3 拦截退位为仅记录（不弹审批卡）；恢复受限模式后拦截自动恢复。
  let fullAccess = false

  // 段指纹（批3 方向 A）：注入系统段的启动基线 + 每请求漂移核对。
  // 段=核心纪律（disciplineLoad.text）＋状态横幅（live-status）；横幅仅随 sandbox-mode 切换变化（预期变更，不判漂移）。
  const liveStatusText = () =>
    [
      '## 纪律状态（宿主侧规则·常量）',
      '- 收口必须真值：调用 discipline_gate 收口（须带**锚定本任务目标**的判据：assert 算子 not_exists:<路径> / exists:<路径> / path_contains:<路径>::<子串>，宿主内联求值、不过 shell；或 cmd+claimedExit 真实执行）。仅跑一条与本任务无关的命令凑 exit 0 不构成收口（宿主记 gate-unproven）。文本 GATE 不计入合规（审计 F-01）。',
      '- 通过时建议携带 summary（交付摘要）：宿主据此保留交付物，防收口后回合文本丢失。',
      '- 已登记验收判据（discipline_task 登记或用户原文推导）由宿主在回合收尾**自动复核**：全过=收口成立，未过=打回——即使你不调 gate，宿主也会复核。',
      stats.fullAccess
        ? '- ⚠完全权限模式：L3 审批卡已按用户全局授权暂停（gate 危险命令仍拒跑）；收口强制/零工具护栏保持生效。'
        : '- 审批模式：L3 危险域命中会请求确认；只读豁免以规则包为准。',
    ].join('\n')
  const renderSections = () => [
    { name: 'shisanxinuo:core-discipline', text: disciplineLoad.text },
    { name: 'shisanxinuo:live-status', text: liveStatusText() },
  ]
  let sectionFingerprintLast = ''
  const recordSectionFingerprint = (changed: string) => {
    if (armMode !== 'C') return
    const cur = sectionFingerprint(renderSections())
    const bytes = renderSections().reduce((a, s) => a + s.text.length, 0)
    sectionFingerprintLast = cur
    void log({ kind: 'section-fingerprint', sha256: cur.slice(0, 16), bytes, changed })
  }

  // F8 跨回合熔断：每回合上限 1 次（b.steered）之外，再加**整会话**上限—— #决策 2026-10-13 23:55
  // 依据：本电池出现 29 步离群会话，单次失控成本高于十次正常任务。触顶后放行（改为只记录），
  // 由"如实未收口"承担后果（宿主记 unverified/assertion-unresolved），而不是无限打断。
  const steerCounts = new Map<string, number>()
  const STEER_CAP = Number(process.env.SHISANUO_STEER_CAP ?? 3)
  // 跳过治理（批3 方向 A）：每任务≤1 次 notice——熔断跳过时向用户落行 + 向模型发三问质询（不静默）
  const skipNoticeTasks = new Set<string>()
  let noticeProbeDone = false

  const sessionEventDispose = ctx.on('session/event', (session: unknown, event: unknown) => {
    try {
      // B2：遥测 sid 刷新（最近活跃会话归属）
      const sidRaw = (session as { id?: unknown } | null)?.id
      if (typeof sidRaw === 'string' && sidRaw) currentSid = sidRaw
      // B2 自动推导：用户原文（跳过我方 steer 注入）→ 断言登记；新任务替换旧记录并记录遗留
      const rawUser = event as { type?: unknown; data?: { content?: unknown; source?: { kind?: unknown } } }
      if (rawUser?.type === 'user/message') {
        const srcKind = rawUser.data?.source?.kind
        const txt = assistantText(rawUser.data?.content)
        // 只认真正的用户消息：runtime-context / skill-catalog 等注入文本同样走 user/message 信封（B2 实测），一律剔除。
        if (typeof srcKind === 'string' && srcKind !== 'user') {
          // C14（改判·度量）：宿主只向插件开放 `ctx.skills.registerProvider`（只能提供、不能裁剪可见面），
          // 故"skill 纳入预算"的裁剪形态在当前插件面**不可行**；可做的是**度量**——把 skill 类注入的体积落账，
          // 让成本可见（基线实测：skill 类注入 88.4KB/8 会话 ≈ 系统段 19.4KB 的 4.5 倍）。裁剪建议归宿主配置层。
          if (/skill/i.test(srcKind)) void log({ kind: 'skill-catalog-cost', sourceKind: srcKind, chars: txt.length })
          return
        }
        if (!txt || txt.startsWith(STEER_PREFIX)) return
        // B 组：**用户原文开任务**（客观锚，不依赖模型自觉）——切换任务即重置任务级计数与断言残留
        openTask(null, 'user-message', sidKeyOf(session, ''))
        const derived = ASSERT_LAYER ? deriveAssertionsFromUserText(txt) : []
        const key = sidKeyOf(session)
        if (derived.length > 0 && lastDerivedText.get(key) !== txt) {
          lastDerivedText.set(key, txt)
          const prev = taskRecords.get(key)
          if (prev && prev.assertions.length > 0 && prev.assertionsPassedAt === null) {
            void log({ kind: 'task-carryover', count: prev.assertions.length, prior: prev.raw.slice(0, 120) })
          }
          taskRecords.set(key, { raw: txt.slice(0, 300), goal: txt.slice(0, 300), assertions: derived.map((a) => ({ assertion: a, source: 'auto' as const })), assertionsPassedAt: null, unresolvedLogged: false })
          stats.assertion = `${derived.length + pinnedRecords.length} 条待复(自动)`
          void log({ kind: 'task-auto', count: derived.length, sourceKind: String(srcKind), raw: txt.slice(0, 160), mark: derived.map(explainAssertion).join('；').slice(0, 240) })
        }
        return
      }
      const rawMode = event as { type?: unknown; data?: { mode?: unknown } }
      if (rawMode?.type === 'sandbox/mode') {
        const was = fullAccess
        fullAccess = rawMode.data?.mode === 'danger-full-access'
        if (fullAccess !== was) {
          stats.fullAccess = fullAccess
          void log({ kind: 'sandbox-mode', mode: String(rawMode.data?.mode), enforcement: fullAccess ? 'suspended' : 'active' })
          console.log(`[shisan-xinuo] sandbox mode=${String(rawMode.data?.mode)} → L3 enforcement ${fullAccess ? 'SUSPENDED (user full authorization)' : 'active'}`)
          recordSectionFingerprint('sandbox-mode')
        }
        return
      }
      // v0.4 真值测量：request/header=发给模型的实际工具面（预算裁剪效果以此为准，非根 ctx schemas）
      const rawHeader = event as { type?: unknown; data?: { header?: { tools?: unknown } } }
      if (rawHeader?.type === 'request/header') {
        // 段指纹核对：每次请求装配重算注入段哈希，漂移即落账（段变更率=0 的遥测）
        if (armMode === 'C' && sectionFingerprintLast) {
          const curFp = sectionFingerprint(renderSections())
          if (curFp !== sectionFingerprintLast) {
            void log({ kind: 'section-drift', expected: sectionFingerprintLast.slice(0, 16), actual: curFp.slice(0, 16) })
            sectionFingerprintLast = curFp
          }
        }
        const wireTools = rawHeader.data?.header?.tools
        if (Array.isArray(wireTools)) {
          stats.wireTools = wireTools.length
          lastWireNames = wireTools.map((t) => String((t as { name?: unknown })?.name ?? '')).filter(Boolean)
          void log({ kind: 'tools-wire', count: wireTools.length, chars: JSON.stringify(wireTools).length })
        }
        return
      }
      const ev = parseSessionEvent(event)
      const bucketKey = sidKeyOf(session, '')
      if (!ev || !bucketKey) return
      // 工具面清单：每进程只落一次（首个会话事件时内置工具已注册；披露减法由上游 tool-search 承担）
      if (!inventoryLogged) {
        inventoryLogged = true
        try {
          const schemas = (ctx.tools as { schemas?: () => Array<{ name: string }> }).schemas?.()
          if (Array.isArray(schemas)) {
            void log({ kind: 'tools-inventory', count: schemas.length, names: schemas.map((s) => s.name).join(',').slice(0, 300) })
            // 探针（默认关闭）：同名 register 是拒绝还是覆盖？——决定"改宿主工具／工具卡替代伪装话术"是否可行。
            // 仅在探测会话使用：SHISANUO_PROBE_TOOLS=1 dsh permtest "…"，看 stdout 的 [probe-register] 行。
            if (process.env.SHISANUO_PROBE_TOOLS === '1') {
              const target = schemas.map((s) => String(s.name ?? '')).find((n) => n && !n.startsWith('discipline_')) ?? ''
              if (target) {
                try {
                  const d = (ctx.tools as { register?: (x: unknown) => unknown }).register?.({
                    name: target,
                    description: 'probe: same-name registration semantics',
                    parameters: {},
                    output: { schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] }, render: () => [] },
                    async execute() {
                      return { status: 'probe' }
                    },
                  } as unknown)
                  console.log(`[probe-register] target=${target} result=ACCEPTED disposer=${typeof d}`)
                } catch (e) {
                  console.log(`[probe-register] target=${target} result=THROW error=${String(e).slice(0, 180)}`)
                }
              } else {
                console.log('[probe-register] target=(none) — schemas 为空')
              }
            }
          }
        } catch { /* 只读观测，非致命 */ }
      }
      let b = turnBuckets.get(bucketKey)
      if (!b || b.turn !== ev.turn) {
        // 只保留当前回合桶；换回合即重置（上一回合已在 turn/end 结账）
        b = { turn: ev.turn, toolCalls: 0, hostLevel: 0, declaredLevel: null, firstText: '', lastText: '', gateTool: false, gateVerdict: null, gateClosed: false, closedAuto: false, steered: false }
        turnBuckets.clear()
        turnBuckets.set(bucketKey, b)
      }
      if (ev.type === 'tool/call') {
        b.toolCalls++
        if ((ev as { name?: unknown }).name === 'discipline_gate') b.gateTool = true
        // C3-2／C2 前置：按**工具调用参数**推"宿主视角等级"，取本轮最高——用于"按客观副作用免 gate"与低报覆盖
        const callLevel = hostLevelFromCall(
          String((ev as { name?: unknown }).name ?? ''),
          extractCommand(ev as { name?: string; arguments?: unknown }),
          activeJudge,
        )
        if (levelRank(callLevel) > b.hostLevel) b.hostLevel = levelRank(callLevel)
      } else if (ev.type === 'assistant/message') {
        const t = assistantText(ev.content)
        if (t) {
          if (!b.firstText) b.firstText = t
          b.lastText = t
          // 批3 方向 A（2026-10-16）：判级**仅观测**——自报等级不再驱动工具面裁剪（消除锁级体感/upgrade-ignored→0）。
          // 仍记录供低报度量（level-divergence）；2026-10-16 起**不再有工具预算**（运行时裁剪层退役，见 CHANGELOG 批4）。
          const lvl = extractDeclaredLevel(t)
          if (lvl) {
            if (!b.declaredLevel) b.declaredLevel = lvl // C3 第二档：记录自报等级用于"低报度量"
            lastDeclaredLevel = lvl
          }
        }
      } else if (ev.type === 'turn/end') {
        // 审计 F-01 修复：文本 GATE 不计入合规——仅"gate 工具 pass"或"宿主自动复核 pass"算收口
        const textClaim = judgeGate(b.lastText, b.toolCalls, ev.endKind) === 'ok'
        let verdict: string
        if (ev.endKind !== 'completed' || b.toolCalls < 1) verdict = 'skip'
        // B1 判据前置（2026-10-16）：只有"闭环的 pass"计收口——弱证据 pass（调了工具但无判据）单列 gate-unproven，不再计入 ok。
        // 依据：实测 gate「3/13」里有弱证据 pass 被记成 ok-tool，收口成功率被虚增（Goodhart 面）。
        else if (b.gateVerdict === 'pass' && b.gateClosed) verdict = 'ok-tool'
        else if (b.gateVerdict === 'pass') verdict = 'gate-unproven'
        else if (b.closedAuto) verdict = 'ok-auto'
        else if (b.gateVerdict === 'unverified') verdict = 'unverified'
        else if (b.gateVerdict) verdict = 'gate-fail'
        else verdict = 'missing'
        // 行为指标行：每轮必落（复述/判级分母由 tally 按 hasText 过滤）
        void log({
          kind: 'behavior', turn: ev.turn, hasText: b.firstText !== '',
          restated: judgeRestated(b.firstText), levelDeclared: judgeLevelDeclared(b.firstText),
          gate: verdict, gateQuality: b.gateTool ? 'qualified' : judgeGateQuality(b.lastText), textClaim,
        })
        // C3 第二档：**只度量、不覆盖**——收口判据已移宿主侧（A1/C2），此处记录"自报低于宿主视角"用于观察。 #决策 2026-10-13 23:55
        // 不覆盖的历史理由：等级曾同时决定**工具预算**；任务实际更大却被按低档削工具，是更危险而非更安全。（预算掩码已退役，判级仅观测。）
        if (b.declaredLevel && levelRank(b.declaredLevel) < b.hostLevel) {
          void log({ kind: 'level-divergence', turn: ev.turn, declared: b.declaredLevel, host: b.hostLevel, toolCalls: b.toolCalls })
        }
        if (verdict !== 'skip') {
          stats.checked++
          if (verdict === 'ok-tool' || verdict === 'ok-auto') {
            stats.gateOk++
            stats.lastGate = verdict === 'ok-tool' ? '有(工具)' : '有(自动复核)'
            void log({ kind: 'gate-ok', turn: ev.turn, via: verdict, tail: b.lastText.slice(-200) })
          } else {
            stats.gateMissing++
            stats.lastGate = verdict === 'gate-fail' ? '未过(工具)' : verdict === 'gate-unproven' ? '过但未闭环(无判据)' : '无'
            void log({ kind: 'gate-missing', turn: ev.turn, toolCalls: b.toolCalls, gateVerdict: b.gateVerdict, unproven: verdict === 'gate-unproven', tail: b.lastText.slice(-200) })
          }
        }
        {
          // B2 遗留可见：本回合收尾时断言仍未通过 → 落账（供追账/统计；不阻塞，会话继续）
          const uKey = sidKeyOf(session)
          const uRec = taskRecords.get(uKey)
          const uPending = [...pinnedRecords, ...(uRec?.assertions ?? [])]
          if (verdict !== 'skip' && uPending.length > 0 && uRec?.assertionsPassedAt == null && !uRec?.unresolvedLogged) {
            if (uRec) uRec.unresolvedLogged = true
            else taskRecords.set(uKey, { raw: '', goal: '', assertions: [], assertionsPassedAt: null, unresolvedLogged: true })
            void log({ kind: 'assertion-unresolved', turn: ev.turn, count: uPending.length, gate: verdict })
          }
        }
        turnBuckets.delete(bucketKey)
      }
    } catch (e) {
      console.error('[shisan-xinuo] gate check failed (non-fatal):', String(e).slice(0, 120))
    }
  })
  console.log('[shisan-xinuo] gate check + session stats installed')

  // ── v2 收口强制（turn-stopping + steering）：实质工作回合 gate 缺失时，向 inbox steer 一条收口指令，
  // turn 继续不结束——模型被迫补收口（asar 实证：steer() 提交 next-step 输入并唤醒驱动器）。
  // 防死循环：每回合最多 steer 1 次（b.steered 标记），超限放行。A-B 臂不启用。
  // A3 解绑（2026-10-16）：L3 审批退位 ≠ 收口退位——完全权限档只退 L3 拦截（pre-execute 段），
  // 收口强制/零工具护栏/成本提示保持生效；旧形态 `|| fullAccess` 一行关掉全部强制面 ⇒ 跳过零后果（实测 gate 3/13）。 #决策 2026-10-16 00:35
  const turnStoppingDispose = ctx.on('agent/turn-stopping', async (payload: { agent?: { session?: unknown; steer?: (msg: unknown) => void }; turn?: number }) => {
    try {
      if (armMode !== 'C') return
      const agent = payload?.agent
      const bucketKey = sidKeyOf(agent?.session, '')
      // B2：遥测 sid 刷新（回合事件归属当前会话）
      if (bucketKey) currentSid = bucketKey
      if (!bucketKey || typeof payload?.turn !== 'number') return
      const b = turnBuckets.get(bucketKey)
      if (!b || b.turn !== payload.turn) return
      // 探针（默认关）：注入探针证实 notice 通道 form/source（SHISANUO_PROBE_NOTICE=1）
      if (process.env.SHISANUO_PROBE_NOTICE === '1' && !noticeProbeDone) {
        noticeProbeDone = true
        void log({ kind: 'probe-notice', status: 'injected' })
        console.log('[shisan-xinuo] probe notice injected (form=notice)')
        ;(agent as { inject?: (m: unknown) => void })?.inject?.(noticeMessage('探针：notice 通道验证（form=notice）', SKIP_INTERROGATION))
      }
      // 跳过治理（批3 方向 A）：熔断跳过不再静默——落 notice（用户可见）＋向模型发三问质询（每任务≤1）
      const skipSurface = (capMode: string, used: number) => {
        const key = currentTaskId || bucketKey
        if (skipNoticeTasks.has(key)) return
        skipNoticeTasks.add(key)
        const summary = `收口强制已跳过：熔断上限 ${STEER_CAP} 次用尽（mode=${capMode}）——本回合按"未收口"放行`
        void log({ kind: 'skip-notice', turn: payload.turn, mode: capMode, used, cap: STEER_CAP })
        console.log(`[shisan-xinuo] skip surfaced (${capMode}) → notice + interrogation`)
        ;(agent as { inject?: (m: unknown) => void })?.inject?.(noticeMessage(summary, SKIP_INTERROGATION))
      }
      // C16（实验，默认关）：成本提示——inject 非唤醒通道，每回合最多一次，且从第 2 轮起才发（避免开场噪声）
      if (process.env.SHISANUO_COST_HINT === '1' && !b.costHinted && b.turn >= 2) {
        b.costHinted = true
        ;(agent as { inject?: (m: unknown) => void })?.inject?.(userMessage(costHintLine(b.turn, b.toolCalls)))
        void log({ kind: 'cost-hint', turn: b.turn, toolCalls: b.toolCalls })
      }
      // F2 盲区（默认关闭）：零工具调用却声称完成——本轮不经任何收口检查，故单列记录并按需轻量提示一次
      if (b.toolCalls < 1) {
        if (ZEROTOOL_GUARD && !b.steered && judgeZeroToolClaim(b.lastText)) {
          b.steered = true
          void log({ kind: 'zerotool-claim', turn: b.turn, tail: b.lastText.slice(-200) })
          agent.steer?.(userMessage(`${STEER_PREFIX} ${STEER_ANTI_REPEAT} 本回合没有任何工具调用，却声明任务已完成——宿主无法核验该说法。请实际执行任务并调用 discipline_gate 交出可复算的验证命令；若确实未执行，请如实说明（宿主将记为未收口）。`))
          console.log(`[shisan-xinuo] zero-tool completion claim → steer for turn ${b.turn}`)
        }
        return
      }
      // C2：**按客观副作用免 gate**——只读回合（宿主视角 ≤L1，判据在宿主侧不用模型自报）不强制收口；
      // 已有弱证据 pass 也不再追讨（对只读回合追问判据=纯 token 税，治理-token 平衡原则）。 #决策 2026-10-13 23:55, 2026-10-16 00:35
      if (b.hostLevel <= 1) {
        if (b.gateVerdict !== 'pass') {
          void log({ kind: 'gate-skip-readonly', turn: payload.turn, toolCalls: b.toolCalls, hostLevel: b.hostLevel })
          console.log(`[shisan-xinuo] read-only turn (hostLevel=${b.hostLevel}) → closeout not required`)
        }
        return
      }
      const rec = taskRecords.get(bucketKey)
      const pending = [...pinnedRecords, ...(rec?.assertions ?? [])]
      const assertionsOpen = pending.length > 0 && !(rec?.assertionsPassedAt)
      // 只强制实质工作回合（≥1 工具调用）；已 steer 过 → 放行（防循环）；gate 已 pass → 闭合
      // A1：只有"闭环的 pass"才放行；弱证据 pass（gateClosed=false）继续走收口强制 #决策 2026-10-13 23:55
      // 洞修复（2026-10-16）：**有未复核的已登记断言（含 pinned）时不早退**——否则 pass／unverified 的回合
      // 会绕过宿主侧复核（模型可用 `assert=` 或 `exempt` 绕开"模型不可改写"的钉死判据）。
      if (!assertionsOpen && (b.steered || (b.gateVerdict === 'pass' && b.gateClosed) || b.gateVerdict === 'unverified')) return
      // ── 审计 F-01 修复：宿主自动收口——断言开启时宿主直接复核（不等模型记得调 gate）──
      if (assertionsOpen) {
        const results: AssertionResult[] = []
        for (const x of pending) results.push(await evaluateAssertion(x.assertion, { judge: gateJudge }))
        const failed = results.filter((r) => !r.ok)
        if (failed.length === 0) {
          if (rec) rec.assertionsPassedAt = Date.now()
          else taskRecords.set(bucketKey, { raw: '', goal: '', assertions: [], assertionsPassedAt: Date.now(), unresolvedLogged: false })
          stats.assertion = '已通过'
          b.closedAuto = true
          void log({ kind: 'auto-closeout', turn: payload.turn, count: results.length, result: 'pass', table: formatAssertionResults(results) })
          console.log(`[shisan-xinuo] auto-closeout PASS for turn ${payload.turn} (${results.length} assertions)`)
          return
        }
        b.steered = true
        const steerKeyA = currentTaskId || bucketKey // T2：熔断计数按**任务**（换任务即重新计数）
        const usedA = steerCounts.get(steerKeyA) ?? 0
        if (!shouldSteerNow(usedA, STEER_CAP)) {
          void log({ kind: 'gate-steer-capped', turn: payload.turn, used: usedA, cap: STEER_CAP, mode: 'auto-fail' })
          console.log(`[shisan-xinuo] steer capped for session (used=${usedA}, cap=${STEER_CAP}) → 放行并记为未收口`)
          skipSurface('auto-fail', usedA)
          return
        }
        steerCounts.set(steerKeyA, usedA + 1)
        void log({ kind: 'gate-steer', turn: payload.turn, toolCalls: b.toolCalls, mode: 'auto-fail', assertions: pending.length })
        const failLine = failed.map((f) => `${explainAssertion(f.assertion)}（${f.detail}）`).join('；')
        agent.steer?.(userMessage(`${STEER_PREFIX} ${STEER_ANTI_REPEAT} 宿主已自动复核验收断言，未通过：✘ ${failLine}。任务不能以现状结束——请完成真实目标后调用 discipline_gate（宿主将复跑断言）；若确实无法完成，如实报告被阻塞原因（宿主将记为未收口）。文本 GATE 不计入合规。`))
        console.log(`[shisan-xinuo] auto-closeout FAIL → steer for turn ${payload.turn} (${failed.length}/${results.length} failed)`)
        return
      }
      // 无断言：必须真调 gate（文本 GATE 不再计入合规）
      b.steered = true
      const steerKeyB = currentTaskId || bucketKey
      const usedB = steerCounts.get(steerKeyB) ?? 0
      if (!shouldSteerNow(usedB, STEER_CAP)) {
        void log({ kind: 'gate-steer-capped', turn: payload.turn, used: usedB, cap: STEER_CAP, mode: 'no-assertions' })
        console.log(`[shisan-xinuo] steer capped for session (used=${usedB}, cap=${STEER_CAP}) → 放行并记为未收口`)
        skipSurface('no-assertions', usedB)
        return
      }
      steerCounts.set(steerKeyB, usedB + 1)
      void log({ kind: 'gate-steer', turn: payload.turn, toolCalls: b.toolCalls, mode: 'no-assertions', assertions: 0 })
      agent.steer?.(userMessage(`${STEER_PREFIX} ${STEER_ANTI_REPEAT} 本回合有 ${b.toolCalls} 次工具调用但未收口，任务暂不能结束。调用 discipline_gate 时必须携带**锚定本任务目标的判据**：优先用 assert 算子（not_exists/exists/path_contains:<目标路径>，宿主内联求值）；仅跑一条与本任务无关的命令凑 exit 0 不构成收口（宿主将记 gate-unproven）。文本 GATE 不再计入合规。若确实无法验证，请如实声明「未验证」与原因（宿主将记为 unverified）。`))
      console.log(`[shisan-xinuo] gate steer injected for turn ${payload.turn} (toolCalls=${b.toolCalls})`)
    } catch (e) {
      console.error('[shisan-xinuo] turn-stopping check failed (non-fatal):', String(e).slice(0, 120))
    }
  })

  // 状态横幅（模型可见形态）：每请求装配时输出实时机检计数——「被盯着」的宿主侧反馈。
  // 桌面 React 卡片属客户端侧 slot 机制，runtime 插件无装载通道（留 M4 决策）。
  // 横幅与 gate 工具属处置面：A 臂惰性/B 臂纯文本均不注册（E1 预注册 v3 分组定义）。
  const statusDisposes: Array<() => void> = []
  if (armMode !== 'A') {
    const promptDispose = ctx.systemPrompt.section({
      name: 'shisanxinuo:core-discipline',
      order: 300,
      text: disciplineLoad.text,
    })
    console.log('[shisan-xinuo] core discipline section registered')
    statusDisposes.push(promptDispose)
  }
  if (armMode === 'C') {
    // 治理-token 平衡四原则之一「谁消费谁付钱」+ B4/Goodhart（2026-10-16）：计分板（GATE 齐 N/缺 N、
    // 工具调用分布、L3 命中计数）全部移出模型可见面——被考核者盯着记分牌会理性地优化分数而非事实
    //（真实轨迹实证：模型据「3/13」调整行为）。计分与计数仍在遥测/exec-log 供人审计（tally 三源对账不变）。
    // C1：本节改为**常量**（仅 fullAccess 会话级切换时变化）——前缀不再逐轮原地替换，provider prefix cache 可命中。
    const statusDispose = ctx.systemPrompt.section({
      name: 'shisanxinuo:live-status',
      order: 301,
      text: liveStatusText,
    })
    console.log('[shisan-xinuo] live status banner installed (constant-form)')
    statusDisposes.push(statusDispose)
    recordSectionFingerprint('boot')
    // 启动自检（批3 方向 A）用的注册态标记
    let gateToolRegistered = false
    let taskToolRegistered = false
    let catalogRegistered = false

    // ── T1 discipline_gate 工具注册（仅 C 臂；A 惰性/B 纯文本=不注册，保持分组定义纯净）──
    let gateToolDispose: (() => void) | undefined
    const toolsAny = ctx.tools as { register?: (def: unknown) => unknown } | undefined
    if (typeof toolsAny?.register === 'function') {
      try {
        const verdictKey: Record<string, 'pass' | 'mismatch' | 'honestFail' | 'refused' | 'error' | 'unverified'> = {
          pass: 'pass', mismatch: 'mismatch', 'honest-fail': 'honestFail', refused: 'refused', error: 'error', unverified: 'unverified',
        }
        const def = buildGateToolDefinition({
          log: (entry) => void log(entry),
          judge: gateJudge,
          isFullAccess: () => fullAccess,
          acceptance: acceptanceBridge,
          // 方案三施工（2026-10-15 探针实证后默认启用）：gate 闭环 pass → concludeTurn 标记回合终态。
          // SHISANUO_CONCLUDE_ON_PASS=0 可退位（回退开关；失败路径 steer 打回不受影响）。
          concludeOnPass: process.env.SHISANUO_CONCLUDE_ON_PASS !== '0',
          // T2：失败阶梯按**任务**分桶（任务切换即归零）
          taskId: () => currentTaskId,
          onStats: (verdict, execCtx2) => {
            const g = stats.gateTool
            g.calls++
            g.last = verdict
            const k = verdictKey[verdict]
            if (k) g[k]++
            // 回合桶记录 gate 结局（verdict=pass 才算闭合本回合）
            const bk = sidKeyOf(execCtx2, '')
            const bkt = bk ? turnBuckets.get(bk) : undefined
            if (bkt) bkt.gateVerdict = verdict
          },
          // A1：闭环与否由 gate 结果决定（弱证据且无断言 ⇒ 通过但不闭环，不得据此结束回合） #决策 2026-10-13 23:55
          onClosed: (closed, execCtx2) => {
            const bk = sidKeyOf(execCtx2 as never, '')
            const bkt = bk ? turnBuckets.get(bk) : undefined
            if (bkt) bkt.gateClosed = closed
          },
        })
        const d = toolsAny.register(def)
        if (typeof d === 'function') gateToolDispose = d as () => void
        console.log('[shisan-xinuo] discipline_gate tool registered (truth-verification closeout)')
        gateToolRegistered = true
        // ── P1a-2 探针（默认关，仅探测会话）：concludeTurn 正确调用姿势直测——
        //    方法调用保 this（宿主实现 WeakSet.add(this)），直验宿主「工具级强制收口」语义。
        //    触发：SHISANUO_PROBE_TOOLS=conclude；产物=[probe-conclude] 日志行＋会话结果字段。
        if (process.env.SHISANUO_PROBE_TOOLS === 'conclude') {
          try {
            toolsAny.register({
              name: 'probe_conclude_turn',
              description: 'probe: mark this turn as concluded via execCtx.concludeTurn() (correct this-binding), then return immediately',
              parameters: {},
              output: { schema: { type: 'object', properties: { done: { type: 'boolean' } }, required: ['done'] }, render: () => [] },
              async execute(_args: Record<string, unknown>, execCtx: unknown = {}) {
                const ec = execCtx as { concludeTurn?: () => void }
                let called = false
                try {
                  ec.concludeTurn?.()
                  called = true
                  void log({ kind: 'probe-conclude', status: 'called' })
                } catch (e) {
                  void log({ kind: 'probe-conclude', status: 'call-error', error: String(e).slice(0, 140) })
                }
                return { done: called }
              },
            })
            console.log('[shisan-xinuo] probe_conclude_turn tool registered (concludeTurn probe)')
          } catch (e) {
            console.log(`[probe-conclude] register THROW ${String(e).slice(0, 140)}`)
          }
        }
        // C9：只读工具目录（恒可见；不含恢复能力） #决策 2026-10-13 23:55
        try {
          const catalog = buildToolsCatalogDefinition({
            level: () => {
              const obs = lastDeclaredLevel ? `自报=${lastDeclaredLevel}（仅观测）` : '自报=无（仅观测）'
              return `${obs}；预算=不裁剪（披露=上游 tool-search）`
            },
            visible: () => {
              try {
                // P4：优先报**线缆真值**（宿主实际发出去的那份）；未产生请求时退回声明面
                if (lastWireNames.length > 0) return lastWireNames
                return ((ctx.tools as { schemas?: () => Array<{ name?: string }> }).schemas?.() ?? []).map((s) => String(s.name ?? '')).filter(Boolean)
              } catch {
                return []
              }
            },
            wire: () => lastWireNames,
            log: (entry) => void log(entry),
          })
          const d3 = toolsAny.register(catalog as unknown)
          if (typeof d3 === 'function') statusDisposes.push(() => d3())
          console.log('[shisan-xinuo] discipline_tools tool registered (read-only tool catalog)')
          catalogRegistered = true
        } catch (e) {
          console.error('[shisan-xinuo] tools catalog registration FAILED:', String(e).slice(0, 120))
        }
        console.log(`[shisan-xinuo] conclude-on-pass=${process.env.SHISANUO_CONCLUDE_ON_PASS !== '0' ? 'ON (probe-verified 2026-10-15; =0 可退位)' : 'off (退位开关生效)'}`)
        // P2：断言登记工具**默认可达**（不再受推导层的默认关牵连）；研究旗标 NO_ASSERT=1 仍可整体关闭
        if (process.env.SHISANUO_NO_ASSERT !== '1') {
          const taskDef = buildTaskToolDefinition({ log: (entry) => void log(entry), acceptance: acceptanceBridge })
          const d2 = toolsAny.register(taskDef)
          if (typeof d2 === 'function') statusDisposes.push(() => d2())
          console.log('[shisan-xinuo] discipline_task tool registered (acceptance-assertion registry)')
          taskToolRegistered = true
        } else {
          console.log('[shisan-xinuo] discipline_task skipped (SHISANUO_NO_ASSERT=1 research mode)')
        }
      } catch (e) {
        // 注册失败=降级为纯文本 GATE 模式；拦截与机检不受影响（错误处理不拖垮宿主面）
        console.error('[shisan-xinuo] gate tool registration FAILED (fallback to text GATE):', String(e).slice(0, 200))
      }
    } else {
      console.warn('[shisan-xinuo] ctx.tools.register unavailable — gate tool skipped, text GATE fallback only')
    }
    statusDisposes.push(() => gateToolDispose?.())
    // ── 启动自检（批3 方向 A）：一次落账——任一处未就绪都**显式可见**（不静默降级）；与"段指纹遥测"配对。 ──
    {
      const check = {
        sections: statusDisposes.length,
        disciplineValid: disciplineLoad.valid,
        gateTool: gateToolRegistered,
        taskTool: taskToolRegistered,
        catalog: catalogRegistered,
        concludeOnPass: process.env.SHISANUO_CONCLUDE_ON_PASS !== '0',
        fingerprint: sectionFingerprintLast.slice(0, 16),
      }
      const missing: string[] = []
      if (!check.disciplineValid) missing.push('discipline')
      if (!check.gateTool) missing.push('gate-tool')
      if (!check.taskTool) missing.push('task-tool')
      void log({ kind: 'self-check', ...check, missing: missing.join(',') })
      console.log(
        `[shisan-xinuo] self-check: sections=${check.sections} gate=${check.gateTool} task=${check.taskTool} catalog=${check.catalog} conclude=${check.concludeOnPass} fp=${check.fingerprint}${missing.length ? ' MISSING=' + missing.join(',') : ''}`,
      )
    }
  }

  return () => {
    for (const d of statusDisposes) d()
    agentCreatedDispose()
    toolDispose()
    guardDispose?.()
    sessionEventDispose()
    turnStoppingDispose()
  }
}
