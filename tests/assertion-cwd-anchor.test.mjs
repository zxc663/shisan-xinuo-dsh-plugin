// 回归：断言路径/命令执行目录锚定工作区 cwd。
// 本会话实证：断言用相对路径（memory/xxx）时，evaluateAssertion 按进程 cwd 解析导致文件真实存在仍判「目标不存在」，
// 收口死循环；收口命令 npm run build 也因 exec 未锚定 cwd 而找不到脚本。修复后相对路径/命令统一锚到工作区根。
import { evaluateAssertion, resolveAssertionPath } from '../src/shisan-xinuo-core.ts'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('..', import.meta.url))
const TD = join(repo, 'memory', 'tmp', 'assert-cwd-anchor')
const WORK = join(TD, 'ws')
const OUTSIDE = join(TD, 'outside')

let pass = 0, fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}
async function ta(name, expect, p) {
  const actual = await p
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

rmSync(TD, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
mkdirSync(OUTSIDE, { recursive: true })
const rel = 'memory/marker.md'
mkdirSync(join(WORK, 'memory'), { recursive: true })
writeFileSync(join(WORK, 'memory', 'marker.md'), '自包含边界', { flag: 'w' })
// 进程 cwd 下不存在的同相对路径——若锚定失败，会落到这里而判「不存在」
mkdirSync(join(TD, 'memory'), { recursive: true }) // 进程 cwd 无关；实际求值以 deps.cwd 为准

// ── resolveAssertionPath ──
t('resolve: 相对路径锚定 cwd', join(WORK, rel).replace(/\\/g, '/'), resolveAssertionPath(rel, WORK).replace(/\\/g, '/'))
t('resolve: 盘符绝对路径原样', 'D:/a/b.md', resolveAssertionPath('D:/a/b.md', WORK).replace(/\\/g, '/'))
t('resolve: 反斜杠绝对路径原样', 'D:/a/b.md', resolveAssertionPath('D:\\a\\b.md', WORK).replace(/\\/g, '/'))
t('resolve: / 开头原样', '/a/b.md', resolveAssertionPath('/a/b.md', WORK))
t('resolve: 无 cwd 时原样', rel, resolveAssertionPath(rel, undefined))

// ── evaluateAssertion 带 cwd 锚定 ──
await ta('eval: 相对路径 exists 带 cwd=通过', { ok: true, kind: 'exists' }, evaluateAssertion({ kind: 'exists', path: rel }, { cwd: WORK }).then((r) => ({ ok: r.ok, kind: 'exists' })))
await ta('eval: 相对路径 path_contains 带 cwd=命中', true, evaluateAssertion({ kind: 'path_contains', path: rel, substr: '自包含边界' }, { cwd: WORK }).then((r) => r.ok))
await ta('eval: 相对路径 path_contains 带 cwd 内容不匹配', false, evaluateAssertion({ kind: 'path_contains', path: rel, substr: '不存在的内容' }, { cwd: WORK }).then((r) => r.ok))
await ta('eval: 相对路径 exists 无 cwd（进程 cwd 下无该文件）→ 判不存在（向后兼容语义）', false, evaluateAssertion({ kind: 'exists', path: rel }).then((r) => r.ok))

console.log(cases.join('\n'))
console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
