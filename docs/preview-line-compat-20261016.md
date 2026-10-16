# 预览线兼容矩阵 · DSH v0.2.1-alpha.4（批1）· 2026-10-16

> 主绑定仍为 `0.2.0-rc.2`（latest）。本档是「双线兼容」的预览线侧记录；装置见《三档环境矩阵》。
> 目标：我方插件与关键链路在预览线「装得上、跑得动、缝没断」。深度行为探针（turn-stopping 触发链、收口终结、工具面差异、skills 成本、hooks 桥语义）随批2/3 增补。

## 结果

| 项 | 结果 | 证据 |
|---|---|---|
| 建档与基线合成 | ✅ exit 0 / 378 行 | `dump-prev1.txt` |
| 我方插件（file:// 挂载层）合成 | ✅ 行 `shisanxinuo-core` 在 | `dump-prev1-ours.txt` |
| 我方插件**全量运行时装载** | ✅ 全部注册行通过（核心纪律段、状态段、gate/tools/task 工具、L3 与单调守护、收口链） | `run-prevok2.txt` 日志行 |
| GO 反代链路（会话头插件＋反代 provider＋免费档模型） | ✅ exit 0，回复 `PREVOK` | `run-prevok2.txt` |
| 系统段到达 | ✅ `system/message` 含「工程纪律」「纪律状态」两段 | 会话日志解码（`dsh-prev-home/sessions/--D-DeepSeek--/session-47fc7bb4…`） |
| 遥测落账 | ✅ `task-open` / `skill-catalog-cost`(5479 chars) / `tools-wire`(28 工具/22668 chars) / `behavior` 行 | `logs/exec-log.jsonl` |
| 我方插件 **bundle 安装路径**（本地包） | ✅ `plugin add` 成、dump 行在 | `dump-prev1-added.txt` |
| tgz 安装路径 | ⬜ 批6（组装形态工程）覆盖 | — |
| 深缝探针（steer 触发/工具面差异/skills/hooks 语义） | ⬜ 批2/3 增补 | — |

## 观察（alpha 线 vs rc.2）

- 组成树出现新/改名包（示例）：`dsh-plugin-manager`、`dsh-hmr`、`dsh-session-log-deepseek`、`dsh-deepseek-llm-api-extensions`——发布兼容矩阵时需按线列出。
- 凭据缺失的报错文案更可行动（指明凭据服务与环境变量路径）。
- 我方插件**未发现装载面破坏**（零注册失败）。

## 边界

- 本次只做「装得上、跑得动」级；不构成对外兼容承诺（对外宣称待批8 文档终审）。
- 探索使用免费档模型，未消耗付费额度。

