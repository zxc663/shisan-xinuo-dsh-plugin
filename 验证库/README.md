# 验证库（可复跑的证据）

本库回答两个问题：**当前能证明什么**，以及**别人能不能自己重跑一遍**。

## 先读：发行口径

**只有打包好的公开发行版才算真实验证可用。** 本仓当前**无 tag、无 release、无打包产物**（`package.json` 无 `dsh.bundle` 清单，仅 `file://` 开发态加载），且发行暂不进行（先经过实际环境验证）。因此：

- 本库现有证据**全部是开发态证据**，不构成「可用版本」；
- 本库只声明「**机制与过程可复现**」，不声明「产品可用」。

## 三层证据

| 层 | 内容 | 谁能重跑 |
|---|---|---|
| ① 代码级（强） | 20 套单测 + 20 条机制级主张检查 | **任何人**：只要 Node ≥ 22.18，不需要宿主、不需要会话数据 |
| ② 报告级（中） | 预注册、A/B 报告、审计处置、账本对账 | 结论与判据可读；宿主内实验日志不入库，外部不可独立复现（如实标注） |
| ③ 真机级（弱） | 宿主内拦截／审批／收口／界面走查 | 需要宿主与模型配额；本库只提供脚本与协议，不提供可复现的宿主环境 |

## 可重跑命令（①层）

```bash
npm test                                  # 20 套单测（含公开文本机检）；exit 0 = 全绿
node scripts/claims-check.mjs             # 20 条机制级主张；exit 0 = 全部成立
node scripts/tally.mjs --report --freeze  # 出数并冻结快照
node scripts/tally.mjs --check            # 对账；exit 1 = 发现违规
```

**负向控制**：`tmp/mutation-check.mjs` 故意改坏判据 ⇒ 检查器转红。这条用来证明绿灯**携带信息**，不是橡皮章。

## 报告入口

| 关注 | 文件 |
|---|---|
| 完成信号有效性判定 | [docs/validity-report-20261013.md](../docs/validity-report-20261013.md) |
| 四臂对照实验（含干净基线） | [docs/e1-v4-four-arm-report-20261013.md](../docs/e1-v4-four-arm-report-20261013.md) |
| 工程验收 | [docs/v1-acceptance-20261013.md](../docs/v1-acceptance-20261013.md) |
| 第三方审计处置 | [docs/audit-response-20261013.md](../docs/audit-response-20261013.md) |
| 原始数据（可入库部分） | [docs/evidence/](../docs/evidence/) |
| 真机验证协议 | [docs/gui-verification-protocol-20261013.md](../docs/gui-verification-protocol-20261013.md) |
| GO 反代免费模型实测（Tier2 验证基建，2026-10-16） | [docs/go-free-models-probe-20261016.md](../docs/go-free-models-probe-20261016.md) |

## 结论口径：三命题分立

**机制存在（✓）≠ 机制有效（待补样本轮）≠ 产品可用（需打包发行版 + 实际验证）**。把前者读成后者，不在本库的声明范围内。
