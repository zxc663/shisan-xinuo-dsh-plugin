# 外部锚物料 · awesome-dsh-plugin PR 包（内部准备 · 未提交）

> 状态：**内部准备就绪／未提交**。发布/PR/清单收录属**对外动作**，须逐项批。
> ⚠ **前置阻塞（提交前必须解除）**：本仓当前 `package.json` 无 `dsh.bundle` 清单 —— `dsh plugin --profile <p> add <tgz>` 会提示 `declares no dsh.bundle — installed as a plain dependency, not a profile layer`，即**包装上了也不挂层**。awesome 收录的硬要求正是「可安装 bundle」⇒ PR 应在恢复 `dsh.bundle`（并补 `prepack: npm run build`）之后提交。依据见 [`验证库/已知边界与接受风险.md`](../../验证库/已知边界与接受风险.md) §二.1。

## 1. 收录条目（目标路径 `data/plugins/zxc663__shisan-xinuo-dsh-plugin.yml`）

```yaml
url: https://github.com/zxc663/shisan-xinuo-dsh-plugin
name: shisan-xinuo-dsh-plugin
category: <提交前对清单现有分类取值，勿新建分类>
description:
  en: >-
    Runtime governance for DSH agents: L3 risky-operation interception,
    truth-verified closeout (assertion operators evaluated in-plugin, real exit
    codes), acceptance-assertion binding, and an auditable telemetry ledger.
```

必填字段（contributing.md）：`url` / `name` / `category` / `description.en`；**一 PR 最多 3 条**。

## 2. PR 文案

**标题**：`Add shisan-xinuo-dsh-plugin (runtime governance + verified closeout)`

**正文要点**：

- **解决什么**：agent 的「自述完成」与「真值完成」常不一致。本插件把收口判据移到宿主侧——`discipline_gate` 的断言算子由插件**内联求值**（不过 shell），命令判据取**真实退出码**；并把「已登记验收判据」在回合收尾**自动复核**（全过=收口成立，未过=打回）。
- **可复核**：任何人可跑 `npm test`（含公开文本机检与索引机检）与 `node scripts/claims-check.mjs`（机制级主张）；真机证据与不可复跑部分如实标注（见 [`验证库/README.md`](../../验证库/README.md)）。
- **边界如实**：本插件**不是安全边界**；已知边界、已接受风险与未验证清单见 [`验证库/已知边界与接受风险.md`](../../验证库/已知边界与接受风险.md)。
- **bundle 要求**：`package.json` 声明 `dsh.bundle` 且 `cordis.patch.yml` 与 package.json 同处——**提交前须确认已恢复**。

## 3. 提交前 checklist

- [ ] `dsh.bundle` 清单已恢复，`prepack` 已加（使干净克隆 `npm pack` 可用）。
- [ ] `npm pack` 产物含 `lib/`＋`content/`＋`cordis.patch.yml`；隔离 profile `dsh plugin add <tgz>` **无** "declares no dsh.bundle" 警告。
- [ ] 文档机检 0 违规（`node scripts/check-voice.mjs`）。
- [ ] category 取自清单现有分类。
- [ ] 对外动作获逐项批准。
