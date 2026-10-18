#!/usr/bin/env node
// 工作区文件索引：扫描工作区，记录每个文件的当前状态（相对路径/大小/mtime/分类），
// 输出到 <工作区根>/memory/index/workspace.json。
// 用途：一眼看清工作区有多少文件、哪些是临时垃圾、防止根目录越堆越多。
// 用法：node workspace-index.mjs [工作区根]（缺省=脚本所在包根；幂等，覆盖写）
// 随插件包分发（C5）：可在插件目录对任意工作区执行 `node <插件目录>/scripts/workspace-index.mjs <工作区根>`。
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, relative, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = process.argv[2] !== undefined && process.argv[2] !== ''
  ? resolve(process.argv[2])
  : join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(repo, 'memory', 'index')
const OUT = join(OUT_DIR, 'workspace.json')
const SKIP = new Set(['node_modules', '.git', '.pnpm-store'])

function classify(rel) {
  const p = rel.replace(/\\/g, '/')
  if (p.startsWith('memory/tmp/')) return 'temp'
  if (p.startsWith('memory/logs/')) return 'log'
  if (p.startsWith('memory/artifacts/')) return 'artifact'
  if (p.startsWith('memory/backups/')) return 'backup'
  if (p.startsWith('memory/design/')) return 'design'
  if (p.startsWith('memory/index/')) return 'index'
  if (p.startsWith('src/')) return 'source'
  if (p.startsWith('content/')) return 'content'
  if (p.startsWith('docs/')) return 'doc'
  if (p.startsWith('scripts/')) return 'script'
  if (p.startsWith('tests/') || p.startsWith('test/')) return 'test'
  if (p.startsWith('lib/')) return 'build'
  if (p.startsWith('.github/')) return 'ci'
  const ext = extname(p).toLowerCase()
  if (ext === '.md') return 'doc'
  if (['.json', '.yml', '.yaml', '.toml'].includes(ext)) return 'config'
  return 'root'
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const abs = join(dir, name)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) walk(abs, out)
    else {
      const rel = relative(repo, abs)
      out.push({ path: rel, bytes: st.size, mtime: st.mtime.toISOString(), kind: classify(rel) })
    }
  }
}

const files = []
walk(repo, files)
const byKind = {}
for (const f of files) byKind[f.kind] = (byKind[f.kind] || 0) + 1
const totalBytes = files.reduce((a, f) => a + f.bytes, 0)
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), root: repo, total: files.length, totalBytes, byKind, files }, null, 2) + '\n', 'utf8')
console.log(`workspace-index: ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB → ${relative(repo, OUT)}`)
console.log('byKind:', JSON.stringify(byKind))
