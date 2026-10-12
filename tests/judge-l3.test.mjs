import { judgeL3 } from '../src/shisan-xinuo-core.ts'

// 预注册判据：正样例必须命中指定域，负样例必须放行
const POS = [
  ['rm -rf /tmp/build', '数据删除'],
  ['git reset --hard origin/main', '数据删除'],
  ['git push --force origin main', '远端写/发布'],
  ['git push -f origin main', '远端写/发布'],
  ['npm publish', '远端写/发布'],
  ['reg add HKLM\\Software\\X /v a', '生产配置写'],
  ['chmod 777 app', '权限变更'],
  ['dd if=img of=/dev/sda', '系统迁移/覆盖'],
]
const NEG = [
  'npm test',
  'git status',
  'git push origin main',
  'ls -la',
  'mkdir -p src/components',
  'npm install',
  'git commit -m "msg"',
  'echo hello',
  'node --version',
  'cat package.json',
]
let fail = 0
for (const [cmd, want] of POS) {
  const got = judgeL3(cmd)
  if (got !== want) { fail++; console.log(`POS FAIL: "${cmd}" want=${want} got=${got}`) }
}
for (const cmd of NEG) {
  const got = judgeL3(cmd)
  if (got !== null) { fail++; console.log(`NEG FAIL: "${cmd}" got=${got}`) }
}
console.log(fail === 0 ? `ALL PASS (pos=${POS.length} neg=${NEG.length})` : `FAILED ${fail}`)
process.exit(fail === 0 ? 0 : 1)
