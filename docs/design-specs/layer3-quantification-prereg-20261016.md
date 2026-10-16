# 层3 量化实验预注册（C1 前缀稳定性 / D1 工具面披露 · 长任务）· 2026-10-16

> 性质：批2（门禁批）预注册档——**冻结后开跑**（冻结=本档提交）；结果档另立。
> 关联：`docs/findings-20261016.md` §3 层3/§5 未定论；`docs/env-matrix-20261016.md`（三档装置）。
> 上位原则：外部工具优先＋信任可传递（结论须"别人能自己重跑"或注明不可复跑原因）。

## 1. 问题与假设

- **H1（C1·前缀稳定性）**：动态状态横幅（旧形态）会驱动宿主 in-history 系统段更新（每轮新增/替换 system 消息）并抬高会话字节；常量横幅（现状）应显著收敛。
  - 支持判据：A1 的 `system/message` 事件数 ≥ 2×A2，且 A1 系统段总字节 ≥ 1.2×A2。
- **H2（D1·工具面披露）**：上游披露件（tool-search）在**长任务**中把模型可见工具面收敛到远小于自研掩码/全量面，且不显著拖累任务完成。
  - 支持判据：B2 的 `tools-wire` 字符数 ≤ 0.25×B1，且 B2 完成率（STEP-*-OK 去重数 /20）≥ B1−20%，且 B2 平均每轮耗时 ≤ 1.5×B1。
- **H3（收口链旁证）**：四臂的 `steer`/`discipline_gate` 调用计数，作为批3（方向 A）与批5（方向 C）的基线对照（非主判据）。

## 2. 设计（四臂，含混淆对照）

| 臂 | 环境/装置 | 核心 | 披露面 | 掩码 | 目的 |
|---|---|---|---|---|---|
| A1 | `dsh-exp-home/exp1`（裸档 rc.2；GO 反代+免费档模型） | 旧核心（`2dc43bb` 取出，动态横幅） | 无 | `SHISANUO_BUDGET_LEVEL=L2-S` | H1 对照 |
| A2 | 同上 | 现状核心（工作树，常量横幅） | 无 | 同上 | H1 对照 |
| B1 | `dsh-rich-home/rich1`（代表集：permission-rules/tool-search/hooks 桥/tool-cordis＋本插件） | 现状核心（bundle 安装） | tool-search **关** | 无 | H2 对照 |
| B2 | 同上 | 同上 | tool-search **开** | 无 | H2 对照 |

- 模型=免费档 `step-5-preview-free`（同链：dshgo 会话头插件＋反代 provider）；每臂 n=1；同脚本、同 cwd 结构。
- 任务脚本（20 轮，逐轮独立进程 + `--session-id` 续会话）：
  `第k步：用 write 创建 <work>/step_k.txt（内容 step-k）；调用 discipline_gate（assert=exists:<work>/step_k.txt）收口；仅回复 STEP-k-OK。`
  （work 目录随臂隔离；首轮建会话，其后 `--session-id` 续跑。）

## 3. 指标（可测优先）

- 系统段：`system/message` 事件数 / 去重 SHA 数 / 系统段总字节（会话日志解码）。
- 工具面：`tools-wire`（count/chars，exec-log 按 sid）；`tools-inventory`；tool/call 直方图（含 `tool_search`/`discipline_gate` 次数）。
- 任务：完成率（去重 STEP-*-OK/20）、每轮耗时分布、总时长、退出码分布。
- 收口：`steer` 计数（含收口强制前缀的用户侧消息）、gate 调用数、行为行（gate=…）。

## 4. 判据与决策规则（冻结，不得见数后再改）

- H1 支持 → 常量横幅按现状保留（已在批一落地）；不支持 → 如实记录"C1 收益未证"。
- H2 支持 → 批4（方向 B）按计划推进（tool-search 承披露＋`discipline_*` 常驻清单）；完成率或耗时不满足 → 标"长任务风险"，批4 必带 core 常驻清单并复评。
- H3 仅作基线留档。

## 5. 已知边界（如实）

- `cached_tokens%` **不可测**（provider 计费口径缺，见 findings §5）——以"系统段事件数/字节、会话总字节、耗时"为代理。
- 四臂环境不完全同构（B 臂自带代表集插件的提示面贡献）——B1/B2 仅差 tool-search 开关，H2 比较成立；A/B 间不直接横比。
- n=1/臂；模型与网络波动未消除；脚本刻意等构（每轮同形状）以降低方差。

## 6. 复跑命令（信任可传递）

```bash
node scripts/l3exp/run-arm.mjs A1   # 及 A2 / B1 / B2（各 20 轮）
node scripts/l3exp/analyze-arm.mjs <该臂 session.v4.jsonl.zstd> <out.json>
```
运行产物：`<home>/runs/<arm>/`（逐轮输出与 turns.jsonl）；分析产物落各臂 `analysis.json`。

## 7. 冻结

- 本档提交即冻结（2026-10-16）；其后如需变更，按"预注册变更透明"记：旧版问题/修改/依据/时间/已观察结果/新确认起点。
