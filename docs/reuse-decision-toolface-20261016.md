# 复用决策：工具面（tool-face）——上游 A/B 实测档（2026-10-16）

> 沿用 reuse-decision 模板口径。结论状态：**冒烟级证据已取，会话级 A/B 未跑**（程序在下，随时可续）。

## 1. 候选与冒烟结果（npm 实装实测，2026-10-16）

| 候选 | 版本 | 安装 | peer 兼容（运行中 DSH=0.2.0-rc.2） | 结构要点 | 冒烟判定 |
|---|---|---|---|---|---|
| Letter2025/dsh-tool-search | 0.1.7（npm，月下 1,950，当日仍提交） | ✅ 干净 | ✅ 精确 `^0.2.0-rc.2` 全套（agent/llm/session/skill/system-prompt/tools） | lib/ 编译产物+d.ts、cordis.patch.yml、DESIGN.md、检索=BM25+CJK 二元分词、monotonic guard、事件溯源恢复 | **A 组首选**（分发最成熟） |
| studyzy/@studyzy/dsh-lazy-tools | 0.0.1（dshbase 已验证） | ✅ 干净 | ✅ 精确 `0.2.0-rc.2`；engines `^22.19\|\|>=24` 匹配本机 24.18 | index.js+**client.js（浏览器半=设置卡片）**、cordis.patch.yml；纯暴露层（不改注册表）、用量自动调优 | **B 组首选**（架构对齐 boot-time 稳定面+带 UI 半） |
| vibeinging/dsh-tool-search | 未发布 | — | — | KV cache 量化分析有价值（首次选择后仅剩 ~2% 前缀）；代码不可依赖 | 只抄设计 |
| Yan-Zero/dsh-progressive-tools | 单日项目已死 | — | — | Schema 注入在历史结果位置=缓存语义最正确，但依赖 pi-ai 内部包装 | 等 DSH 主线 transform hook |
| ysr666/dsh-vision-router（文档） | 3.0.3，1,151★ | — | — | progressive-tools-cache.md=「boot-time 稳定+渐进仅 opt-in+默认值双重加固」权威论据 | 论据引用 |

## 2. 待跑：会话级 A/B 程序（时间盒 ~1h）

1. 备份 `D:\ai本地模型\dsh\profiles\desktop\cordis.patch.yml` → 挂 A（dsh-tool-search）→ 重启 DSH → headless 探针会话（模型固定 glm-4.5-flash）：量 tools-wire chars（exec-log）、一次检索成本、guard 共存性（本插件 ctx.tools.guard 同轮不冲突）→ 截图+遥测。
2. 卸 A 挂 B，同表重测（+设置卡片渲染截图）。
3. 对照本插件现役运行时裁剪（同会话基线已实测：30→10 工具，GUI 实拍「移除 20 个」）。
4. 裁决表：Windows 兼容（两包均纯 TS，理论 ✓）/token 实值/共存性三列，数据定去留；自研运行时裁剪逻辑随后退役（保留 guard 层与目录工具，披露层让位上游）。

## 3. Tier 2 裁决（GO 套餐接入，已完成查证）

- **官方允许第三方使用 Go 套餐**：opencode.ai/docs/go 明文（自报 UA、典型 coding agent 流量、每会话稳定 `x-opencode-session`；2026-09 起缺 header=400 MissingSessionID）。
- **DSH 已被官方点名**：v2 docs Known Problematic Clients 原文承认识别 DSH 原生 header、差部分 adapter 路径（Discussion #5495）。
- **现成解**：npm `dsh-opencode-session` 0.1.1（llm/stream waterfall+patch fetch 注入 header，已有头不覆盖）——装机一行，**无需自研反代**。
- OFM 池 7+ OpenCode 背书模型（deepseek-v4.1-flash-free 等）同门禁同理可解。
- **ToS 红线**：多账号池化/伪装官方客户端/转售=termination 条款；避开 multi-auth 类项目。

## 4. 复用 vs 自研定案

- 让位：运行时工具裁剪（本插件 budget/mask 层）→ 上游披露插件（A/B 数据定谁）。
- 保留自研：治理面（gate/steer/assert/断言桥/guard 接线/遥测对账）——**生态无更好上游**（agent-discipline/reliability-governor 均提示段级）。
- 组合件（治理-披露联动、计分板不出模型面）= 真空白，即本插件差异化价值。
