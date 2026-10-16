# 层3/D 量化实验结果（批2 门禁批 · 2026-10-16）

> 预注册判据：`docs/design-specs/layer3-quantification-prereg-20261016.md`（四臂 A1/A2/B1/B2，冻结于 `05cf7b3`）。
> 上位原则：外部工具优先＋信任可传递（结论须"别人能自己重跑"或注明不可复跑原因）。
> 默认模型：`step-5-preview-free`（dsh-go 反代，provider 与 header 注入经 GUI 与 headless 双侧实证）。

## 1. 结论摘要

- **H1（常量横幅 vs 动态横幅）＝支持**：常量横幅把系统段字节从 239,340 压到 4,082（−98.3%），distinct 系统消息 3→1，行为一致（20/20、steer 0）。**真实用量补测（同日，§2b）：缓存命中 91.7%→97.3%（+5.6pt）、未缓存输入 −66%**——动态横幅是实打实的 token 税，常量化方向正确。
- **H2（tool-search 披露的长任务影响）＝可量化代价、收口无损**：开启后每轮注入 runtime-context 快照（1→40 条/全程）与 tool-search 披露（20 条），墙钟 564s→832s（+47.5%），但 20/20 收口、steer=0；模型实际只调用 tool_search 1 次。**真实用量补测：缓存命中 94.6%→90.9%（−3.7pt）、未缓存输入 +248%、总 token +105%**——披露的代价不止墙钟，还有**缓存税**。放行方向 B，但文档须同时标注墙钟与缓存成本。
- **H3（收口旁证）＝成立**：四臂 stepOK 全 20/20、steer 全 0。本批同时修掉了 rich 档暴露的两个真 bug（hooks 桥工具链崩溃＋steer 消息缺身份），修复后 B1/B2 全绿，即旁证收口链路的**会话恢复不再 corrupt**。

## 2. 四臂结果表

| 臂 | 环境 | 变量 | events | sysEvents | distinctSys | sysBytes | toolCalls | steer | stepOK | 墙钟 |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | exp（裸） | 旧·动态横幅 | 508 | 60 | 3 | 239,340 | write20+gate20 | 0 | 20 | 444s |
| A2 | exp（裸） | 现状·常量 | 415 | 1 | 1 | 4,082 | write20+gate20 | 0 | 20 | 498s |
| B1 | rich（实战） | tool-search 关 | 546 | 40 | 2 | 158,240 | write20+gate20 | 0 | 20 | 564s |
| B2 | rich（实战） | tool-search 开 | 592 | 40 | 2 | 158,240 | write21+tool_search1+gate20 | 0 | 20 | 832s |

### 2b. 真实用量与缓存（2026-10-16 补测；原「代理口径」作废）

> 背景：批2 跑分时按预注册把 `cached_tokens%` 记为**不可测**（当时会话日志无用量字段），以 `systemBytes` 作代理。**同日复核发现宿主现已回传 `usage`（含 `cacheReadTokens`）**，故改为真测；四臂证据（`docs/evidence/layer3-20261016/*-analysis.json`）已刷新为含 `usage` 的版本。

| 臂 | 变量 | 请求数 | 未缓存输入 | 缓存读 | 总计 | **缓存命中** |
|---|---|---|---|---|---|---|
| A1 | 旧·动态横幅 | 60 | 69,001 | 761,984 | 837,124 | **91.7%** |
| A2 | 现状·常量 | 62 | 23,385 | 855,872 | 886,000 | **97.3%** |
| B1 | 实战·披露关 | 60 | 115,436 | 2,028,608 | 2,151,920 | **94.6%** |
| B2 | 实战·披露开 | 61 | 401,556 | 4,010,176 | 4,420,539 | **90.9%** |

- 命中率＝`cacheReadTokens /(inputTokens + cacheReadTokens)`；**未缓存输入＝真实需要重新计费的输入**。
- H1 方向复现：常量横幅把未缓存输入砍掉 **66%**（69,001→23,385），命中率 +5.6pt。
- H2 新维度：披露开启把未缓存输入推高 **248%**（115,436→401,556）、总 token +105%——与「每轮 runtime-context 快照打断前缀」的机制一致。

## 3. 逐假设判定

### H1：常量横幅 vs 动态横幅（A1 vs A2）

- 判据：系统段字节 −98.3%（239,340→4,082）；distinct 系统消息 3→1；行为一致（20/20、steer 0、工具面 write20+gate20）。
- **判定：支持。** 动态横幅的 token 代价与其收益不成比例，常量形态为现行正确方向。

### H2：tool-search 披露的长任务影响（B1 vs B2）

- user/message：61→100（+39）。分解：B1＝20 步提示＋40 skill-catalog 提醒＋1 runtime-context；B2＝20 步提示＋40 skill-catalog＋40 runtime-context＋20 tool-search 披露（每轮注入）。
- 实际检索：tool_search 仅调用 1 次（20 轮中）；write 21（多 1 次）。
- 墙钟：564s→832s（+47.5%）；events：546→592（+8.4%）。
- **判定：代价可量化（墙钟 +47.5%）、收口无损（20/20、steer=0）。** 披露机制＝每轮 runtime-context 快照＋tool-search 披露文本，而非检索结果回填（检索只发生 1 次）。方向 B 放行，落地时把"墙钟成本"写入工具面说明。

### H3：收口旁证

- 四臂 stepOK 20/20、steer 0；B1/B2 会话续跑（--session-id）无 `corrupt`、无 `lacks an identified message`。
- **判定：成立。** 本批两项修复（见 §4）是 H3 成立的前置：修复前 B1 turn2-20 全部 `corrupt` 退出，修复后全绿。

## 4. 本批装置与修复（不可复跑前提的消除）

1. **hooks 桥排除**：`@deepseek-ai/dsh-hooks-claude-code@0.0.1-rc.5` 在 rc.2 上使工具链崩溃（`agent.session.events is not iterable`；证据 probe-P1 exit0 / probe-P2 崩）。B1/B2 改用 `D:/tmp/rich-no-hooks.yml`（仅 tool-cordis）。
2. **steer/inject 消息身份修复**（commit `e7881cc`）：`userMessage()` 统一补 `id`＋`role`＋`source.kind`，满足宿主 `assertMessageEventShape` 的恢复校验，消除任何 steer 后会话恢复 `corrupt` 的根因。

## 5. 复跑命令（信任可传递）

```text
node scripts/l3exp/run-arm.mjs A1
node scripts/l3exp/run-arm.mjs A2
node scripts/l3exp/run-arm.mjs B1
node scripts/l3exp/run-arm.mjs B2
node scripts/l3exp/analyze-arm.mjs <session.v4.jsonl.zstd> <out.json>
```

装置：`D:/tmp/dshgo-base-overlay.yml`、`dshgo-step5-overlay.yml`、`rich-no-hooks.yml`、`l3exp/arm-a1-old.yml`、`arm-a2-cur.yml`、`arm-b1-ts-off.yml`（dev-only 实验基建；overlay 内容未入仓，复跑须按预注册 §6 重建）。

## 6. 边界与未验证

- ~~`cached_tokens%` 不可测~~ → **已转真测**（2026-10-16 补测，见 §2b）：宿主 `usage.cacheReadTokens` 可用；原「代理口径」作废，保留在预注册档作为当时的记录。
- 四臂均为 `step-5-preview-free` 单模型、单一 20 轮任务形状（write+gate）；结论不推广到其它任务形状或模型。
- B2 多出的 1 次 write 属模型自发行为，未逐条溯源；不影响收口判定。
