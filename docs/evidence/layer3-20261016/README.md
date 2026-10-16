# 层3/D 四臂实验证据（2026-10-16 · 批2 门禁批）

> 结论与判定见 [`docs/design-specs/layer3-quantification-results-20261016.md`](../../design-specs/layer3-quantification-results-20261016.md)；预注册判据（跑前冻结）见 [`layer3-quantification-prereg-20261016.md`](../../design-specs/layer3-quantification-prereg-20261016.md)。

## 内容

| 文件 | 臂 | 环境 | 变量 |
|---|---|---|---|
| `A1-analysis.json` | A1 | exp（裸） | 旧·动态横幅 |
| `A2-analysis.json` | A2 | exp（裸） | 现状·常量横幅 |
| `B1-analysis.json` | B1 | rich（实战） | tool-search 关 |
| `B2-analysis.json` | B2 | rich（实战） | tool-search 开 |

每份=该臂 20 轮长任务的会话聚合（事件计数、系统段字节与指纹、工具调用分布、steer 计数、STEP-*-OK 清单）。
**直接取自原始会话日志的机检聚合**（`scripts/l3exp/analyze-arm.mjs`），不含模型正文、不含凭据。

## 复跑

```bash
node scripts/l3exp/run-arm.mjs A1|A2|B1|B2          # 逐轮独立进程 + --session-id 续会话，20 轮
node scripts/l3exp/analyze-arm.mjs <session.v4.jsonl.zstd> <out.json>
```

装置（overlay）与三档环境见 [`docs/env-matrix-20261016.md`](../../env-matrix-20261016.md)；overlay 内容未入仓，复跑须按预注册 §6 重建。
