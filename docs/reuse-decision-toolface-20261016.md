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

## 2. 会话级 A/B 实测结果（2026-10-16 goal 批，headless + --patch 隔离，模型=glm-4.5-flash 免费档，零配置侵入）

| 组 | 常驻工具 | wire chars | vs 基线 | 启动告警 | 治理链共存（gate 穿越实测） |
|---|---|---|---|---|---|
| 基线（仅本插件） | 27 | 21,605 | — | — | — |
| **A：Letter2025/dsh-tool-search 0.1.7** | **7** | **3,374** | **−84.4%** | 无 | ✅ 模型 tool_search 发现 discipline_gate → 解锁注入（7→9）→ 真实调用 `gate-tool status=pass`（assert 通道） |
| B：studyzy/@studyzy/dsh-lazy-tools 0.0.1 | 10 | 5,761 | −73.3% | 无 | ✅ `gate-tool pass`×3；模型还自发使用 summary 语义（本插件 A4 横幅文案生效佐证） |

实测方法：`DSH_HOME=headless-home dsh --profile headless --patch <overlay.yml> "<任务>"`——overlay 用 file:// URL 直指 /tmp 安装树（**包根会 failed to import，必须指到 lib/index.js 入口文件**），零接触现有配置；测量仪=本插件 tools-wire 遥测（B2 的 instanceId/sid 区分三次运行）。

**裁决（数据定案）**：
- **采纳 Letter2025 为主**：折叠率最高（−84.4%）、发现→解锁→调用闭环真机验证通过、npm 1,950/月+当日活跃、monotonic guard 与本插件 guard 层同向。
- studyzy 留作备选：−73.3% 也不错+设置卡片+不改注册表；0.0.1 太早期。
- **本插件运行时裁剪（budget/mask 层）确认退役路线**：披露减法让位上游，保留治理面（gate/assert/断言桥/guard 接线/遥测对账）与目录工具如实上报。退役执行=独立批次（含 budget 测试套件改写）。
- 治理工具被折叠**不构成风险**：A 组实测 gate 可被 search 发现并解锁后真实调用。

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
