#!/usr/bin/env node
// 公开文本机检：工作树文件（默认）或提交信息范围（--commits <A>..<B>）。
// 规则与豁免口径见 CONTRIBUTING.md 的「词汇表」与「机检」两节；退出码：0=通过，1=违规，2=用法。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, extname } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

export const SELF_EXEMPT = new Set(['CONTRIBUTING.md', 'scripts/check-voice.mjs', 'tests/repo-voice.test.mjs'])

export const RULES = [
  { id: 'user-attribution', re: /用户(裁决|拍板|授意|令)/g, hint: '人员归因→改写为「决策：<内容>（依据：…）」' },
  {
    id: 'ai-tool-name',
    re: /\bOpenAI\b(?!-completions)|\b(?:由|经|本机|用|作为|请)\s*(?:Codex|Claude|ChatGPT|ZCode)\b|\b(?:Codex|Claude|ChatGPT|ZCode)\s*(?:生成|编写|撰写|执行|运行|开工|完成|裁决|开发|产出)/gi,
    hint: 'AI 工具具名（执行叙述）→删除或写「开发环境」；对标/竞品机制引用不受限（技术协议名如 openai-completions 亦不受限）',
  },
  { id: 'ai-model-name', re: /\bGPT-?\d/gi, hint: 'AI 模型具名→删除' },
  { id: 'ai-authorship', re: /(由|作为)\s*(AI|模型|人工智能|[Aa]gent)\s*(生成|编写|撰写)|AI\s*(生成|编写|助手)/g, hint: 'AI 生成自述→删除' },
]

const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.zip', '.gz', '.tgz', '.zst', '.zstd',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.wasm', '.node', '.dll', '.exe', '.bin', '.db',
])
const MAX_BYTES = 512 * 1024

export function scanText(text, file = '') {
  const findings = []
  for (const rule of RULES) {
    rule.re.lastIndex = 0
    let m
    while ((m = rule.re.exec(text)) !== null) {
      const idx = m.index
      const line = text.slice(0, idx).split('\n').length
      const lastNl = text.lastIndexOf('\n', idx - 1)
      const col = idx - lastNl
      findings.push({ file, line, col, rule: rule.id, snippet: m[0], hint: rule.hint })
    }
  }
  return findings
}

export function scanTrackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const files = out.split('\0').filter(Boolean)
  const findings = []
  for (const f of files) {
    if (SELF_EXEMPT.has(f)) continue
    if (SKIP_EXT.has(extname(f).toLowerCase())) continue
    let buf
    try {
      buf = readFileSync(join(REPO, f))
    } catch {
      continue
    }
    if (buf.length > MAX_BYTES) continue
    if (buf.includes(0)) continue
    findings.push(...scanText(buf.toString('utf8'), f))
  }
  return findings
}

export function scanCommitRange(range) {
  const parts = String(range || '').split('..')
  const b = parts[1] && parts[1].trim() ? parts[1].trim() : 'HEAD'
  const a = parts[0] && parts[0].trim() && !/^0+$/.test(parts[0].trim()) ? parts[0].trim() : null
  let log
  try {
    log = execFileSync('git', ['log', '--format=%H%x1f%B%x1e', a ? `${a}..${b}` : '-1', ...(a ? [] : [b])], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (e) {
    // 范围不可达（如浅克隆缺 base）→ 退化为仅检查目标提交
    log = execFileSync('git', ['log', '-1', '--format=%H%x1f%B%x1e', b], { cwd: REPO, encoding: 'utf8' })
  }
  const findings = []
  for (const rec of log.split('\x1e').filter((s) => s.trim())) {
    const [sha, ...rest] = rec.split('\x1f')
    const message = rest.join('\x1f').trim()
    const subject = message.split('\n')[0] ?? ''
    const short = String(sha).slice(0, 8)
    for (const f of scanText(message, `${short}（提交信息）`)) findings.push({ ...f, subject })
    if (!/^(Merge\b|Revert\b|fixup!|squash!)/.test(subject) && !/^(feat|fix|docs|test|chore|refactor|perf|build|ci)(\([a-z0-9-]+\))?!?: .+/.test(subject)) {
      findings.push({ file: `${short}（提交信息）`, line: 1, col: 1, rule: 'commit-format', snippet: subject.slice(0, 80), hint: '格式：type(scope): 摘要（见 CONTRIBUTING.md 的提交信息规范）', subject })
    }
  }
  return findings
}

function main() {
  const args = process.argv.slice(2)
  const ci = args.indexOf('--commits')
  let findings
  if (ci >= 0) {
    const range = args[ci + 1]
    if (!range && !args.includes('--allow-missing-range')) {
      console.error('用法：node scripts/check-voice.mjs --commits <A>..<B>（缺失范围时可用 --allow-missing-range 仅查目标提交）')
      process.exit(2)
    }
    findings = scanCommitRange(range || '..HEAD')
  } else {
    findings = scanTrackedFiles()
  }
  if (findings.length === 0) {
    console.log(ci >= 0 ? '校验通过（提交信息范围）' : `校验通过（工作树 ${execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean).length} 个受控文件）`)
    process.exit(0)
  }
  for (const f of findings) {
    console.log(`${f.file}:${f.line}:${f.col} [${f.rule}] ${JSON.stringify(f.snippet)} — ${f.hint}`)
  }
  console.log(`\n共 ${findings.length} 处违规（规则见 CONTRIBUTING.md 的词汇表）`)
  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
