// 工具参数 schema 护栏：宿主要求标准 JSON Schema（`type:"object"`）。
// 由真机故障引入（2026-10-14）：`discipline_tools` 的 `parameters: {}` 被宿主读成 `type:null`，
// 报 "Invalid schema for function 'discipline_gate': schema must be a JSON Schema of 'type: \"object\"'" 并**中断整轮运行**。
// 护栏：任何工具的参数 schema 不是对象形态 → 本套件直接红。
import { buildGateToolDefinition, buildTaskToolDefinition, buildToolsCatalogDefinition } from '../src/shisan-xinuo-core.ts'

const acceptance = { list: () => [], register: () => ({ count: 0 }), clear: () => {}, markPassed: () => {}, evaluate: () => ({ ok: true }) }
const defs = [
  ['discipline_gate', buildGateToolDefinition({ runCmd: async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }), log: () => {}, onStats: () => {}, acceptance })],
  ['discipline_task', buildTaskToolDefinition({ log: () => {}, acceptance })],
  ['discipline_tools', buildToolsCatalogDefinition({ level: () => '', visible: () => [], allow: () => [], deny: () => [], log: () => {} })],
]

let fail = 0
for (const [name, d] of defs) {
  const p = d.parameters
  const ok = !!p && p.type === 'object' && (p.properties === undefined || (typeof p.properties === 'object' && p.properties !== null))
  console.log(ok ? `PASS schema: ${name} parameters 为标准 JSON Schema（type=object）` : `FAIL schema: ${name} parameters 非法：${JSON.stringify(p)}`)
  if (!ok) fail++
}
process.exit(fail > 0 ? 1 : 0)
