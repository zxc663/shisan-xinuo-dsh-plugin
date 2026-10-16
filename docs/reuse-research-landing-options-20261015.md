# 落地设计复核与更优方案调研（2026-10-15 · 双调研补课产物 · 零施工）

> 性质：复用调研产物（对应推进库 P0「无产物不进 P1」约定）。
> 证据分级：**实测**=本仓既往真机/单测证据；**文档声称**=插件 README/目录站描述，未经本仓实机复核；**待核**=需要 P0 级实测才能当结论。
> 触发问题：现有设计落地方向是否正确？缺口在哪？是否存在以成熟社区件为基座的更优落地形态？

## 一、方向判定：大方向正确，但 v2「自研任务控制器」的前提已被社区新事实动摇

### 1.1 被证据强化的部分（维持）

- 「文本纪律强制力上限=模型注意力」有本仓四臂实验硬证据（B 臂收口 0/9 vs C 臂 5/9，实测）——运行时治理的需求是真的。
- 拦截层换芯 dsh-permission-rules（B3 全清，170 例语义回归 0 不一致，实测）——「复用优先」路线已被验证走得通。
- 宿主能力面盘点（extension-design-20261014）方向正确：post-execute 改写结果、per-agent 同名工具变体、UI 渲染注册点均已结案为可用。

### 1.2 被新调研动摇的部分（需重裁）

**定位校准档（2026-10-13）裁定 v2 任务状态机「继续自研」，其依据是「行业只有 Stop hook 等同类，净增量在三态拆分/资源断言」。本轮调研发现该依据不完整：**

| 社区件 | 与本项目的重叠 | 状态 |
|---|---|---|
| **victorzhong0110/dsh-outcome-loop** | **与本仓 v2 规划核心高度重合**：任务记录持有目标/约束/验收条件；验收以测试/构建/lint/**退出码**/文件状态/git 变更等机械证据为准；状态区分 成功/失败/**未验证**/证据过期/用户接受/用户放弃（比本仓三态更细）；明确「阻止"模型说完成了"被当成"任务真完成"」；零额外模型成本、不注入 system prompt、本地 storage 持久化 | **文档声称**（awesome-dsh-plugin 目录页，beta.8 已发包）；**待核**=接口面、证据模型能否承载判级映射 |
| **dennisrongo/dsh-plugins（hooks runner）** | 八个事件含 **Stop/SubagentStop**，协议兼容 Claude Code；**Stop 连续 continuation 封顶 5 次**——直接回答本仓 README 自认的「循环防护弱于社区同类」；失败默认 fail-open、安全门可 opt-in failClosed | **文档声称**（GitHub README 详述设计）；与本仓 turn-stopping 探针目标同点 |
| **KYinCode/dsh-hooks-plugin** | 同类 hooks 桥；PreToolUse deny 走**官方工具失败卡**呈现；四级配置+热重载+recent.jsonl 记录面 | **文档声称** |
| **官方 @deepseek-ai/dsh-hooks-claude-code** | 官方钩子桥（dsh-hook 面板插件以其为执行前提） | **文档声称**，官方件 |
| **NanmiCoder/dsh-agent-teams**（2104★） | quality gates：requirements→implementation→**verification**→review→integration 契约+自动修复/复审——「验收绑定」在多 agent 场景的成熟形态 | **文档声称**（DSH Hub 页） |
| icetomoyo/dsh_workflow（42★） | 可版本管理/可审计/可复用的 Workflow 治理层 | **文档声称** |

**结论**：v2 的核心命题「任务完成条件由任务记录持有+机械证据验收」**已有专攻此道的社区件**（outcome-loop），其状态机粒度（六态）甚至细于本仓设计（三态）。「三态拆分/资源真值断言」作为净增量主张，**必须在 P0 实查 outcome-loop 源码后重新核验**——若其证据模型已覆盖，v2 自研前提不成立。

## 二、缺口清单（按用户点名的四个关注面）

### 流程
1. **双调研前门只有提案没有机制**：positioning 档 §5 三条流程修复（设计前门/决策门/产物配比）呈批后未见落地记录——本次调研本身就是缺口证据（outcome-loop 这类直接竞品直到用户点名才被撞见，与 permission-rules 的发现路径如出一辙）。
2. **turn-stopping 探针未做，但社区已实证**：hooks runner 的 Stop 事件+continuation 封顶已在线运行（文档声称）——探针目标可从「是否可用」降级为「官方桥与社区件谁更稳」，省掉最大不确定性。
3. **gate 工具存在≠必用**（删除任务自发调用率 1/3，实测）：缺口的正解是「宿主收尾事件强制」，而非继续强化工具自觉——方向对，但实现应站在 Stop hook 成熟件上。

### 表现
4. **steer 伪装用户发言**（README 已如实披露）：B1（工具卡承载证据+最小 steer 唤醒）设计完成未施工；社区先例=hooks-plugin 的 deny 走官方工具失败卡——「系统口吻由系统卡承载」已是生态惯例。
5. **拦截反馈可读性**：我方 ask 的理由文本为正则域文案；permission-rules 的审批卡+HMR 已是成熟呈现，换芯后应顺势把「判级→规则」映射理由也写进审批卡（待核其 reason 字段定制面）。

### 反馈
6. **遥测是离线对账（tally），无会话内反馈环**：模型和用户都拿不到「当前任务收口状态」的实时面；outcome-loop 的账本形态（文档声称）与 agent-teams 的实时面板（2104★ 实证其 UI 模式被接受）是两个现成参照。
7. **成本提示只报轮数不报 token**（如实但弱）；~~宿主不回传用量是硬约束~~——**2026-10-16 更正**：宿主已回传 `usage`（含 `cacheReadTokens`），该"硬约束"解除；当前实现未改版（仍只报计数）。

### 用户体验
8. **安装形态=file:// patch**，无 bundle manifest——与社区发行形态（`dsh plugin add` + dsh.bundle）不兼容，真实用户无法装；P3 已列但优先级应前提到「任何外部验证之前」。
9. **误阻率真实量级未知**（README 问题 3 自列）；六类误阻守卫是开发态样本——需要发行后才有真数据，与 8 互为前置。
10. **loop 防护弱**（每回合 1 次 steer、无逃生口）：hooks runner 的「封顶 5 次+fail-open 默认」范式可直接借用。

## 三、落地更优解（三案+一对照，均含取舍，不为方案而方案）

### 方案 A：三基座组装（拦截/收口/事件各站一个成熟件）

- **构成**：拦截=dsh-permission-rules（已落，维持）｜收口账本=**dsh-outcome-loop**（依赖或适配，承接任务记录+机械证据验收+六态）｜事件强制=**dsh-hooks 系**（Stop/PreToolUse 成熟协议）。
- **本插件退为**：判级信号→三套基座的映射层（rules.json→YAML 已有；新增 判级→验收强度、判级→hook 严格度）、误阻豁免语料、实验基建（四臂/tally/轨迹取证）。
- **得**：代码量再降一个量级（755 行核心可再瘦）；循环防护、持久化、状态粒度全部白拿；维护面=映射层而非三个引擎。
- **失**：三外部依赖的版本耦合（DSH 仍 developer preview，上游 alpha 变更面×3）；「三态/资源断言」若与 outcome-loop 语义冲突，增量空间被压缩；集成调试难度>单引擎。
- **前置（P0 待核）**：outcome-loop 源码实查（证据模型/状态机可扩展性/license）；hooks 桥与本仓 steer 强制的语义等价性实测。

### 方案 B：适配器形态——本插件=「纪律语义→多基座协议」的编译器

- **构成**：不自建任何运行时引擎。输入=content/ 三件（rules/discipline/budget）；输出=permission-rules YAML（已有生成器）+ Claude Code hooks 配置（走官方桥或社区 runner）+ outcome-loop 验收模板。插件本体只剩判级器+生成器+一致性回归。
- **得**：与生态协议完全对齐（Claude Code hooks 协议兼容=用户已有脚本零改动迁入）；官方桥升级由官方维护；本仓定位从「引擎作者」升为「内容/策略作者」——恰是 reuse-decision 档 Q5 已定调的「我们=内容作者」的自然延伸。
- **失**：策略表达力受三套协议交集限制（如 hooks 协议无 ask 细粒度、outcome-loop 模板字段固定）；「真值判定语义」这个自认净增量会部分让渡给基座实现。
- **适合**：若 P0 证实 outcome-loop 证据模型已覆盖三态/资源断言，B 优于 A（连适配代码都省）。

### 方案 C：官方件替换评估——先问「官方是否已做」，再决定留什么

- **构成**：逐项核对官方能力（@deepseek-ai/dsh-hooks-claude-code 钩子桥、宿主原生 approval/permission 系统、UI 插件族渲染点），凡官方已覆盖的子系统**整体退役**，插件只保留：判级映射、真值判定语义、遥测对账、实验臂。发行形态=最小 bundle+规则内容包。
- **得**：兼容性最优（官方件随内核升级）；插件体积最小；「不是安全边界」的披露压力最小。
- **失**：官方件粒度未必够（如官方 permission 无判级概念）；退役判断错误=丢能力，需以 170 例回归语料为等价性判据。
- **本质**：这是 A/B 的激进版——先穷举官方面，再决定要不要引入社区基座。

### 对照案 D：维持自研 v2 但向 outcome-loop 上游贡献（现状路线的修正版）

- 仅当 P0 实查证明 outcome-loop 存在硬缺陷（如证据模型不可扩展、不接受外部判级输入、license/维护活跃度不达标）时成立。
- 形态=fork 或上游 PR 而非另起炉灶；本仓增量（三态/资源断言/pinned 判据锚）以补丁形式存在。
- **反对方针**：若无硬缺陷仍选自研，等于重复 permission-rules 换芯前的错误——四轮审计打地鼠的根因（信号≠决策）会在 v2 重演。

## 四、建议决策序

1. **P0-a（1 天）**：实查 dsh-outcome-loop 源码+真机装载——验收证据模型、状态机扩展点、判级输入面、license、活跃度。产物=`docs/reuse-decision-outcome-loop.md`（对照 reuse-decision-permission-rules.md 模板）。
2. **P0-b（0.5 天）**：官方钩子桥 vs 社区 hooks runner 的 Stop 语义实测——直接消解 turn-stopping 这个「最大技术风险」。
3. **按 P0 结果三案选一**：outcome-loop 可用→B（最优）或 A；不可用→D；任何情况下 C 的官方面核对先行（成本最低）。
4. **流程修复落地**：本档即为「设计前门」产物模板实例——候选清单+实查数据列+复用结论列+license 列，建议按 positioning §5-1 固化为 docs/design-specs/ 固定章节。

## 附：本轮调研实查记录（2026-10-15）

- awesome-dsh-plugin 目录站 outcome-loop 条目页 → HTTP 200，内容如上表（文档声称，未实机）
- GitHub dennisrongo/dsh-plugins README → hooks runner 设计详述（文档声称）
- DSH Hub dsh-agent-teams 条目 → 2104★ / MIT / updated 2026-10-11（文档声称）
- 本仓 docs/positioning-and-reuse-strategy-20261013.md §3、docs/product-recalibration-20261013.md 交付物六、docs/reuse-decision-permission-rules.md 全文（本仓实测证据）
- 未核项：outcome-loop 仓库 star/license/提交频率（**待核**，P0-a 第一项）
