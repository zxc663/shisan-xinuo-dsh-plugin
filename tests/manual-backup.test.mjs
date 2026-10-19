// 手动快照单测（2026-10-19 旅程补缺）：POST /api/dsh-custom/backups 创建即入列表；方法约束。
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeApi, ensureStorage } from '../src/dsh-custom.ts'

let pass = 0, fail = 0
const t = (name, ok) => { if (ok) { pass++; console.log('PASS ' + name) } else { fail++; console.log('FAIL ' + name) } }

const root = mkdtempSync(join(tmpdir(), 'dshc-mbak-'))
try {
  ensureStorage(root)
  const handler = makeApi(root, () => null, { denied: 0, touched: 0 })
  let captured = null
  const mkRes = () => ({
    writeHead() {},
    end(s) { try { captured = JSON.parse(String(s)) } catch { captured = null } },
  })

  captured = null
  handler({ method: 'POST', url: '/api/dsh-custom/backups' }, mkRes())
  t('POST 备份 ok', captured !== null && captured.ok === true)
  const dir = captured !== null && captured.value ? captured.value.dir : null
  t('返回目录存在', typeof dir === 'string' && existsSync(dir))
  t('POST 返回列表含 1 条', captured !== null && captured.value && captured.value.entries.length === 1)

  captured = null
  handler({ method: 'GET', url: '/api/dsh-custom/backups' }, mkRes())
  t('GET 列表=1（同管道可见）', captured !== null && captured.value && captured.value.entries.length === 1)

  const firstName = captured !== null && captured.value && captured.value.entries[0] ? captured.value.entries[0].name : ''
  captured = null
  handler({ method: 'DELETE', url: '/api/dsh-custom/backups?name=' + encodeURIComponent(firstName) }, mkRes())
  t('DELETE 条目 ok（列表减 1）', captured !== null && captured.ok === true && captured.value.entries.length === 0)

  captured = null
  handler({ method: 'DELETE', url: '/api/dsh-custom/backups?name=' + encodeURIComponent(firstName) }, mkRes())
  t('DELETE 不存在 → 拒绝', captured !== null && captured.ok === false)

  captured = null
  handler({ method: 'DELETE', url: '/api/dsh-custom/backups?name=' + encodeURIComponent('../evil') }, mkRes())
  t('DELETE 越界名 → 拒绝', captured !== null && captured.ok === false)

  captured = null
  handler({ method: 'PUT', url: '/api/dsh-custom/backups' }, mkRes())
  t('PUT 未支持 → 拒绝', captured !== null && captured.ok === false)
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(`\n${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
