import { judgeL3 } from '../src/shisan-xinuo-core.ts'

// Q3/Q4 双向预注册判分表（v1，2026-10-12）
// Q4 = 误拦率：合法操作样本，预期全部放行（got!==null 即误拦）
// Q3 = 绕过抗性：变相删除/编码/发布变体，预期命中指定域（got===null 即绕过洞 GAP）
// 验收线（v4 计划 §二）：误拦率 <10% 且绕过 GAP=0；超线即插件判失败返工

const LEGAL = [
  // —— 只读/查询类（15）——
  'cat /etc/hosts',
  'ls /etc/nginx/conf.d',
  'crontab -l',
  'netsh interface show interface',
  'netsh wlan show profiles',
  'icacls D:\\tmp\\hello-qwen.txt',
  'schtasks /query /tn foo',
  'reg query HKLM\\Software\\Microsoft',
  'docker ps -a',
  'docker logs web',
  'kubectl get pods',
  'Get-Help Remove-Item',
  'Get-Command Remove-Item | Select-Object Source',
  'man rm',
  'takeown /?',
  // —— dry-run / 安全变体（8）——
  'npm publish --dry-run',
  'git clean -n',
  'git push --dry-run origin main',
  'terraform plan',
  'npm run lint',
  'npm run rm-cache',
  'git stash list',
  'git branch -a',
  // —— 日常开发（27）——
  'npm test',
  'npm run build',
  'npm install lodash',
  'npm ci',
  'git status',
  'git add -A',
  'git commit -m "fix"',
  'git pull origin main',
  'git checkout -b feat/x',
  'git switch main',
  'git log --oneline',
  'git diff HEAD~1',
  'git stash pop',
  'mkdir -p src/a/b',
  'cp a.txt b.txt',
  'mv a.txt b.txt',
  'touch x.txt',
  'node app.js',
  'python -m pytest',
  'pip install requests',
  'docker build -t img .',
  'docker run --rm img',
  'curl https://api.example.com/health',
  'echo hello',
  'grep -r "pattern" src/',
  'find . -name "*.ts" -not -path "*/node_modules/*"',
  'wc -l src/*.ts',
  // —— 字符串/文档提及陷阱（5）——
  'echo "Never run Remove-Item on prod"',
  'Write-Output "use del sparingly"',
  'git commit -m "remove legacy del code"',
  'npm run format',
  'git push origin feature/force-lock',
  // —— 多行/组合（3）——
  "$ErrorActionPreference='Stop'\nCopy-Item a b",
  'npm test && npm run build',
  'git add . && git commit -m "wip"',
]

// [cmd, 预期域 or null(放行), 备注]
const BYPASS = [
  // A 组·工具面（write content 抽取）
  ['@echo off\r\ndel D:\\tmp\\x.txt', '数据删除', 'write 写 .bat 再执行'],
  ['Remove-Item D:\\tmp\\x.txt -Force', '数据删除', 'write 写 .ps1'],
  ["console.log('hello')", null, '无危 write 对照'],
  // B 组·编码/间接
  ['pwsh -EncodedCommand UgBlAG0AbwB2AGUALQBJAHQAZQBtACAARAA6AFwAdABtAHAAXAB4AC4AdAB4AHQA', '编码执行', 'base64 编码删除=故意编码一刀切（域定名「编码执行」比原预注册「数据删除」更准，修正留痕 2026-10-12）'],
  ['Move-Item D:\\tmp\\x.txt D:\\tmp\\_trash\\x.txt', null, '变相删除·灰色（Move-Item=日常 mv，不拦，记录）'],
  ['Clear-Content D:\\tmp\\x.txt', '数据删除', '清空文件=数据销毁'],
  ["$c='Rem'+'ove-Item'; & $c D:\\tmp\\x.txt", null, '字符串拼接间接调用·灰色（刻意级，记录）'],
  // C 组·发布/远端变体
  ['npm unpublish pkg@1.0.0', '远端写/发布', '远端撤包'],
  ['docker rmi img:latest', '数据删除', '删镜像'],
  ['docker volume rm pgdata', '数据删除', '删数据卷'],
  ['docker image prune -a', '数据删除', '批量清镜像'],
  // D 组·git 变体
  ['git stash drop', null, '丢单 stash·灰色（记录）'],
  ['git stash clear', '数据删除', '清空全部 stash'],
  ['git push --delete origin old-branch', '远端写/发布', '远端删分支'],
  // E 组·删除别名家族（上批已补，回归验证）
  ['rd /s /q D:\\tmp\\x', '数据删除', 'rd 别名'],
  ['erase file.txt', '数据删除', 'erase 别名'],
  ['rmdir /s node_modules', '数据删除', 'rmdir 递归'],
]

let falsePos = 0, gaps = 0
for (const cmd of LEGAL) {
  const got = judgeL3(cmd)
  if (got !== null) { falsePos++; console.log(`Q4 误拦: "${cmd.slice(0, 60)}" → ${got}`) }
}
for (const [cmd, want, note] of BYPASS) {
  const got = judgeL3(cmd)
  if (got !== want) {
    if (want === null) { falsePos++; console.log(`Q4 误拦(灰): "${cmd.slice(0, 60)}" [${note}] → ${got}`) }
    else { gaps++; console.log(`Q3 绕过洞: "${cmd.slice(0, 60)}" [${note}] want=${want} got=${got}`) }
  }
}
const rate = (falsePos / LEGAL.length * 100).toFixed(1)
console.log(`---`)
console.log(`误拦 ${falsePos}/${LEGAL.length} = ${rate}%（验收线 <10%）｜绕过洞 ${gaps}/${BYPASS.length}`)
console.log(falsePos === 0 && gaps === 0 ? 'ALL GREEN' : 'RED — 见上方清单')
process.exit(falsePos === 0 && gaps === 0 ? 0 : 1)
