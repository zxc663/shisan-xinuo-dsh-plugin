# 复用决策表：dsh-outcome-loop（源码实查 + 真机装载）· 2026-10-15

> 模板对照 `reuse-decision-permission-rules.md`。依据＝①GitHub API 元数据实查 ②源码下载精读（domain/types+reducer+service+verification/active+ARCHITECTURE+DATA_FORMAT）③本机隔离 profile 真机装载。
> 证据分级：**实测**＝本轮真机/源码；**文档声称**＝其 README/COMPATIBILITY；**待核**＝未验证。
> 触发：第三方评审（2026-10-15）P0-1~P0-4 + 上一轮调研（reuse-research-landing-options-20261015）P0-a 任务。

## 0. 元数据实查（gh api，2026-10-15）

| 项 | 值 | 评注 |
|---|---|---|
| license | **MIT**（仓库检测+package.json 一致） | 依赖/fork/二开均可 |
| stars / 更新 | **2★** / updated 2026-09-12 / 未归档 | 低采用；一个月未动（对照 permission-rules 122★/昨日更新） |
| 发行 | 5 个 tag（beta.4→beta.8），**Release 附预构建 tgz＋SHA256SUMS** | 发行形态=社区规范（恰是本项目 P0-4 缺口） |
| 兼容基线 | DSH `0.1.0-rc.7/rc.8`、cordis 4.0.1、Node ^22.19/>=24 | **与本项目绑定的 0.2.1-alpha 线漂移一代**——与评审「版本漂移」同源风险 |
| 工程质量信号 | 151 测试（vitest+CI 覆盖率门禁）、6 份 ADR、PRIVACY/SECURITY/DATA_FORMAT/COMPATIBILITY 五件、engines/peer 区间/SHA256SUMS 齐 | **文档声称+源码结构佐证**；工程成熟度高于星数表象 |

## Q1 装载面（真机实测）

- 下载 beta.8 tgz，`sha256sum -c SHA256SUMS` → **OK**（发行物完整性自证，实测）。
- 隔离实验：`DSH_HOME=<临时目录>` + `dsh plugin --profile olotest add ./dsh-outcome-loop-0.1.0-beta.8.tgz` → **6s 装成**（pnpm 11.23，0 报错，实测）。
- 组成树合成：bundle patch 三行（`outcome-loop` / `outcome-loop-commands` / `outcome-loop-projection`）正确进入 `--dump-config`（实测）。
- **前置条件（其文档声称，未启动会话核）**：裸/headless profile 无 storageDomain，需补 `@deepseek-ai/dsh-storage-domain`+storage-json 行；web profile 自带。必需服务缺失时插件按 cordis `inject` 语义保持 pending（不炸）。
- **Windows 不在其首个支持矩阵**（ARCHITECTURE §5 明言「路径代码已做跨平台防护，未宣称支持」）——本项目主战场恰是 Windows，**待核**=Windows 真机跑会话。
- 回退＝删临时 DSH_HOME；用户主 profile 未动。

## Q2 证据模型（源码精读，domain/types.ts + reducer.ts + DATA_FORMAT.md）

**比本仓 v2 设计显著更细**：

- **TaskContract**：goal（`reference`→指向会话日志 seq 不复制正文 / `explicit`）＋ scope（workspaceRoot/pathPrefixes/allowActiveVerification）＋ constraints ＋ **criteria[]（10 种 kind）**＋ verificationPolicy ＋ privacyPolicy；revision CAS。
- **判据种类（10）**：command-exit / test-report(TAP/JUnit 真计数，非退出码代理) / file-exists / file-absent / file-digest(sha256) / json-schema / git-scope / diagnostic-count / manual / **custom(providerId+params)**。对照本仓：gate 只覆盖 command-exit＋资源断言≈file-exists——**判据面是它的真子集**。
- **Evidence**：strength 四级（strong 机械/medium 用户确认/weak judge/unknown）＋ sensitivity 六级＋ freshness（maxAge/工作区变更失效）＋ sourceRef 指向权威日志不复制正文。
- **聚合九规则**（reducer.ts 源码）：required+blocking fail→failed；冲突证据→inconclusive（**永不取有利一方**）；required unknown→inconclusive；warning 不翻转结论；**用户接受不改变机械状态**（规则 8）；judge 标签上限 weak（规则 9）。
- **状态分立**：VerificationStatus 四态 × UserDisposition 五态 × LabelStrength 四级——「机械判定/用户处置/标签强度」三轴独立，正是本仓三态拆分的超集。
- **诚实性同构**：证据缺失≠失败、基础设施错误永不伪装业务失败、schema 版本不匹配 fail loud——与本仓诚实条款同频。

## Q3 判级输入面（我方映射的可挂点，源码实测）

- **Host API 服务**：`ctx.outcomeLoop`（service.ts OutcomeLoopApi）：`createContract / reviseContract / addCriterion / verify / recordEvidence / recordDecisionEvidence / setDisposition / export`——**判级→契约强度的映射有程序入口**（我方判级器可经 API 按任务风险生成不同 criteria 严格度/verificationPolicy）。
- **`custom` criterion kind + VerifierProviderLike**：外部验证器注册通道——我方「真值判定语义」（三态/资源断言）可作为 custom verifier 注入，**不必 fork**。
- **enterprise policy**（ADR-0006，`enforceEnterprisePolicy` 纯函数）：部署配置可强制 verifier 白名单/必需判据种类/最小判据数——判级策略的另一承载点。
- **主动验证默认关闭**：active verifier 需五重策略门全开（部署 autoRun＋契约 policy＋scope 授权＋白名单＋绝对 workspaceRoot），默认只读/无网络/无 shell 拼接/argv+cwd——比本仓 gate 的护栏设计更保守。

## Q4 边界：它做什么 / 不做什么（分工判定的关键）

| 能力 | outcome-loop | 本仓 |
|---|---|---|
| 任务记录持有验收条件 | ✅ 核心（契约+CAS+持久化 sidecar） | 规划（v2 未施工） |
| 机械证据验收 | ✅ 10 种判据+九规则聚合 | gate 仅 command-exit+资源断言 |
| **收口强制（不验收不许收尾）** | ❌ **verify 由命令/API 触发，不挂 turn-stopping/Stop hook** | steer 强制已实装（丑但闭环） |
| 运行时拦截（L3） | ❌ 无 | ✅（已换芯 permission-rules） |
| 风险判级→策略映射 | ❌ 无判级概念（只有 enterprise 静态策略） | ✅ 核心净增量 |
| 工具预算/上下文收敛 | ❌ | ✅ |
| 实验基建（四臂/tally/轨迹取证） | ❌ | ✅ |
| 跨会话持久化/导出/脱敏 | ✅ 完整（导出两段批准+确定性脱敏门） | ❌（exec-log 明文落盘） |

**结论**：它与本仓是**互补大于重叠**——「验收账本+持久化」它强，「判级+强制+拦截+实验」我方正独有。**收口强制这个粘合层两家都没有成熟解**（它不挂收尾事件；本仓 steer 是 UX 负债）——恰是评审 P0-2（concludeTurn 重开验证）的落点。

## Q5 资产处置建议（若采纳分工路线）

- **依赖组合优先于 fork**（MIT+Host API+custom verifier 三面都支持纯依赖）：我方产出「判级→契约模板」映射层，经 `ctx.outcomeLoop.createContract` 注入。
- **退役候选**：v2 自研任务状态机/持久化层（若分工成立，无须自建）；gate 工具退位为 custom verifier。
- **保留不动**：判级器、L3 换芯接线、预算器、steer 强制（待 P0-2 重验后改造）、实验基建。
- **硬风险登记**：①2★ 低采用+月未更新——**维护风险高于 permission-rules**，须写维护计划（fork 预算）；②Windows 未宣称支持——装载实测虽过，**会话级 Windows 实测待核**；③版本线漂移（0.1.0-rc vs 我方 0.2.1-alpha）——装载成功不代表 API 面一致，**待核**＝在我方实验 profile（0.2.x）装载。

## 整合必查项（采纳前 P0 级，3 项）

1. **0.2.x 线装载实测**（本项目真实宿主线；本轮只在 0.1.0-rc.7 过）。
2. **Windows 会话级实测**（创建契约→跑命令→verify→导出全链）。
3. **`custom` verifier 注册面实测**（我方三态语义能否不改它源码注入）。

## 附：本轮实查记录

- `gh api repos/victorzhong0110/dsh-outcome-loop` → MIT/2★/2026-09-12（实测）
- 源码精读 10 文件 ≈2500 行（types/reducer/service/active/index/ARCHITECTURE/DATA_FORMAT/package/cordis.patch，实测）
- 真机：dsh 0.1.0-rc.7 + 隔离 DSH_HOME + profile `olotest`，tgz 装载+dump-config 合成（实测）
- 未核：Windows 会话级、0.2.x 线、custom verifier 注入、storageDomain 前置（其文档声称）
