# 桌面会话拒载事故 · 证据（2026-10-16）

事故：桌面档 dev-mount 临时直挂 `permission-rules` → 会话日志含未标记的 `permissionRules/decision` 审计行 → 宿主读路径拒载整条日志（resume 红字）。
修复：撤除直挂 ＋ 上游 `repair-session-logs.mjs repair` 给历史行补 `ignorable` 标记（18/18，复扫 0）。

| 文件 | 内容 |
|---|---|
| `before-red-error.png` | 修复前：桌面 App 选中该会话时的红字横幅（用户提交原图存档） |
| `after-restart.png` | 修复后（App 重启）：同一会话正常渲染、无红字 |

官方模型面口径的取证：`opencode.ai/docs/go` 实时页面（2026-10-16 抓取），**不入库**——
第三方页面副本不随仓分发（版权与公开面用词两条都要求只留结论）。本机留档：`D:/tmp/probe/opencode-go-docs-20261016.html`。
结论性事实（复核时直接看官方页面即可）：

- 免费档只有两个 ID：`longcat-2.5-preview-free`、`cat-jam-free`（输入/输出/缓存全 Free，月额度 Unlimited，limited time）；
- `cat-jam-free` 的开放区**不含中国**（含港澳）⇒ 本机 403 RegionError；
- `step-5-preview` 在价格表中列为**有价**；网关却接受 `step-5-preview-free` 并返回 200 ⇒ 计费归属未证实（见 gui-verification-protocol §5.3 与 agent-log）；
- `deepseek-v4.1-flash-free` 网关返回 `400 Model is unavailable`；同形请求下 `longcat-2.5-preview-free` 返回 200（对照组）⇒ 免费 V4.1 无法经反代取得。

- 修复步骤与验收判据：`docs/gui-verification-protocol-20261013.md` §5.3
- 模型面实测（`/models` 列表、免费档探针、`deepseek-v4.1-flash-free` 400 与 longcat 200 对照组）：`memory/agent-log.md` 流水区 2026-10-16 13:0x 条
