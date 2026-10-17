# P1 探针批 · 宿主能力探针结论（2026-10-17）

> 性质：roadmap P1 探针批产物。方法=宿主 app.asar 解包只读核对（`/d/tmp/host-probe-p1/host`，解包自 `DeepSeek Harness/resources/app.asar`）；零实现改动。
> 结论速览：四项探针三项可行（其一大幅降级施工量）、一项部分可行走降级路径。

## 探针结论表

| # | 探针项（roadmap） | 结论 | 证据行（host 相对路径） |
|---|---|---|---|
| 1 | 提问工具参数扩展可行性（F6 前置） | ✅ **宿主原生已实现，零施工**——`dsh-tool-ask-user` 包提供 timed `ask_user_question`：`timeout` 参数 `-1`（无限）或 `1..2147483` 秒、默认 120s；超时=**pending 非跳过**（pendingNotice 明示"继续有用工作、用户仍可回答、回答经 `answer_to_pending_question` 回环、不得视为授权"）；`isTimedAskUserQuestionSchema(schema)` 可检测当前会话是否 timed 版 | `dsh/node_modules/@deepseek-ai/dsh-tool-ask-user/lib/index.js` L64 `registerTimedAskUser(ctx, timeout=120)`、L213 timeout schema；`dsh-user-questions/lib/index.js` L90/L695 |
| 2 | 压缩事件（F8 前置） | ✅ **宿主原生事件族齐全，无需阈值启发降级**——SessionEventMap 含 `compaction/start`、`compaction/summary`（含 `shadowedRange/shadowedSeqs/shadowedTokenCount/usage`）、`compaction/end`、`compaction/prune` | `dsh/node_modules/@deepseek-ai/dsh-agent-preset-registry/lib/typert.host.js` SessionEventMap 声明（`'compaction/*'` 四事件） |
| 3 | message projection「加强方向」（F7 前置） | ⚠️ **部分可行→降级路径**——`ctx.sessionProjections` 能力缝存在且插件可注册（pure fold＋client view，框架拥有订阅/水位缓存/变更通知），**但 renderer 侧（dsh-client-ui-renderer）无插件自定义渲染缝**：assistant message 结尾追加渲染没有宿主通道。降级裁定：证据可见性由宿主原生 tool/result 渲染块承担（已满足「证据行可见且与工具返回一致」），「并入输出结尾渲染」不做；输出零重复由 STEER_ANTI_REPEAT（已实现）＋收口强制文本精简承担 | `dsh/node_modules/@deepseek-ai/dsh-session-projection/lib/index.js` 头注（capability-seam 三分）；`dsh-client-ui-renderer/lib/` 仅 client.js/index.js 无扩展点 |
| 4 | sandbox 三档边界语义（F3 前置） | ✅ **三档枚举原生，与 roadmap 设计逐字对齐**——`SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'`；与 `permission/preset`、`approval/policy` 三旋钮折叠为 `permissions.currentValue`；工作区边界路径源=`working-directory/change`（cwd）。现有 src L1748-1757 已订阅 `sandbox/mode`（仅用 danger-full-access 感知） | `typert.host.js` SandboxMode 声明；`dsh-api-remotes/lib/client.js` permissions 描述（三 whole-value knob 折叠） |

## 对后续阶段的影响

- **F6（P4）大幅缩围**：从「宿主升级或包装层」缩为「检测＋指引」——插件在 `discipline_tools` 目录如实上报 ask 工具是否 timed 版（schema 可见 timeout 参数即 timed）；提示词层（goal-mode.md 已落盘）指引目标模式带超时、严重停点 `-1`。包装层不建。
- **F7（P4）降级**：并入输出结尾渲染=无宿主通道，不做；验收判据 a/b 由现状机制（ANTI_REPEAT＋原生 tool/result 渲染）承担，判据 c 的「渲染失败回退」不适用（维持工具返回通道即常态）。
- **F8（P5）无降级**：订阅 `compaction/end`（成功无 error 才注入）＋`compaction/prune` 语义留账；`shadowedTokenCount` 可落遥测。
- **F3（P3）直行**：三档语义原生；边界路径=cwd（`working-directory/change`）＋配置面放行表。

## 风险与边界（如实）

- timed ask 工具是否在每个会话默认装配未在 main.js 直接命中注册调用（装配可能经 agent preset 动态拼）——实现批以 `isTimedAskUserQuestionSchema` 运行时检测为准，不预设。
- 探针为静态只读核对；动态行为（事件时序、mode 切换值流）在 P2-P5 实现批以单元测试＋真机抽检补证。
