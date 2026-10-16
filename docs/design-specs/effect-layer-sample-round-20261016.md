# effect 层样本轮（A/B 对照）· 2026-10-16

> 目的：量化「窄版宿主默认判据」（`effect` 层）的指标变化——该机制落地时标注为「指标变化待样本轮实测（未验证）」。
> 装置：headless（`dsh-cli-0.2.0-rc.2`，隔离档 `exp1` + `dsh-exp-home`）＋工作树源挂载（`D:/tmp/l3exp/arm-a2-cur.yml`）＋GO 反代免费档 `longcat-2.5-preview-free`（验证运行口径）。
> 记账口径（防混计）：目标级 `auto-closeout`（有已登记断言才跑）与动作级 `effect-closeout`（仅物理副作用）**分列上报**。本轮任务形状为**无注册断言的物理写**——两臂目标级列均为 0，这本身就是分列记账的正例。

## 1. 设计

- 任务形状（每轮）：用 `write` 工具把一行内容写入**绝对路径**单文件 `fe_<k>.txt`；提示词明确「不要调用 discipline_gate」——隔离变量：基线下回合末收口强制 steer 是唯一收口通路，处理组由 effect 层自动收口。
- 臂定义：**E0**＝`SHISANUO_EFFECT_ASSERT=0`（对照/基线）；**E1**＝默认开（处理）。
- 复跑命令（需宿主与免费档配额，**不可外部复跑**，如实标注）：

```bash
EFFECT_TURNS=10 node scripts/l3exp/run-effect-arm.mjs E0
EFFECT_TURNS=10 node scripts/l3exp/run-effect-arm.mjs E1
# 中断续跑：同命令加 EFFECT_RESUME=1（按 runs/<arm>/turns.jsonl 断点、同一会话续接）
```

## 2. 结果（各 10 轮，全部 exit=0；按 pre-execute 证据判定，全部为有效轮）

| 指标（每臂 n=10） | E0（effect 关） | E1（effect 开） |
|---|---|---|
| 有效轮（真实工具调用） | 10/10 | 10/10 |
| `gate-steer`（回合末收口强制） | **10**（mode=no-assertions，1.0/轮） | **0** |
| `effect-closeout`（动作级自动收口） | 0 | **10**（10/10 有效轮） |
| `auto-closeout`（目标级；本形状无注册断言） | 0 | 0 |
| 收口形态（behavior.gate） | `ok-tool`×10（被 steer 逼出 gate 调用） | `ok-effect`×10（宿主自动，零模型往返） |
| gate 工具调用次数 | 10（模型补调） | 0 |
| 物理真值 | `work/effectE0/fe_*.txt` ×10 | `work/effectE1/fe_*.txt` ×10 |
| 墙钟总时长 | 244s（24.4s/轮） | 201s（20.1s/轮，−17.6%） |

- **steer 变化**：1.0/轮 → 0/轮（本例 −100%；为历史基线 `gate-steer=77` 的方向性下降提供受控样本证据）。
- **动作级收口**：10 条 `effect-closeout` 全部对应**真实存在**的文件（`✔ 存在(…fe_k.txt) — 已存在（通过）`）——无误收口。
- **分列记账正例**：两臂目标级 `auto-closeout` 均为 0，动作级只在处理组出现——「把动作落地冒充目标达成」的混计路径在本轮数据下不可发生。
- **记账分列标签实机生效**：`gate-ok via=ok-effect`×10 ＋ `behavior gate=ok-effect`×10（回合级 verdict 不再并入 `ok-auto`）。

## 3. 证据（本机留档）

- 遥测 `logs/exec-log.jsonl`：E1 会话 `session-6b9d5c66-…`（10 `effect-closeout`＋10 `gate-ok via=ok-effect`，0 `gate-steer`）；E0 会话 `session-32fcb511-…`（10 `gate-steer mode=no-assertions`＋10 `gate-tool pass`＋10 `gate-ok via=ok-tool`）。
- 逐轮输出与时长：`D:/ai本地模型/dsh-exp-home/runs/effectE0|E1/turn-*.out.txt`、`turns.jsonl`。
- 物理真值：`D:/ai本地模型/dsh-exp-home/work/effectE0|E1/fe_*.txt`（各 10 个，内容 `step-k`）。

## 4. 边界与批次事故（如实）

1. **绝对路径边界**：effect 层只从**绝对盘符路径**派生断言（`firstAbsolutePath` 口径）；相对路径写入不触发（冒烟实证：退回 `no-assertions` steer）。真实使用时意味着「相对路径的物理写」不回落动作级收口。
2. **弱模型「发言即止」抖动**：本批次曾出现一次事故性运行——单一会话十轮全部「零工具调用、空口 FE-k-OK」（exit=0 但无任何工具调用）。**批次有效性必须以工具调用证据（pre-execute）判定，不能只看退出码或回复文本**；提示词加入「必须实际调用 write 工具」要求后 10/10 有效。
3. **并发事故与会话自证**：运行器被中断后曾出现两个进程并发续写同一会话——宿主会话写锁（`session … is already owned by an active write handle`）直接拒写，会话序列未受损（10 轮 seq 完整）。批次装置随后加入断点续跑（`EFFECT_RESUME`）。
4. **样本限制**：n=10/臂、单模型、单任务形状——用于机制指标方向与量级，不外推为普适效果。

## 5. 结论（可引用口径）

在「无注册断言的物理写」任务形状、受控 A/B（同模型、同提示词、同任务）下：**effect 层把回合末收口强制 steer 从 1.0/轮降到 0，并产出 10/10 动作级自动收口（均对应真实文件），目标级列保持分列（0/0）**。这支持批5 目标的 steer 降幅方向；两列记账纪律在数据上成立。
