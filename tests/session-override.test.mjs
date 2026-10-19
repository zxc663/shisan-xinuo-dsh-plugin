// 会话级覆盖 + 统计聚合 单测：验证「会话级 > 全局」数据面与 stats 聚合真实生效。
import { writeSessionOverride, readSessionOverride, rollbackSession, sessionDir, makeApi, uniqueBackupName } from '../src/dsh-custom.ts'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pass = 0, fail = 0
const t = (name, ok) => { if (ok) { pass++; console.log('PASS ' + name) } else { fail++; console.log('FAIL ' + name) } }

const root = mkdtempSync(join(tmpdir(), 'dshc-sess-'))
try {
  // 1. 写入 + 读取
  const w = writeSessionOverride(root, 'session-abc', { discipline: '会话级纪律' })
  t('write 返回 written 含 discipline', w.written.includes('discipline'))
  const r1 = readSessionOverride(root, 'session-abc')
  t('read 命中 discipline', r1.discipline === '会话级纪律')
  t('read 未设段为 null', r1.user === null)

  // 2. 再写一版（产生会话快照）
  writeSessionOverride(root, 'session-abc', { discipline: '第二版' })
  t('第二版生效', readSessionOverride(root, 'session-abc').discipline === '第二版')

  // 3. 回滚到上一版
  const rb = rollbackSession(root, 'session-abc', 'previous')
  t('rollback previous 恢复 discipline', rb.restored.includes('discipline'))
  t('rollback 后内容为上一版', readSessionOverride(root, 'session-abc').discipline === '会话级纪律')

  // 4. 回滚到官方（清空覆盖）
  const ro = rollbackSession(root, 'session-abc', 'official')
  t('rollback official 清空', ro.cleared.includes('discipline'))
  t('rollback official 后为 null', readSessionOverride(root, 'session-abc').discipline === null)

  // 5. 空段 = 删除该段
  writeSessionOverride(root, 'session-abc', { discipline: 'x' })
  writeSessionOverride(root, 'session-abc', { discipline: '' })
  t('空段删除', readSessionOverride(root, 'session-abc').discipline === null)

  // 6. 非法 id（空）拒绝
  let threw = false
  try { sessionDir(root, '') } catch { threw = true }
  t('空会话 id 拒绝', threw)

  // 7. 全局改不触碰会话级（写全局文件后会话覆盖仍在）
  writeSessionOverride(root, 'session-abc', { discipline: '保留' })
  writeFileSync(join(root, 'discipline.md'), '全局纪律', 'utf8')
  t('全局写入不覆盖会话级', readSessionOverride(root, 'session-abc').discipline === '保留')

  // 8. stats 聚合（makeApi 路由）
  writeFileSync(join(root, 'audit.jsonl'), [
    JSON.stringify({ kind: 'guard-deny', ts: '2026-10-18T01:00:00Z' }),
    JSON.stringify({ kind: 'guard-deny', ts: '2026-10-18T02:00:00Z' }),
    JSON.stringify({ kind: 'external-change', ts: '2026-10-18T03:00:00Z' }),
    '{bad json',
  ].join('\n'), 'utf8')
  let captured = null
  const res = { writeHead() {}, end(s) { try { captured = JSON.parse(s) } catch { captured = null } } }
  const req = { method: 'GET', url: '/api/dsh-custom/stats' }
  const handler = makeApi(root, () => null, { denied: 0, touched: 0 })
  handler(req, res)
  t('stats guardDeny=2', captured !== null && captured.value && captured.value.guardDeny === 2)
  t('stats externalChange=1', captured !== null && captured.value && captured.value.externalChange === 1)
  t('stats audit 忽略坏行', captured !== null && captured.value && captured.value.audit.length === 3)
} finally {
  rmSync(root, { recursive: true, force: true })
}

// 快照同毫秒撞名防护（2026-10-19 CI 修复）：Linux 快机同毫秒连续快照曾互相覆盖 →「暂无上一版」
t('bakname: 无冲突=原样', uniqueBackupName('S', () => false) === 'S')
t('bakname: 冲突→追加-1', uniqueBackupName('S', (n) => n === 'S') === 'S-1')
t('bakname: 连撞→递增', uniqueBackupName('S', (n) => n === 'S' || n === 'S-1') === 'S-2')

console.log(`\n${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
