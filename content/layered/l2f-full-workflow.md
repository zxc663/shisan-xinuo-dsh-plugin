# L2-F 完整工作流细则

**触发**：判级 L2-F／任何 L3。**强制级**：M（触发即必须加载）。

## 七步主流程（门禁：上一步出口产物不存在不进下一步；无法产出的步写明理由，不得静默跳过）

| 步 | 动作 | 出口产物 |
|---|---|---|
| 1 | 接收指令：任务本质一句话＋判级 | 状态行（中文枚举）＋本质一句话 |
| 2 | 调研实际资源：真实代码+结构/契约+对接真相清单（K1 必填）+模块真实状态+环境盘点（系统+工作区） | 现状事实清单（含文件:行号） |
| 3 | 方案调研：涉及外部依赖/方案选型才联网（成熟方案+可信信号；离线标 degraded-offline）；无外部依赖=跳过并声明；能复用绝不自研 | 调研记录+复用结论 |
| 4 | 复述＋必问：三行复述；分歧按 [clarify-protocol.md](clarify-protocol.md)；方向偏移→提问并结束回合 | 用户确认 |
| 5 | 审查+规划+回滚+登记：产品三问（诉求拆解/返工成本/边界与不做）→ [templates/plan-template.md](templates/plan-template.md) → **失败用例先行**（[templates/acceptance-template.md](templates/acceptance-template.md)：每条**可失败**验收标准的反例＋失败场景＋预期处置）→ [templates/rollback-template.md](templates/rollback-template.md) → discipline_task 登记任务清单与断言 | 规划文档＋失败用例＋回滚点＋登记 |
| 6 | 执行：按分级执行；目标模式自主+节点记录（[templates/task-record-template.md](templates/task-record-template.md)）+超预算自停 | 执行记录 |
| 7 | 收口与归档：最小验证→discipline_gate（断言或 cmd+claimedExit）→承载留档（[templates/carrier-template.md](templates/carrier-template.md)：流水一行+状态段刷新）；用户可见功能面任务加真实用户走查 | 收口证据＋归档 |

## 自检
- 步骤 2 的现状事实清单引用了真实文件:行号，不凭直觉；
- 步骤 5 的验收标准可映射为断言登记（plan-template 要求），或明确声明无可机器判据；
- 步骤 7 走工具真值收口；承载流水时间戳精确到分。

## 边界（不执行的仪式）
- 免：努力预算下限（≥1 检索+澄清+≥3 边界用例）、计划模式 95% 信心照报、会话状态面五段报告、文本 GATE 12 字段。
- 不豁免：L3 停点审批、红线、收口强制、承载留档。
