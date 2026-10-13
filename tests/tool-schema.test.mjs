// 工具参数 schema 护栏：宿主要求标准 JSON Schema（`type:"object"`）。
// 由真机故障引入（2026-10-14）：`discipline_tools` 的 `parameters: {}` 被宿主读成 `type:null`，
// 报 "Invalid schema for function 'discipline_gate': schema must be a JSON Schema of 'type: \"object\"'" 并**中断整轮运行**。
// 护栏：任何工具的参数 schema 不是对象形态 → 本套件直接红。
import { buildGateToolDefinition, buildTaskToolDefinition, buildToolsCatalogDefinition } from '../src/shisan-xinuo-core.ts'

const acceptance = { list: () => [], register: () => ({ count: 0 }), clear: () => {}, markPassed: () => {}, evaluate: () => ({ ok: true }) }
const defs = [
  ['discipline_gate', buildGateToolDefinition({ runCmd: async () => ({ code: 0, stdout: '', stderr: '', timedOut: false }), log: () => {}, onStats: () => {}, acceptance })],
  ['discipline_task', buildTaskToolDefinition({ log: () => {}, acceptance })],
  ['discipline_tools', buildToolsCatalogDefinition({ level: () => '', visible: () => [], allow: () => [], wire: () => [], log: () => {} })],
]

let fail = 0
for (const [name, d] of defs) {
  const p = d.parameters
  const ok = !!p && p.type === 'object' && (p.properties === undefined || (typeof p.properties === 'object' && p.properties !== null))
  console.log(ok ? `PASS schema: ${name} parameters 为标准 JSON Schema（type=object）` : `FAIL schema: ${name} parameters 非法：${JSON.stringify(p)}`)
  if (!ok) fail++
}

// P1 入参面护栏：`assert`（算子判据，插件内联求值、不过 shell）必须出现在 gate 的参数 schema 里，且**可选**
// ——若迁移/改名时把它弄丢，模型就只剩"可执行命令"这一条路（回到 P1 的原始缺口）。
const assertFieldOk = (params) => {
  const props = params?.properties ?? {}
  const required = Array.isArray(params?.required) ? params.required : []
  return Object.prototype.hasOwnProperty.call(props, 'assert') && props.assert?.type === 'string' && !required.includes('assert')
}
{
  const gate = defs.find(([n]) => n === 'discipline_gate')[1]
  const ok = assertFieldOk(gate.parameters)
  console.log(ok ? 'PASS schema: discipline_gate 入参含可选 assert（算子判据；不过 shell 的第二条通道）' : `FAIL schema: discipline_gate 入参 assert 缺失或不可选：${JSON.stringify(gate.parameters?.properties ?? {})}`)
  if (!ok) fail++
  // 判据自测（负向控制）：谓词对"缺 assert / 把 assert 设为必填"的坏样本必须为 false，否则谓词恒真
  const bad1 = assertFieldOk({ type: 'object', properties: { level: { type: 'string' } }, required: ['level'] })
  const bad2 = assertFieldOk({ type: 'object', properties: { assert: { type: 'string' } }, required: ['assert'] })
  const selfOk = bad1 === false && bad2 === false
  console.log(selfOk ? 'PASS schema: 判据自测——assertFieldOk 对缺 assert／assert 必填的坏样本为 false' : `FAIL schema: 判据自测失效（缺字段=${bad1} 必填=${bad2}）`)
  if (!selfOk) fail++
}

process.exit(fail > 0 ? 1 : 0)
