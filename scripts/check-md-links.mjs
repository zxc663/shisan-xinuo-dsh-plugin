#!/usr/bin/env node
// 公开面质量机检：仓库内 markdown 的**本地链接**必须可达（无死链）。
// 口径：只查 `](target)` 形态的本地路径（跳过 http(s)／mailto／纯锚点）；带 `#anchor` 的剥离锚点后校验文件/目录存在。
// 用法：node scripts/check-md-links.mjs   （有死链则 exit 1）
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIRS = new Set(['node_modules', '.git', 'logs', 'tmp', '.pnpm-store'])

const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(d, e.name), out)
    } else if (e.name.endsWith('.md')) out.push(join(d, e.name))
  }
  return out
}

const files = walk(repo)
const dangling = []
let checked = 0
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  // 先剥**围栏代码块**与**行内码**——其中的 `](x)` 是示例/字面量，不是链接（自测曾误报 CHANGELOG 的说明文字）。
  const text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    let t = m[1].trim()
    if (/^(https?:|mailto:|#)/i.test(t)) continue
    t = t.split('#')[0]
    if (!t) continue
    try {
      t = decodeURIComponent(t)
    } catch {
      /* 保留原样 */
    }
    // 可移植性规则（平台无关机检）：仓库内文档不得使用**本机绝对路径**链接（如 Windows 盘符）——
    // 此类链接在作者机上"刚好可达"，到其它平台/机器必死（CI 曾因此红 27 处）。 #决策 2026-10-16
    if (/^[A-Za-z]:[\\/]/.test(t)) {
      dangling.push(`${f.slice(repo.length + 1)} → ${m[1]}（本机绝对路径，不可移植）`)
      continue
    }
    const abs = t.startsWith('/') ? join(repo, t) : resolve(dirname(f), t)
    checked++
    try {
      statSync(abs)
    } catch {
      dangling.push(`${f.slice(repo.length + 1)} → ${m[1]}`)
    }
  }
}

console.log(JSON.stringify({ files: files.length, links: checked, dangling }, null, 2))
process.exit(dangling.length === 0 ? 0 : 1)
