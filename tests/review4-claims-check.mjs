// 第四份审查断言核验：--dry-run 豁免 bug + 10 个新拦截面 GAP
import { judgeL3 } from '../src/shisan-xinuo-core.ts'

console.log('=== 断言A: --dry-run 豁免全文匹配 bug ===')
const dryrun = [
  ['--dry-run rm -rf /var', true],           // 审查样本：应拦（--dry-run 在危险动词前=豁免攻击）
  ['git clean --dry-run -f', false],          // 合法 dry-run：应放行
  ['rm -rf /var --dry-run', false],           // --dry-run 在末尾=rm 的标志位（rm 报错退出，无害）→ 语义修正后放行正确
]
for (const [cmd, shouldBlock] of dryrun) {
  const hit = judgeL3(cmd)
  const blocked = hit !== null
  const ok = blocked === shouldBlock
  console.log(`${ok ? 'OK ' : 'BUG'} ${cmd.slice(0,45)} → ${hit ?? '放行'} (期望${shouldBlock ? '拦' : '放行'})`)
}

console.log('=== 断言B: 10 个拦截面 GAP ===')
const gaps = [
  ['find / -name "*.log" -delete', 'find-delete'],
  ['truncate -s 0 important.db', 'truncate'],
  ['mv important.db /dev/null', 'mv-devnull'],
  ['> db.sqlite', '重定向覆写'],
  ['git checkout -- .', 'git-checkout-discard'],
  ['git stash drop', 'git-stash-drop'],
  ['kubectl delete ns prod', 'kubectl-delete'],
  ['chmod -R 000 /home/user', 'chmod-000'],
  ['curl -X DELETE https://api.example.com/items', 'curl-delete'],
  ['node -e "require(\'fs\').writeFileSync(\'x\', \'\')"', 'node-write-empty'],
]
let misses = []
for (const [cmd, label] of gaps) {
  const hit = judgeL3(cmd)
  if (hit === null) misses.push(label)
  console.log(`${hit ? '拦' : '不拦'} ${label}`)
}
console.log(`\n结论：dry-run bug 需人工判读；GAP 未闭 ${miss.length}/10 → ${misses.join(', ')}`)
