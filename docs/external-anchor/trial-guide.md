# 试用指引（外部使用者）

> 目标：让**你**（不是我）能在自己的机器上把它跑起来、看到真实证据、并能独立复核。
> 现状提醒：**本仓当前没有可用发行形态**（`package.json` 无 `dsh.bundle`，装上不挂层）——下列「安装」步骤须在该前提解除后进行；在此之前，仓库内一切主张都是**开发态证据**。

## 1. 你要准备什么

- Node ≥ 22.18（`node -v` 自证）；一台能跑 DSH 的机器（宿主版本按 README 的绑定线）。
- 不需要：宿主内实验日志、会话数据、任何私有凭据。

## 2. 先跑「不需要宿主」的那一层（任何人都能重跑）

```bash
git clone https://github.com/zxc663/shisan-xinuo-dsh-plugin
cd shisan-xinuo-dsh-plugin
npm install
npm test                          # 全部单测 + 公开文本机检 + docs 索引机检；exit 0 = 全绿
node scripts/claims-check.mjs     # 机制级主张逐条成立
```

这一步证明「机制与过程可复现」。它**不**证明「在你的宿主里也生效」。

## 3. 装入你的宿主（前提：发行形态可用）

```bash
dsh plugin --profile <你的档> add <包路径或 tgz>
# 期望：无 "declares no dsh.bundle" 警告；启用后能看到命名空间前缀为 shisanxinuo: 的系统段
```

## 4. 建议你亲自验证的三件事

1. **收口真值**：让 agent 做一件会产生文件变动的事，然后看它是否调用 `discipline_gate`；对照该工具返回的**真实退出码/断言行**与你亲眼所见是否一致。
2. **危险操作拦截**：在标准模式下让它执行一条删除类命令，看是否出审批卡、拒绝后目标是否保留。
3. **不静默**：制造一次「实质回合没收口」，看是否被 `discipline_gate` 打回或收到通知，而不是被悄悄放过。

## 5. 怎么反馈

- 仓库 Issue 表单（Bug／兼容性／文档／设计讨论）与 Discussions 已开启；安全类请走私密披露渠道（见 `SECURITY.md`）。
- 反馈模板见 [feedback-template.md](./feedback-template.md)。
