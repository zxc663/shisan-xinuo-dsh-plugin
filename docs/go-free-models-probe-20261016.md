# GO 反代免费模型实测与 dsh-go 可用面（2026-10-16）

> 性质：对「OpenCode GO 套餐免费模型能否被第三方 agent 调用」的实测结案 + dsh-go（DSH 反代面）配置更新记录。
> 方法：官方页面抓取（opencode.ai/docs/go、/docs/zen）→ zen/go 端点实测（GET /models + 逐模型 POST：状态/错误分类/延迟/工具调用/响应形态）→ DSH 双通道真跑（headless CLI + 桌面 GUI）→ dsh-usage.log 账本对账。
> 工具：`scripts/go-probe.mjs`（可重跑，含连续失败挂起；`--both/--tools/--shapes/--speed/--quiet`）。
> 日志：`D:/ai本地模型/dsh/logs/go-probe.log`（JSONL）、`go-probe-state.json`（最新状态）。

## 1. 实测结论表（zen/go/v1；主 home 密钥 OPENCODE_GO_API_KEY；session 头注入）

| 模型 ID | /models 收录 | POST 实测 | 分类 | 备注 |
|---|---|---|---|---|
| longcat-2.5-preview-free | ✓ | 200 | ok | 免费 Unlimited；tools ✓；≈17 tok/s；/responses 400（纯 Chat Completions） |
| step-5-preview-free | ✗（列表滞后） | 200 | ok | 免费 Unlimited；**未收录但可调**；tools ✓；≈25 tok/s |
| cat-jam-free | ✓ | 403 | region | RegionError：中国区不可用 → 已从 dsh-go 移除 |
| deepseek-v4.1-flash-free | ✗ | 400 | model | "Model is unavailable"（仅 OpenCode 客户端内免费，第三方不可用） |
| space-bunny-free 等原生免费 | ✗ | 400/403 | model/auth | Go 密钥不可调用（免费车道门禁） |
| deepseek-v4.1-flash（额度版） | ✓ | 200 | ok | 吃套餐内 $80/月 额度；tools ✓；/responses ✓；≈57 tok/s（三款最快） |

补充：`opencode-go/<id>` 前缀仅 OpenCode 客户端配置格式；第三方 HTTP 须用裸 id（早期 400 的一个来源）。
名单 37 项（去重后以 GET 为准）；限时免费与反滥用监控仍在（免费面随时可能下架/转付费）。

## 2. dsh-go 配置更新（桌面档 cordis.patch.yml）

- 保留：`longcat-2.5-preview-free`（免费、恒在，任意其他模型故障/额度耗尽不影响它）
- 新增：`step-5-preview-free`（免费长上下）、`deepseek-v4.1-flash`（"反代里要有 v4.1"的可用实现）
- 移除：`cat-jam-free`（区域封锁）
- 备份：`cordis.patch.yml.bak-20261016-go-v41`；displayName：OpenCode GO 反代（免费档＋V4.1）

## 3. 证据锚

- 探针两轮（00:42Z / 00:43Z）：分类/延迟/工具/形态全量落 `go-probe.log`
- DSH headless 三跑 exit=0：`V41OK` / `STEP5OK` / `LONGCATOK`（`D:/tmp/goprobe-run/run-*.txt`）
- 桌面 GUI：新会话 5s 完成 `GUI-DSHOK`（截图 `D:/tmp/goprobe-run/gui-run1.png`）
- 账本 `dsh-usage.log`：本次新增 8 条 `provider=dsh-go` 分流（v4.1×2 / step5×2 / longcat×2 / GUI-longcat×2），session 头逐条注入

## 4. 边界与后续

- 已设 6h 静默 heartbeat 探针（automationId=go）：状态变化才通知，无变化不发消息。
- 待办：其他客户端接入实测（Claude Code / Codex / Kilo / Droid / opencode CLI 的 base URL + session 头策略）；慢响应/超时专项。
- 选择器 UI：配置合成与真跑均已验；模型选择器展开面板未用脚本点击复现（合成点击与悬浮层时序问题），不影响功能，手动点开即可见 dsh-go 组三款。

## 5. 关于「伪装客户端 / 绕 IP / 无限」的边界（2026-10-16 晚澄清）

- **区域限制看出口 IP**：cat-jam-free 实测 403 RegionError「This model is not available in your country」（go/inference 两端一致）——UA/身份伪装不改变出口 IP，改不了地区判定；本反代不实现任何绕过访问控制的逻辑。
- **客户端专属是凭据层门禁**：deepseek-v4.1-flash-free 在 inference 端实测 403 FreeTierError「OpenCode's free tier can only be used from within OpenCode」；GO 端 400「Model is unavailable」（第三方网关未路由）。该模型仅 OpenCode 客户端内免费，第三方不可用。
- **「无限」的真实边界**：官方 Unlimited 免费 = LongCat 2.5 Preview Free + Step 5 Preview Free（限时预览、反滥用监控在）；V4.1 Flash = 套餐额度桶（$80/月，5h 20%/周 50%/月 100%），额度用尽后官方规则 = 仍可继续用免费模型（不抢占的兜底）。
- **上下文档位（已写入 dsh-go 与叠加层）**：LongCat/Step5 = 1M；V4.1 Flash = 200K（catalog 口径）。
- **默认模型现状**：桌面默认=Step 5 Preview Free（2026-10-16 08:49 界面上改，配置同步）；如需回 LongCat 改 `agent-default-model` 一处即可。
