// P5（roadmap F8/F9）单测——压缩信号（compaction/end→重载指令注入）＋环境盘点（工作区自有资产扫描）。
// 探针2 裁定：宿主原生 compaction/start|summary|end|prune 事件族齐全（p1-host-probes §探针2）。
import {
  buildCompactionReloadNotice,
  shouldInjectCompactionSignal,
  extractCompactionShadowedTokens,
  scanWorkspaceAssets,
} from '../src/shisan-xinuo-core.ts'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

// ── F8：压缩信号判定与文案 ──
t('F8: compaction/end 成功 → 注入', true, shouldInjectCompactionSignal({ type: 'compaction/end', data: { compactionId: 'c1', turn: 3 } }))
t('F8: compaction/end 带 error → 不注入（失败压缩无信号）', false, shouldInjectCompactionSignal({ type: 'compaction/end', data: { compactionId: 'c1', turn: 3, error: 'provider timeout' } }))
t('F8: compaction/start → 不注入（完成才算）', false, shouldInjectCompactionSignal({ type: 'compaction/start', data: { compactionId: 'c1', turn: 3 } }))
t('F8: compaction/summary → 不注入（等 end 收口）', false, shouldInjectCompactionSignal({ type: 'compaction/summary', data: { compactionId: 'c1' } }))
t('F8: 其他事件 → 不注入', false, shouldInjectCompactionSignal({ type: 'user/message', data: {} }))
t('F8: null 安全', false, shouldInjectCompactionSignal(null))

const notice = buildCompactionReloadNotice(1200)
t('F8: 信号文案声明压缩事实', true, notice.includes('压缩'))
t('F8: 信号文案指向重载序（compression-reload）', true, notice.includes('compression-reload') || notice.includes('重载'))
t('F8: 信号文案含影子 token 量（对账面）', true, notice.includes('1200'))
t('F8: 信号文案要求复述任务本质+当前步骤', true, notice.includes('任务本质') || notice.includes('当前步骤'))

// ── F9：工作区资产扫描（真实临时目录）──
{
  const dir = mkdtempSync(join(tmpdir(), 'xinuo-inv-'))
  try {
    // 空目录：最小形态
    const empty = scanWorkspaceAssets(dir)
    t('F9: 空目录无脚本无文件', { scripts: [], scriptFiles: [], tests: 0 }, empty)

    // 造资产：package.json scripts + scripts/ 文件 + tests/ 文件
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'node scripts/run-all-tests.mjs', tally: 'node scripts/tally.mjs --report' } }))
    mkdirSync(join(dir, 'scripts'))
    writeFileSync(join(dir, 'scripts', 'tally.mjs'), '// t')
    writeFileSync(join(dir, 'scripts', 'gen-rules.mjs'), '// t')
    mkdirSync(join(dir, 'tests'))
    writeFileSync(join(dir, 'tests', 'a.test.mjs'), '// t')
    writeFileSync(join(dir, 'tests', 'b.test.mjs'), '// t')
    writeFileSync(join(dir, 'tests', 'c.test.mjs'), '// t')
    const inv = scanWorkspaceAssets(dir)
    t('F9: npm scripts 提取', ['test', 'tally'], inv.scripts)
    t('F9: scripts/ 目录文件（字母序）', ['gen-rules.mjs', 'tally.mjs'], inv.scriptFiles)
    t('F9: tests 计数=3', 3, inv.tests)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── F8 修复回归（2026-10-18 实机走查）：shadowedTokenCount 只存在于 compaction/summary 事件
// （会话日志实证：end 事件 data 无该字段、summary 有 shadowedSeqs/shadowedTokenCount）→ 从 summary 捕获 ──
t('F8f: summary 事件提取影子 token（真机形状）', { compactionId: 'c1', tokens: 5480 }, extractCompactionShadowedTokens({ type: 'compaction/summary', data: { compactionId: 'c1', shadowedSeqs: [9, 10], shadowedTokenCount: 5480 } }))
t('F8f: end 事件不提取（无该字段）', null, extractCompactionShadowedTokens({ type: 'compaction/end', data: { compactionId: 'c1', turn: null } }))
t('F8f: start 事件不提取', null, extractCompactionShadowedTokens({ type: 'compaction/start', data: { compactionId: 'c1' } }))
t('F8f: summary 缺 compactionId → null（防串账）', null, extractCompactionShadowedTokens({ type: 'compaction/summary', data: { shadowedTokenCount: 5 } }))
t('F8f: summary 缺计数 → 0', { compactionId: 'c2', tokens: 0 }, extractCompactionShadowedTokens({ type: 'compaction/summary', data: { compactionId: 'c2' } }))
t('F8f: 非数字计数 → 0 兜底', { compactionId: 'c3', tokens: 0 }, extractCompactionShadowedTokens({ type: 'compaction/summary', data: { compactionId: 'c3', shadowedTokenCount: 'x' } }))
t('F8f: null 安全', null, extractCompactionShadowedTokens(null))

// 非存在目录安全
t('F9: 目录不存在=空形态不炸', { scripts: [], scriptFiles: [], tests: 0 }, scanWorkspaceAssets('D:/definitely-not-exist-xyz'))

console.log(cases.join('\n'))
console.log(`\n=== compaction-inventory: ${pass} pass / ${fail} fail ===`)
if (fail > 0) process.exit(1)
