# 桌面会话拒载事故 · 证据（2026-10-16）

事故：桌面档 dev-mount 临时直挂 `permission-rules` → 会话日志含未标记的 `permissionRules/decision` 审计行 → 宿主读路径拒载整条日志（resume 红字）。
修复：撤除直挂 ＋ 上游 `repair-session-logs.mjs repair` 给历史行补 `ignorable` 标记（18/18，复扫 0）。

| 文件 | 内容 |
|---|---|
| `before-red-error.png` | 修复前：桌面 App 选中该会话时的红字横幅（用户提交原图存档） |
| `after-restart.png` | 修复后（App 重启）：同一会话正常渲染、无红字 |
| `opencode-go-docs.html` | 官方 `opencode.ai/docs/go` 实时页面存档（免费模型口径／价格表／端点表；用于核对 GO 反代模型面） |

- 修复步骤与验收判据：`docs/gui-verification-protocol-20261013.md` §5.3
- 模型面实测（`/models` 列表、免费档探针、`deepseek-v4.1-flash-free` 400 与 longcat 200 对照组）：`memory/agent-log.md` 流水区 2026-10-16 13:0x 条
