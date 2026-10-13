#!/usr/bin/env node
// 全量测试运行器（跨平台；审计 F-09：统一本地与 CI 入口，替代 bash for 循环）
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = ['tests', 'test']
  .flatMap((d) => {
    try { return readdirSync(join(repo, d)).filter((f) => f.endsWith('.test.mjs')).map((f) => join(repo, d, f)) } catch { return [] }
  })
  .sort()

let failed = 0
for (const f of files) {
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit' })
  if (r.status !== 0) { failed++; console.error(`FAILED: ${f}`) }
}
console.log(`\n=== run-all-tests: ${files.length - failed}/${files.length} suites passed ===`)
process.exit(failed ? 1 : 0)
