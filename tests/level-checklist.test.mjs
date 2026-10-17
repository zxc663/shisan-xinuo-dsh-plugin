// P2（roadmap F1/F2）单测——判级强制＋任务清单强制。
// 运行：node tests/level-checklist.test.mjs
// 失败用例先行：本文件先于实现落盘（红→绿）；F1 验收判据 a/c 与 F2 触发/豁免反例全部入册。
import {
  extractDeclaredLevel,
  isAppendFollowUpText,
  buildDisciplineSteerText,
  parseChecklistSpec,
  judgeDisciplineGap,
  buildTaskToolDefinition,
} from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

// ── F1：判级行解析（复用 extractDeclaredLevel，先钉契约防回归）──
t('F1 parse: 状态行 L2-S', 'L2-S', extractDeclaredLevel('Context: state=新任务 L=L2-S clarify=无 approval=无需'))
t('F1 parse: 状态行 L3', 'L3', extractDeclaredLevel('Context: state=续接 L=L3 clarify=无 approval=待批准'))
t('F1 parse: 正文随口提及不算（防误判）', null, extractDeclaredLevel('这个任务大概是 L2 级别的活'))
t('F1 parse: 无判级=null', null, extractDeclaredLevel('好的，我来处理这个任务。'))

// ── F1：追加特征判别（追加判级提示触发器；误判=噪声，反例必须全绿）──
t('append: 继续', true, isAppendFollowUpText('继续，把删除部分也做了'))
t('append: 然后', true, isAppendFollowUpText('然后再加一个配置文件'))
t('append: 接着', true, isAppendFollowUpText('接着上面的做'))
t('append: 还要', true, isAppendFollowUpText('还要补一个测试'))
t('append: 顺便', true, isAppendFollowUpText('顺便把文档也更新'))
t('append: 普通新任务=false（反例）', false, isAppendFollowUpText('帮我新建一个项目并初始化 git'))
t('append: 疑问句=false（反例：提问不是追加任务）', false, isAppendFollowUpText('继续是什么意思？'))
t('append: 空串=false', false, isAppendFollowUpText(''))
t('append: 长篇新需求=false（反例：长文本是新任务不是追加）', false, isAppendFollowUpText('我想做一个全新的页面，包含导航栏、侧边栏、内容区和页脚，风格采用深色主题，并且要支持响应式布局。'))

// ── F1/F2：steer 文案构造 ──
t('steer: 补判级文案含关键信息', true,
  buildDisciplineSteerText({ needLevel: true, needChecklist: false, append: false }).includes('判级')
  && buildDisciplineSteerText({ needLevel: true, needChecklist: false, append: false }).includes('L='))
t('steer: 追加文案含追加判级语义', true,
  buildDisciplineSteerText({ needLevel: true, needChecklist: false, append: true }).includes('追加'))
t('steer: 清单文案含 discipline_task 与 exempt 出口', true,
  buildDisciplineSteerText({ needLevel: false, needChecklist: true, append: false }).includes('discipline_task')
  && buildDisciplineSteerText({ needLevel: false, needChecklist: true, append: false }).includes('exempt'))
t('steer: 双缺文案两者都含', true,
  buildDisciplineSteerText({ needLevel: true, needChecklist: true, append: false }).includes('判级')
  && buildDisciplineSteerText({ needLevel: true, needChecklist: true, append: false }).includes('discipline_task'))
t('steer: 两不需要=空串（不注入）', '', buildDisciplineSteerText({ needLevel: false, needChecklist: false, append: false }))

// ── F2：checklist 解析 ──
t('checklist: 分号分隔', ['需求A', '需求B'], parseChecklistSpec('需求A;需求B'))
t('checklist: 单项无分号', ['唯一需求'], parseChecklistSpec('唯一需求'))
t('checklist: 空与空白=[]', [], parseChecklistSpec('  ;  ; '))
t('checklist: null/undefined=[]', [], parseChecklistSpec(undefined))

// ── F1/F2：判定核心（turn-stopping 检测逻辑的纯函数化；验收判据 a/c 的机器面）──
const G = (o) =>
  judgeDisciplineGap({ declaredLevel: null, hostLevel: 1, toolCalls: 2, hasAssertions: false, hasChecklist: false, levelEnforce: true, checklistEnforce: true, ...o })

t('gap: 实质回合无判级 → needLevel（验收a：100% 注入）', { needLevel: true, needChecklist: false }, G({ declaredLevel: null }))
t('gap: 已给判级 → 不再要判级（不重复注入）', null, G({ declaredLevel: 'L1' }))
t('gap: 判级关闭时无判级=null（旗标退位）', null, G({ declaredLevel: null, levelEnforce: false }))
t('gap: 零工具回合=null（验收c：纯聊天 0 误注入）', null, G({ declaredLevel: null, toolCalls: 0 }))
t('gap: 只读回合=null（验收c：低副作用不骚扰）', null, G({ declaredLevel: null, hostLevel: 0 }))
t('gap: L2-F 无登记 → needChecklist（F2 触发）', { needLevel: false, needChecklist: true }, G({ declaredLevel: 'L2-F' }))
t('gap: L3 无登记 → needChecklist', { needLevel: false, needChecklist: true }, G({ declaredLevel: 'L3' }))
t('gap: L1/L2-S 不强制清单（轻任务免骚扰）', null, G({ declaredLevel: 'L1' }))
t('gap: L2-F 已有断言 → 不再要清单', null, G({ declaredLevel: 'L2-F', hasAssertions: true }))
t('gap: L2-F 已有清单 → 不再要清单', null, G({ declaredLevel: 'L2-F', hasChecklist: true }))
t('gap: 清单关闭旗标生效', null, G({ declaredLevel: 'L2-F', checklistEnforce: false }))
t('gap: 宿主视角重活无自报判级 → 双缺（低报也逃不掉）', { needLevel: true, needChecklist: true }, G({ declaredLevel: null, hostLevel: 2 }))
t('gap: 无判级+清单强制关 → 只补判级', { needLevel: true, needChecklist: false }, G({ declaredLevel: null, checklistEnforce: false }))

// ── F2：discipline_task register 扩展 checklist（工具面）──
{
  const logs = []
  let rec = null
  const def = buildTaskToolDefinition({
    log: (e) => { logs.push(e) },
    acceptance: {
      register: (a, goal, _ctx, mode, checklist) => {
        rec = { assertions: a, checklist: checklist ?? [] }
        return { count: a.length, mark: '', preservedAuto: 0 }
      },
      clear: () => {},
      list: () => [],
      evaluate: async (x) => ({ ok: true, assertion: x, detail: '' }),
      markPassed: () => {},
    },
  })
  const r = await def.execute({ action: 'register', goal: '迭代任务', assertions: 'exists:a.txt', checklist: '建文件;跑测试' }, {})
  t('task register: checklist 透传', ['建文件', '跑测试'], rec.checklist)
  t('task register: 返回 ok', 'ok', r.status)
  t('task register: 审计含 checklist 条数', true,
    logs.some((e) => e.kind === 'task-register' && e.checklistCount === 2))
  const r2 = await def.execute({ action: 'status' }, {})
  t('task status: 不带 checklist 也不炸', true, typeof r2.status === 'string')
}

// ── 汇总 ──
console.log(cases.join('\n'))
console.log(`\n=== level-checklist: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
