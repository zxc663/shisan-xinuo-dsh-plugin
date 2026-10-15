# 探针批结果：宿主 API 存在性 + concludeTurn 语义 + outcome-loop 0.2.x 装载（2026-10-15）

> 对应推进库「2026-10-15-三方案重构决策」第一批（P1a/P1b）。方法＝宿主包源静态取证（0.2.0-rc.2 实际绑定线）＋真机 headless 会话（含对照）＋隔离 profile 装载。
> 产物脚本：`tmp/probe_host_api_1015.mjs`（静态）、`tmp/probe_conclude_run.mjs`（会话）；探针输出＝`logs/exec-log.jsonl` probe-conclude 行＋会话日志。

## P1a 结论：五个宿主 API 在 0.2.0-rc.2 全部存在（静态源码取证）

| API | 结论 | 源码证据（dsh-tools/lib/index.js 等） |
|---|---|---|
| `ctx.tools.guard(guard)` | **存在，单调语义确认** | *"Register a monotonic guard after the extensible tools/pre-execute waterfall"*；`guardReason(exec)` 取首个非空 deny；全局/agent.ctx 两级作用域 |
| `ToolExecution.concludeTurn()` | **存在且语义可用（见下）** | `concludeTurn() { concludingExecutions.add(this) }`；材料化时 `concludingExecutions.has(exec)` → 结果带 `concludesTurn:true` |
| `defineTool(options)` | **存在** | 参数 DSL（parameterSchemaSpecToJsonSchema）、timeoutMs 校验、finalizeContent/projectContent 钩子 |
| `workflowEngine` | **存在**（dsh-workflow 包） | `WorkflowEngine extends Service`，服务键 `"workflowEngine"` |
| `ctx.goals` | **存在**（dsh-goal 包） | `GoalService`，服务键 `"goals"`，*"backed exclusively by the owning session log"*，defaultMaxGoalRounds=256 |

另注：宿主包清单中 `dsh-hooks-claude-code`（官方钩子桥）、`dsh-plan-mode`、`dsh-compaction`、`dsh-tool-call-timeout-policy` 均在 0.2.0-rc.2 线上——评审 P0-3/P1-7 引用的官方能力面大体属实。

## P1a-2 concludeTurn：b2「不可用」结论被推翻——根因是我方调用姿势

**三重证据**：

1. **根因（源码+代码对照）**：宿主 `concludeTurn()` 内部 `WeakSet.add(this)`；我方 gate 路径 `const ct = execCtx.concludeTurn; ct()` 解构裸调 → `this=undefined` → `TypeError: Invalid value used in weak set`。b2 报告（§7）记录的报错由此而来，**不是宿主能力缺失**。
2. **确定性探针（真会话）**：新增 `probe_conclude_turn` 探针工具（`SHISANUO_PROBE_TOOLS=conclude` 时注册，方法调用保 this）→ exec-log `probe-conclude status=called`（无异常）。
3. **对照实验（行为语义）**：
   - 探针会话尾部：`assistant/message → tool/call → tool/result → step/end → turn/end`——**工具结果后回合立即终止，模型无收尾发言机会**；
   - 对照会话（普通只读工具）：`tool/result → step/end → step/start → … → assistant/message → turn/end`——正常流程模型还有一段收尾。

**处置（已施工，20/20 测试绿）**：
- `src/shisan-xinuo-core.ts:875` `ct()` → `ct.call(execCtx)`（this 绑定修复）；
- 补齐第二 pass 分支（无断言弱证据分支）缺失的 conclude 块——原仅带断言分支有；弱证据不闭环不标记（与「通过但不闭环」语义一致）；
- 新增 `probe-conclude` 日志 kind 及 tally 白名单项（机检先拦后补，设计如此）。
- 惰性开关维持 `SHISANUO_CONCLUDE_ON_PASS=1`；**收口强制改道 concludeTurn 的前置条件已满足**，替代 steer 的完整改造=方案三第二批施工。

## P1b-1 outcome-loop × 0.2.0-rc.2：默认拒装，豁免可装

- **默认安装＝宿主拒绝**：peer 声明 `dsh-session/storage-domain/session-persistence <0.2.0-0` 与宿主 0.2.0-rc.2 不符；宿主 fail-closed（自动回滚 package.json/lock/node_modules）——**依赖组合路线在 0.2.x 线默认不可行，实测确认版本线漂移是硬边界**。
- **显式豁免通道**：`dsh plugin --profile <p> allow-version dsh-outcome-loop@0.1.0-beta.8 --dsh-version 0.2.0-rc.2 --accept-risk` → 装载成功，bundle patch 三行正确合成（实测）。
- **待核**：豁免装载后的会话级功能（API 兼容性未知，宿主警告「可能崩溃/数据损坏」）；Windows 会话级全链。
- **决策含义**：方案二（分工路线）的三必查第 1 项=**有条件通过**（装载面可走通，功能面待核）；若上游不发 0.2.x 兼容版，长期选项=fork 改 peer 或等待其跟进。

## P1b-3 custom verifier 注入面：源码确认可行（无需 fork）

- `OutcomeLoopService.verifiers = new VerifierRegistry()`（public readonly，service.ts:172）——外部插件经共享 ctx 可达；
- 判据入口：`{kind:'custom', providerId, params}` → `VerifierProviderLike`（id/kinds/observesOnly/executesCommands/networkAccess/producesStrength + `run()` 返回 fact+strength+sensitivity）；
- 我方「三态/资源断言」语义可作为 custom provider 注入，判级映射经 `ctx.outcomeLoop.createContract` 注入契约严格度；
- **待核**：VerifierRegistry.register 方法签名与跨插件 ctx 解析形态（`inject` vs 运行时 get）。

## 对三方案的影响（探针批裁决）

| 方案 | 探针结果 | 下一步 |
|---|---|---|
| 一（guard 归位+发行） | guard 存在→**迁移依据成立**；翻转/指纹补丁可退役 | L3 迁双层+发行批施工 |
| 二（outcome-loop 分工） | 装载=豁免可行；注入面=源码可行 | 豁免会话级功能实测→依赖/fork 决策 |
| 三（宿主一等公民） | 五 API 全在+concludeTurn 语义证实 | 收口强制改道施工（steer 退役候选） |

## 诚实边界

- 静态取证基于打包后 `lib/index.js`（可读未混淆），行为结论以真机会话为准；
- concludeTurn 对照实验 n=1+1（探针/对照各一），建议正式改造前补 n≥3 稳定性；
- probe_conclude_turn 工具与 conclude 补丁已入 src（探针工具默认关，无行为面影响）；
- 本机另有全局 dsh 0.1.0-rc.7（AppData npm）——与实验线 0.2.0-rc.2 并存，注意环境区分。
