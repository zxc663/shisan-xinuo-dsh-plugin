// 公开文本机检自测 + 全仓工作树校验（规则与豁免见 CONTRIBUTING.md 的「词汇表」与「机检」两节）。
// 本文件在机检豁免集内（含正样本字符串）；规则行为由函数级断言独立验证。
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { scanText } from '../scripts/check-voice.mjs'

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

let pass = 0
let fail = 0
const cases = []
function t(name, expect, actual) {
  if (JSON.stringify(expect) === JSON.stringify(actual)) {
    pass++
    cases.push(`PASS ${name}`)
  } else {
    fail++
    cases.push(`FAIL ${name}\n  expect=${JSON.stringify(expect)}\n  actual=${JSON.stringify(actual)}`)
  }
}

const hits = (text, rule) => scanText(text).filter((f) => f.rule === rule).length

// 正样本：应命中
t('命中：人员决策归因', 1, hits('本项由用户裁决后执行。', 'user-attribution'))
t('命中：AI 工具具名', 1, hits('由 Codex 完成改造。', 'ai-tool-name'))
t('命中：AI 模型具名', 1, hits('模型 GPT-4 输出的片段。', 'ai-model-name'))
t('命中：AI 生成自述', 1, hits('该文档由模型生成。', 'ai-authorship'))

// 负样本：产品语义不受限
t('放行：产品语义「用户明确确认」', 0, scanText('需要用户明确确认后才能继续。').length)
t('放行：产品语义「用户明示目标」', 0, scanText('用户明示目标/无人值守时按计划自主推进。').length)
t('放行：技术语「agent/turn-stopping」', 0, scanText('监听 agent/turn-stopping 事件。').length)
t('放行：竞品机制对照引用', 0, hits('对照 Claude Code 的 Stop hook 机制做语义细分。', 'ai-tool-name'))
t('放行：技术协议名 openai-completions', 0, hits('请求头按 openai-completions 约定组装。', 'ai-tool-name'))
t('放行：API 端点字面量 openai/v1', 0, hits('BASE_INF = https://opencode.ai/inference/openai/v1', 'ai-tool-name'))
t('命中：AI 工具具名（豁免不影响归因形态）', 1, hits('由 OpenAI 完成。', 'ai-tool-name'))

// 全仓工作树：必须零违规（防复发门禁）
const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'check-voice.mjs')], { cwd: REPO, encoding: 'utf8' })
t('全仓工作树机检通过（exit 0）', 0, r.status)
if (r.status !== 0) console.log(String(r.stdout).slice(0, 2000))

console.log(cases.join('\n'))
console.log(`\n=== repo-voice.test: ${pass} pass / ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
