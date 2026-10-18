// 跳过治理 notice 形态回归（批3 方向 A）：宿主 notice 通道要求 source.form='notice' + 一行 summary，
// 且消息必须带 id/role（与 userMessage 同因——进 inbox 的身份字段宿主不补）。
// 2026-10-18 扩展：收口/判级强制 steer 呈现改造——五类 steer 全部走 notice 信封（不再与用户发言混排）。
import { noticeMessage, steerSummaryFor, STEER_ANTI_REPEAT } from '../src/shisan-xinuo-core.ts'

let fail = 0
const check = (c, m) => { if (!c) { fail++; console.log('FAIL: ' + m) } }

const m = noticeMessage('一行摘要', '完整三问正文')
check(typeof m.id === 'string' && m.id.length > 0, 'id 必须是非空字符串')
check(m.role === 'user', 'role 必须为 user')
check(m.source && m.source.form === 'notice', 'source.form 必须为 notice')
check(typeof m.source.summary === 'string' && m.source.summary.length > 0, 'notice 必须带非空 summary')
check(typeof m.source.kind === 'string' && m.source.kind.length > 0, 'source.kind 必须非空')
check(Array.isArray(m.content) && m.content[0].type === 'text' && m.content[0].text === '完整三问正文', 'content 为 [text] 且文本一致')
check(noticeMessage('a', 'b').id !== m.id, '每次 id 唯一')

// ── steer 呈现改造（2026-10-18）：五类强制 steer 的 summary 契约 ──
const S = {
  zerotool: steerSummaryFor('zerotool'),
  effectFail: steerSummaryFor('effect-fail'),
  assertFail: steerSummaryFor('assert-fail'),
  noCloseout: steerSummaryFor('no-closeout'),
  gapLevel: steerSummaryFor('discipline-gap', { needLevel: true }),
  gapChecklist: steerSummaryFor('discipline-gap', { needChecklist: true }),
  gapBoth: steerSummaryFor('discipline-gap', { needLevel: true, needChecklist: true }),
  gapAppend: steerSummaryFor('discipline-gap', { needLevel: true, append: true }),
}
for (const [k, v] of Object.entries(S)) {
  check(typeof v === 'string' && v.length > 0, `summary(${k}) 非空`)
  check(!v.includes('\n') && v.length <= 64, `summary(${k}) 单行且≤64 字符（UI 折叠行契约）`)
  check(v.includes('十三希诺'), `summary(${k}) 自曝来源（十三希诺）`)
}
check(S.zerotool.includes('收口强制'), 'zerotool 归入收口强制类')
check(S.effectFail.includes('收口强制') && S.assertFail.includes('收口强制') && S.noCloseout.includes('收口强制'), '三类收口 steer 共用收口强制前缀')
check(S.gapAppend.includes('追加判级'), 'append 场景=追加判级文案')
check(S.gapBoth.includes('判级') && S.gapBoth.includes('清单'), 'both 场景同时标明判级+清单')
check(S.gapChecklist.includes('清单') && !S.gapChecklist.includes('状态行'), 'checklist-only 场景不含判级文案')
// 信封联动：summary 进 source.summary、正文逐字保留（含模型可见前缀与防重述常量）
const env = noticeMessage(steerSummaryFor('no-closeout'), `[十三希诺收口强制] ${STEER_ANTI_REPEAT} 正文`)
check(env.source.form === 'notice' && env.source.summary === S.noCloseout, 'steer 信封 summary=对应文案')
check(env.content[0].text.startsWith('[十三希诺收口强制]') && env.content[0].text.includes(STEER_ANTI_REPEAT), '模型可见正文前缀与防重述常量逐字保留')

console.log(fail === 0 ? 'ALL PASS (notice-message)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
