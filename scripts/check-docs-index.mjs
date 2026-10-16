#!/usr/bin/env node
// 批7 层6·C6 索引机检：docs/**.md ↔ docs/README.md 索引**双向一致**——
// ①每个 docs 下 .md（除 README.md 自身）必须被索引（按相对路径或文件名）；②索引中每个反引号 `*.md` 引用必须真实存在。
// 口径：缺口=0 且悬挂=0 才 exit 0。用法：node scripts/check-docs-index.mjs
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = join(repo, 'docs')
const indexPath = join(docsDir, 'README.md')

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name)
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : []
  })

const docs = walk(docsDir).filter((p) => p !== indexPath)
const idx = readFileSync(indexPath, 'utf8')
const relOf = (p) => relative(docsDir, p).replace(/\\/g, '/')

// ① 缺口：docs 下每个 .md 须被索引（相对路径或文件名）
const missing = docs.filter((p) => {
  const rel = relOf(p)
  const base = rel.split('/').pop()
  return !idx.includes(rel) && !idx.includes(base)
}).map(relOf)

// ② 悬挂：索引内反引号 `*.md` 引用须真实存在
const refs = [...idx.matchAll(/`([^`]+\.md)`/g)].map((m) => m[1])
const dangling = [...new Set(refs)].filter((r) => {
  try {
    return !statSync(join(docsDir, r)).isFile()
  } catch {
    return true
  }
})

console.log(JSON.stringify({ docs: docs.length, missing, dangling }, null, 2))
process.exit(missing.length === 0 && dangling.length === 0 ? 0 : 1)
