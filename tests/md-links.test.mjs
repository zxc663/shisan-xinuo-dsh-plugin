// 公开面质量机检接线：仓库 markdown 本地链接无死链（有则红）。
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const r = spawnSync(process.execPath, [join(repo, 'scripts', 'check-md-links.mjs')], { encoding: 'utf8' })
let j = null
try {
  j = JSON.parse(String(r.stdout))
} catch {
  /* 解析失败按失败处理 */
}
let fail = 0
const t = (n, c) => {
  if (!c) {
    fail++
    console.log('FAIL: ' + n)
  }
}
t('链接机检 exit=0', r.status === 0)
t('解析出结果', j !== null)
t('无死链', j && j.dangling.length === 0)
if (j) {
  console.log(`md-links: files=${j.files} links=${j.links} dangling=${j.dangling.length}`)
  for (const d of j.dangling.slice(0, 20)) console.log('  - ' + d)
}
console.log(fail === 0 ? 'ALL PASS (md-links)' : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
