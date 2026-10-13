#!/usr/bin/env node
// E1-v4 总分析：exec-log 按 arm 行切 9 个臂窗（3 轮×3 臂），每窗内 behavior 行按轮分组；
// 真值来自 tmp/e1v4-truth.json（批量执行期间逐会话记录）；输出汇总表 JSON+可读文本。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REPO = 'D:/DeepSeek/dsh-plugin-dev'
const lines = readFileSync(join(REPO, 'logs/exec-log.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)

// 切臂窗：每遇 arm 行开新窗
const windows = []
let cur = null
for (const l of lines) {
  if (l.kind === 'arm') { cur = { mode: l.mode, ts: l.ts, behaviors: [], gateTools: [], intercepts: [], detects: [], budgets: [] }; windows.push(cur) }
  else if (cur) {
    if (l.kind === 'behavior') cur.behaviors.push(l)
    else if (l.kind === 'gate-tool') cur.gateTools.push(l)
    else if (l.kind === 'l3-intercept') cur.intercepts.push(l)
    else if (l.kind === 'l3-detected') cur.detects.push(l)
    else if (l.kind === 'budget-applied') cur.budgets.push(l)
  }
}
// 只取 v4 批量段（2026-10-12T23:44 之后 = 轮 1 C 臂起）
const v4 = windows.filter((w) => w.ts >= '2026-10-12T23:44')
// 轮 1 A 臂含 1 个污染回合（turn2）与 1 个作废首发——按窗内 behavior 顺序取「有效轮次」：
// 每窗应有 3 个 behavior（3 任务）；多于 3=含污染回合，取最后 3 个（作废在前）。
const armRuns = { C: [], B: [], A: [] }
for (const w of v4) {
  const bs = w.behaviors.slice(-3)
  armRuns[w.mode]?.push({
    ts: w.ts, behaviors: bs,
    gateTools: w.gateTools.map((g) => ({ status: g.status, cmd: (g.cmd ?? '').slice(0, 60), claimed: g.claimedExit, real: g.realExit })),
    intercepts: w.intercepts.length, detects: w.detects.length,
  })
}
const truth = JSON.parse(readFileSync(join(REPO, 'tmp/e1v4-truth.json'), 'utf8'))
// truth 结构：{ C: {T1:[r1,r2,r3],...}, B: {...}, A: {...}, D: {...} } 每元素={result:'deleted'|'target-sub'|'noaction', gate:'ok-tool'|'missing'|null, note}
const out = { arms: {}, pairwise: {} }
for (const arm of ['C', 'B', 'A', 'D']) {
  out.arms[arm] = {}
  for (const t of ['T1', 'T2', 'T3']) {
    out.arms[arm][t] = truth[arm]?.[t] ?? []
  }
}
// exec-log 侧（A/B/C）行为面并入
for (const arm of ['C', 'B', 'A']) {
  const runs = armRuns[arm] ?? []
  runs.forEach((r, i) => {
    for (const [j, t] of ['T1', 'T2', 'T3'].entries()) {
      const b = r.behaviors[j]
      if (b && out.arms[arm][t][i]) {
        out.arms[arm][t][i].restated = b.restated
        out.arms[arm][t][i].levelDeclared = b.levelDeclared
        out.arms[arm][t][i].gateExec = b.gate
      }
    }
    if (out.arms[arm].T1[i]) { out.arms[arm].T1[i].intercepts = r.intercepts; out.arms[arm].T1[i].detects = r.detects }
  })
}
// 三组对照差分
const rate = (arr, f) => arr.filter(f).length + '/' + arr.length
for (const t of ['T1', 'T2', 'T3']) {
  out.pairwise[t] = {
    'C收口': rate(out.arms.C[t], (x) => (x.gate ?? x.gateExec ?? '').startsWith('ok')),
    'B收口': rate(out.arms.B[t], (x) => (x.gate ?? x.gateExec ?? '').startsWith('ok')),
    'A收口': rate(out.arms.A[t], (x) => (x.gate ?? x.gateExec ?? '').startsWith('ok')),
    'B复述': rate(out.arms.B[t], (x) => x.restated === true),
    'A复述': rate(out.arms.A[t], (x) => x.restated === true),
  }
}
console.log(JSON.stringify(out, null, 1))
writeFileSync(join(REPO, 'tmp/e1v4-analysis.json'), JSON.stringify(out, null, 2))
