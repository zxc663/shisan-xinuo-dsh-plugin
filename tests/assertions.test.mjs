// B2 验收绑定单测——断言自动推导/规格解析/真值评估/任务工具/收口复核集成（全注入，不打真实副作用面）。
// 运行：node tests/assertions.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  deriveAssertionsFromUserText,
  parseAssertionSpec,
  pinnedAssertionRecords,
  explainAssertion,
  evaluateAssertion,
  formatAssertionResults,
  buildGateToolDefinition,
  buildTaskToolDefinition,
} from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

const BASE = mkdtempSync(join(tmpdir(), 'b2-assert-'))

// ── 自动推导（from 用户原文）──
t('derive: 删除+盘符路径 → not_exists', [{ kind: 'not_exists', path: 'D:\\tmp\\x\\junk.txt' }], deriveAssertionsFromUserText('删除 D:\\tmp\\x\\junk.txt（该文件不再需要）'))
t('derive: 删掉+相对路径 → not_exists', [{ kind: 'not_exists', path: './tmp/old.txt' }], deriveAssertionsFromUserText('删掉 ./tmp/old.txt'))
t('derive: 否定语义不推导', [], deriveAssertionsFromUserText('不要删除 D:\\x\\keep.txt'))
t('derive: 创建+全路径 → exists', [{ kind: 'exists', path: 'D:\\x\\note.txt' }], deriveAssertionsFromUserText('创建文件 D:\\x\\note.txt 并写入三行'))
t('derive: 目录+文件名拼接 → exists(拼接路径)', [{ kind: 'exists', path: 'D:\\x\\note.txt' }], deriveAssertionsFromUserText('在 D:\\x\\ 创建 note.txt，写入三行'))
t('derive: 引号路径（含空格）不截断', [{ kind: 'not_exists', path: 'D:\\my docs\\file.txt' }], deriveAssertionsFromUserText('删除 "D:\\my docs\\file.txt"'))
t('derive: 引号吸收裸前缀（不产生 D:\\my 假目标）', [{ kind: 'not_exists', path: 'D:\\my docs\\file.txt' }], deriveAssertionsFromUserText('删除 D:\\my "D:\\my docs\\file.txt"'))
t('derive: 无意图动词不推导', [], deriveAssertionsFromUserText('查看 D:\\x\\f.txt 的内容'))
t('derive: 无路径不推导', [], deriveAssertionsFromUserText('删除那个文件'))
t('derive: 去重 + 4 条上限', 4, deriveAssertionsFromUserText('删除 D:\\a.txt D:\\b.txt D:\\c.txt D:\\d.txt D:\\e.txt').length)
// ── 误阻语料（B2.1）：以下情境必须不推导（宁 unbound 不产错断言）──
t('误阻: 改名改属变换 → 不推导', [], deriveAssertionsFromUserText('把 D:\\x\\a.txt 重命名为 b.txt'))
t('误阻: 举例语境 → 不推导', [], deriveAssertionsFromUserText('删除这个解释（例如 D:\\x\\sample.txt 只是举例）'))
t('误阻: 通配符路径 → 不推导', [], deriveAssertionsFromUserText('删除 D:\\x\\*'))
t('误阻: 目录内容粒度不明 → 不推导', [], deriveAssertionsFromUserText('清理掉 D:\\tmp\\cache 下的所有文件'))
t('误阻: 删除+创建并存（重建）→ 不推导', [], deriveAssertionsFromUserText('删除 D:\\x\\junk.tmp 然后重新创建它'))
t('误阻: 恢复语境 → 不推导', [], deriveAssertionsFromUserText('回滚刚才的删除，恢复 D:\\x\\a.txt'))
t('误阻: 备份语境 → 不推导', [], deriveAssertionsFromUserText('删除旧文件前先备份到 D:\\bak'))
t('误阻: 英文删除正例仍推导', [{ kind: 'not_exists', path: 'D:\\x\\old.log' }], deriveAssertionsFromUserText('delete D:\\x\\old.log'))

// ── 规格解析（discipline_task 入参）──
{
  const r = parseAssertionSpec('not_exists:D:\\x\\a.txt; exists:D:\\x\\b.txt')
  t('spec: 两断言解析', ['not_exists', 'exists'], r.map((x) => x.kind))
  t('spec: path 保真', 'D:\\x\\a.txt', r[0].path)
}
t('spec: path_contains :: 分隔', [{ kind: 'path_contains', path: 'D:\\x\\a.txt', substr: 'hello' }], parseAssertionSpec('path_contains:D:\\x\\a.txt::hello'))
t('spec: cmd_exit0 冒号保真', [{ kind: 'cmd_exit0', cmd: 'node D:\\x\\t.mjs' }], parseAssertionSpec('cmd_exit0:node D:\\x\\t.mjs'))
t('spec: 非法 kind 跳过', 1, parseAssertionSpec('bogus:x; not_exists:D:\\y').length)
t('spec: 空串为零', 0, parseAssertionSpec('   ').length)
t('spec: 8 条上限', 8, parseAssertionSpec(Array.from({ length: 10 }, (_, i) => `not_exists:D:\\p${i}`).join(';')).length)
t('explain: 语义可读', true, explainAssertion({ kind: 'not_exists', path: 'D:\\x' }).includes('不存在'))

// ── 真值评估（真实 fs，tmp 目录）──
const f1 = join(BASE, 'f1.txt')
writeFileSync(f1, 'hello b2 content')
const fMissing = join(BASE, 'nope.txt')
{
  const r = await evaluateAssertion({ kind: 'not_exists', path: fMissing })
  t('eval: not_exists 缺失=通过', true, r.ok)
}
{
  const r = await evaluateAssertion({ kind: 'not_exists', path: f1 })
  t('eval: not_exists 仍存在=不过', false, r.ok)
  t('eval: 失败详情可读', true, r.detail.includes('仍存在'))
}
t('eval: exists 存在=通过', true, (await evaluateAssertion({ kind: 'exists', path: f1 })).ok)
t('eval: exists 缺失=不过', false, (await evaluateAssertion({ kind: 'exists', path: fMissing })).ok)
t('eval: path_contains 命中=通过', true, (await evaluateAssertion({ kind: 'path_contains', path: f1, substr: 'hello' })).ok)
t('eval: path_contains 未命中=不过', false, (await evaluateAssertion({ kind: 'path_contains', path: f1, substr: 'zzz' })).ok)
t('eval: path_contains 文件缺失=不过', false, (await evaluateAssertion({ kind: 'path_contains', path: fMissing, substr: 'x' })).ok)
t('eval: cmd_exit0 注入 0=通过', true, (await evaluateAssertion({ kind: 'cmd_exit0', cmd: 'echo ok' }, { runCmd: async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }) })).ok)
t('eval: cmd_exit0 注入 1=不过', false, (await evaluateAssertion({ kind: 'cmd_exit0', cmd: 'echo fail' }, { runCmd: async () => ({ code: 1, stdout: '', stderr: '', timedOut: false }) })).ok)
{
  const r = await evaluateAssertion({ kind: 'cmd_exit0', cmd: 'rm -rf D:/x' })
  t('eval: cmd_exit0 L3 预检拒跑', false, r.ok)
  t('eval: 拒跑详情含域', true, r.detail.includes('L3'))
}
t('format: ✔/✘ 标记', true, formatAssertionResults([{ assertion: { kind: 'exists', path: 'a' }, ok: true, detail: '' }, { assertion: { kind: 'exists', path: 'b' }, ok: false, detail: '' }]).includes('✔') && formatAssertionResults([{ assertion: { kind: 'exists', path: 'b' }, ok: false, detail: '' }]).includes('✘'))

// ── 任务工具（Mock 桥）──
{
  const recs = pinnedAssertionRecords('not_exists:D:\\x\\p.txt; cmd_exit0:git status')
  t('pinned: 解析两条', 2, recs.length)
  t('pinned: 来源标记 pinned', 'pinned', recs[0].source)
  t('pinned: 空规格=空', 0, pinnedAssertionRecords('').length)
  t('pinned: undefined=空', 0, pinnedAssertionRecords(undefined).length)
}
function mkBridge(init = []) {
  let recs = init
  const calls = { register: 0, clear: 0 }
  return {
    calls,
    get recs() { return recs },
    register(assertions, goal, ctx, mode = 'merge') {
      calls.register++
      const base = mode === 'replace' ? recs.filter((x) => x.source === 'auto') : recs
      const keptAuto = base.filter((x) => x.source === 'auto').length
      const seen = new Set(base.map((x) => JSON.stringify(x.assertion)))
      recs = [...base, ...assertions.filter((a) => !seen.has(JSON.stringify(a))).map((a) => ({ assertion: a, source: 'tool' }))]
      return { count: recs.length, mark: 'mock', preservedAuto: keptAuto }
    },
    clear() { calls.clear++; recs = [] },
    list() { return recs },
    async evaluate(a) { return { assertion: a, ok: true, detail: 'mock' } },
    markPassed() {},
  }
}
{
  const bridge = mkBridge()
  const def = buildTaskToolDefinition({ log: () => {}, acceptance: bridge })
  const r = await def.execute({ action: 'register', goal: 'g', assertions: 'not_exists:D:\\x\\a.txt; exists:D:\\x\\b.txt' }, {})
  t('task: 登记两断言', 'ok', r.status)
  t('task: count', 2, r.count)
  t('task: 消息含断言读法', true, r.message.includes('不存在') && r.message.includes('存在'))
  t('task: 桥收到 2 条', 2, bridge.recs.length)
}
{
  const bridge = mkBridge()
  const def = buildTaskToolDefinition({ log: () => {}, acceptance: bridge })
  const r = await def.execute({ action: 'register', assertions: 'bogus' }, {})
  t('task: 非法规格=empty 不登记', 'empty', r.status)
  t('task: empty 不触桥', 0, bridge.calls.register)
}
{
  const bridge = mkBridge([{ assertion: { kind: 'exists', path: 'p' }, source: 'auto' }])
  const def = buildTaskToolDefinition({ log: () => {}, acceptance: bridge })
  const rClr = await def.execute({ action: 'clear' }, {})
  t('task: auto 断言 clear 被拒', 'refused', rClr.status)
  t('task: 拒后记录仍在', 1, bridge.recs.length)
  t('task: status 列表', true, (await def.execute({ action: 'status' }, {})).message.includes('auto'))
}
{
  const bridge = mkBridge([{ assertion: { kind: 'exists', path: 'p' }, source: 'tool' }])
  const def = buildTaskToolDefinition({ log: () => {}, acceptance: bridge })
  t('task: tool 断言 clear 放行', 'cleared', (await def.execute({ action: 'clear' }, {})).status)
  t('task: clear 后为空', 0, bridge.recs.length)
}
// ── B2.2：合并/替换语义 + 收口标记 ──
{
  const bridge = mkBridge([{ assertion: { kind: 'exists', path: 'keep.txt' }, source: 'tool' }])
  const def = buildTaskToolDefinition({ log: () => {}, acceptance: bridge })
  const r = await def.execute({ action: 'register', assertions: 'not_exists:D:\\x\\new.txt' }, {})
  t('task: merge 保留既有', 2, bridge.recs.length)
  t('task: merge 消息提示合并', true, r.message.includes('合并'))
  await def.execute({ action: 'register', assertions: 'not_exists:D:\\x\\new.txt' }, {})
  t('task: merge 去重', 2, bridge.recs.length)
  await def.execute({ action: 'register', mode: 'replace', assertions: 'exists:D:\\x\\only.txt' }, {})
  t('task: 纯工具断言 replace=替换', 1, bridge.recs.length)
}
{
  const logs = []
  const bridge = mkBridge([{ assertion: { kind: 'exists', path: 'auto.txt' }, source: 'auto' }])
  const def = buildTaskToolDefinition({ log: (e) => logs.push(e), acceptance: bridge })
  const r1 = await def.execute({ action: 'register', mode: 'replace', assertions: 'not_exists:D:\\x\\a.txt' }, {})
  t('task: replace 放行（无需 reason）', 'ok', r1.status)
  t('task: replace 后 auto 恒保留', true, bridge.recs.some((x) => x.source === 'auto' && x.assertion.path === 'auto.txt'))
  t('task: replace 后新工具断言并入', true, bridge.recs.some((x) => x.source === 'tool' && x.assertion.path === 'D:\\x\\a.txt'))
  t('task: replace 后总数=2（auto+tool）', 2, bridge.recs.length)
  t('task: 落审计（preservedAuto=1）', true, logs.some((l) => l.kind === 'task-register' && l.mode === 'replace' && l.preservedAuto === 1))
  const r2 = await def.execute({ action: 'register', mode: 'replace', assertions: 'exists:D:\\x\\b.txt' }, {})
  t('task: 二次 replace 仍含 auto（模型不可移除）', true, bridge.recs.some((x) => x.source === 'auto'))
  t('task: 二次 replace 仅换工具断言', true, !bridge.recs.some((x) => x.source === 'tool' && x.assertion.path === 'D:\\x\\a.txt') && bridge.recs.some((x) => x.source === 'tool' && x.assertion.path === 'D:\\x\\b.txt'))
  t('task: 二次 replace 总数=2', 2, r2.count)
}

// ── 收口复核集成（gate 工具 + Mock 断言桥）──
const okRun = async () => ({ code: 0, stdout: '', stderr: '', timedOut: false })
function mkAccept(list, evalOk = true) {
  const stat = { listCalls: 0, evalCalls: 0, markPassed: 0 }
  return {
    stat,
    register() { return { count: 0, mark: '' } },
    clear() {},
    list() { stat.listCalls++; return list.map((a) => ({ assertion: a, source: 'tool' })) },
    async evaluate(a) { stat.evalCalls++; return { assertion: a, ok: evalOk, detail: evalOk ? 'mock-ok' : 'mock-fail' } },
    markPassed() { stat.markPassed++ },
  }
}
{
  const acc = mkAccept([{ kind: 'not_exists', path: 'D:\\goal.txt' }], true)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, acceptance: acc })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, {})
  t('gate: 断言全过 → pass', 'pass', r.status)
  t('gate: pass 附断言明细', 1, r.assertions.length)
  t('gate: pass 消息含"全部通过"', true, r.message.includes('全部通过'))
  t('gate: markPassed 被调', 1, acc.stat.markPassed)
}
{
  const acc = mkAccept([{ kind: 'not_exists', path: 'D:\\goal.txt' }], false)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, acceptance: acc })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, {})
  t('gate: 断言不过 → assertion-fail', 'assertion-fail', r.status)
  t('gate: 打回消息含"不得宣告完成"', true, r.message.includes('不得宣告完成'))
  t('gate: 打回消息含 ✘ 与资源真值', true, r.message.includes('✘') && r.message.includes('资源真值'))
  t('gate: 失败不 markPassed', 0, acc.stat.markPassed)
}
{
  const acc = mkAccept([{ kind: 'exists', path: 'D:\\a' }], true)
  const def = buildGateToolDefinition({ runCmd: async () => ({ code: 1, stdout: '', stderr: '', timedOut: false }), log: () => {}, onStats: () => {}, acceptance: acc })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo x', claimedExit: 0 }, {})
  t('gate: mismatch 不触发断言复核', 0, acc.stat.listCalls)
  t('gate: mismatch 原语义保持', 'mismatch', r.status)
}
{
  const acc = mkAccept([{ kind: 'exists', path: 'D:\\a' }], true)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, judge: () => '数据删除', acceptance: acc })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'rm -rf D:/x', claimedExit: 0 }, {})
  t('gate: refused 不触发断言复核', 0, acc.stat.listCalls)
  t('gate: refused 原语义保持', 'refused', r.status)
}
{
  const acc = mkAccept([], true)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, acceptance: acc })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, {})
  t('gate: 无断言 → 旧形态 pass', 'pass', r.status)
  t('gate: 无断言不带 assertions 字段', undefined, r.assertions)
}
// ── B2.2：concludeTurn 选择加入 ──
{
  let ctCalls = 0
  const acc = mkAccept([{ kind: 'exists', path: 'D:\\a' }], true)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, acceptance: acc, concludeOnPass: true })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, { concludeTurn: () => { ctCalls++ } })
  t('gate: 开启且断言全过 → concludeTurn 被调', 1, ctCalls)
  t('gate: 返回值标记 concludedTurn', true, r.concludedTurn === true)
}
{
  let ctCalls = 0
  const acc = mkAccept([{ kind: 'exists', path: 'D:\\a' }], false)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, acceptance: acc, concludeOnPass: true })
  await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, { concludeTurn: () => { ctCalls++ } })
  t('gate: 断言不过不 concludeTurn', 0, ctCalls)
}
{
  let ctCalls = 0
  const acc = mkAccept([{ kind: 'exists', path: 'D:\\a' }], true)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, acceptance: acc })
  const r = await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, { concludeTurn: () => { ctCalls++ } })
  t('gate: 默认关不 concludeTurn', 0, ctCalls)
  t('gate: 默认关无 concludedTurn 字段', undefined, r.concludedTurn)
}
{
  let ctCalls = 0
  const acc = mkAccept([], true)
  const def = buildGateToolDefinition({ runCmd: okRun, log: () => {}, onStats: () => {}, acceptance: acc, concludeOnPass: true })
  await def.execute({ level: 'L1', v: 'x', cmd: 'echo ok', claimedExit: 0 }, { concludeTurn: () => { ctCalls++ } })
  t('gate: 无断言不 concludeTurn（旧路径）', 0, ctCalls)
}

rmSync(BASE, { recursive: true, force: true })

for (const c of cases) console.log(c)
console.log(`\n=== assertions.test: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
