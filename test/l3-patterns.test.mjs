// L3 数据删除/权限变更 正则回归测试（node test/l3-patterns.test.mjs）
const re = /(?<![-\w])rm\s+(?:-\S+\s+)*\S|\bRemove-Item\b|(?:^|[;&|]\s*|\n\s*)(?:del|erase|rd|rmdir|ri)(?:\s+\S|\s*(?:$|[;&|]))|git\s+(?:reset\s+--hard|clean\b)|\bshred\b|\bunlink\b/i

const shouldHit = [
  'Remove-Item D:\\tmp\\test-delete.txt',       // 上一轮漏拦的原案
  'Remove-Item -Recurse -Force C:\\x',
  'rm file.txt',
  'rm -rf /tmp/x',
  'del test.txt',
  'cd /d D:\\tmp && del test.txt',
  'ri file.txt',
  'Get-ChildItem x | ri',
  'git reset --hard',
  'git clean -fd',
  'erase foo',
  'rd /s stuff',
  'rmdir dir',
]

const shouldPass = [
  'docker run --rm -it alpine sh',   // --rm 非删除
  'grep ri file.txt',                // ri 是参数非命令位
  'ls -la',
  'Get-Content notes.txt',
  'npm run format',
  'git push origin main',            // 非 force push
  'chmod 644 file',                  // 非 777
  'Get-Acl x | Format-List',         // 读权限非改权限
  'alarm clock list',                // 词中 rm
  'confirm delete flags',            // 词中 del/rm
]

let fail = 0
for (const c of shouldHit) if (!re.test(c)) { console.log('MISS(hit expected):', c); fail++ }
for (const c of shouldPass) if (re.test(c)) { console.log('FALSE-POSITIVE:', c); fail++ }
console.log(fail === 0 ? `ALL PASS (${shouldHit.length + shouldPass.length} cases)` : `${fail} failures`)
process.exit(fail === 0 ? 0 : 1)
