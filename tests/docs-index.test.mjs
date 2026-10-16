// 批7 层6·C6 索引机检接线：docs 索引双向一致（缺口=0/悬挂=0）；脱节即红。
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const r = spawnSync(process.execPath, [join(repo, 'scripts', 'check-docs-index.mjs')], { encoding: 'utf8' })
let j = null
try {
  j = JSON.parse(String(r.stdout))
} catch {
  /* 解析失败按失败处理 */
}
let fail = 0
const t = (name, cond) => {
  if (!cond) {
    fail++
    console.log('FAIL: ' + name)
  }
}
t('索引机检 exit=0', r.status === 0)
t('解析出结果', j !== null)
t('缺口=0', j && j.missing.length === 0)
t('悬挂=0', j && j.dangling.length === 0)
if (j) console.log(`docs-index: docs=${j.docs} missing=${j.missing.length} dangling=${j.dangling.length}`)
console.log(fail === 0 ? 'ALL PASS (docs-index)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
