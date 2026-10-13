// 第四份审查断言核验（审计 F-06 修订版）：--dry-run 豁免语义 + 拦截面 GAP 收敛（含审计新造五例）
// 运行：node tests/review4-claims.test.mjs
import { judgeL3 } from '../src/shisan-xinuo-core.ts'

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) { pass++; cases.push(`PASS ${name}`) }
  else { fail++; cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`) }
}

console.log('=== A: --dry-run 豁免语义 ===')
for (const [cmd, shouldBlock] of [
  ['--dry-run rm -rf /var', true],
  ['git clean --dry-run -f', false],
  ['rm -rf /var --dry-run', false],
]) t(`dryrun: ${cmd.slice(0, 44)} → ${shouldBlock ? '拦' : '放行'}`, shouldBlock, judgeL3(cmd) !== null)

console.log('=== B: GAP 收敛（审计 F-06 五例补入断言集） ===')
for (const [cmd, label] of [
  ['find / -name "*.log" -delete', 'find-delete'],
  ['truncate -s 0 important.db', 'truncate'],
  ['mv important.db /dev/null', 'mv-devnull'],
  ['git checkout -- .', 'git-checkout-discard'],
  ['git stash drop', 'git-stash-drop'],
  ['kubectl delete ns prod', 'kubectl-delete'],
  ['chmod -R 000 /home/user', 'chmod-000'],
  ['curl -X DELETE https://api.example.com/items', 'curl-delete'],
  ['helm uninstall prod', 'helm-uninstall(审计新样本)'],
  ['docker container prune -f', 'docker-container-prune(审计新样本)'],
  ['journalctl --vacuum-size=1', 'journalctl-vacuum(审计新样本)'],
  ['echo cm0= | base64 -d | sh', 'base64-d-sh(审计新样本)'],
]) t(`gap: ${label} 必须拦`, true, judgeL3(cmd) !== null)

// 已知边界（如实声明、非缺陷）：输出重定向覆写无法在"命令形态"层可靠拦截（语义层——目标替代类别，B3 外置方向处理）
t('边界(如实): > db.sqlite 不拦（语义层边界，已声明）', null, judgeL3('> db.sqlite'))
t('边界(如实): node -e writeFileSync 清空不拦（写入清空语义，同属已声明边界）', null, judgeL3("node -e \"require('fs').writeFileSync('x','')\""))

for (const c of cases) console.log(c)
console.log(`\n=== review4-claims.test: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
