// 提示词自包含边界回归：插件自身必须携带运行所需规则，不得把外部 Skill 当作前置依赖。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CORE_DISCIPLINE } from '../src/shisan-xinuo-core.ts'

const repo = fileURLToPath(new URL('..', import.meta.url))
const content = readFileSync(join(repo, 'content', 'discipline.md'), 'utf8')
const readme = readFileSync(join(repo, 'README.md'), 'utf8')
const norm = (s) => s.replace(/\r\n/g, '\n').trim()
const checks = [
  ['core: 自包含边界已写入内置提示词', CORE_DISCIPLINE.includes('插件自包含边界')],
  ['content: 自包含边界与内置提示词同步', content.includes('插件自包含边界')],
  ['mirror: content 与 CORE_DISCIPLINE 保持镜像', norm(content) === norm(CORE_DISCIPLINE)],
  ['readme: 明确不依赖外部 Skill', readme.includes('不依赖外部 Skill')],
  ['readme: 外部 Skill 仅为可选参考', readme.includes('外部 Skill 仅可作为可选参考')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\n${checks.length - failed} pass, ${failed} fail`)
if (failed) process.exit(1)
