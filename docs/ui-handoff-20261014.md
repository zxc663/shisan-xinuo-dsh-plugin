# 界面开发必备知识（留给在 DSH 里自行开发界面的你）

> 本文只写"要动手做界面时**必须知道**的东西"：资料在哪、机制是什么、我们这边留了哪些**稳定标识**给你挂、有哪些**红线**、以及哪些是**未验证**的。
> 前置：本仓的呈现层原则是"**治理核心低耦合、呈现层高耦合且可降级**"（`docs/extension-design-20261014.md`）。

## 一、第一手资料在哪（本机路径，按阅读顺序）

| 序 | 路径 | 说明 |
|---|---|---|
| 1 | `D:\ai本地模型\dsh\headless-home\profiles\node_modules\@deepseek-ai\dsh-client-ui-conversation\README.zh.md` | **28KB 中文**，讲清了视图 slot、聊天节点注册表、审批面板如何接管编辑器——**从这里开始** |
| 2 | 同目录 `lib\` 与 `contract\` | 实体实现与 slot 声明（要点见 §二） |
| 3 | `...\node_modules\@deepseek-ai\dsh-client-ui-*` | 其余 UI 插件族（`approval`／`deliverables`／`commands`／`goal`／`dockkit`／`agent-preset`／`attachment`／`cordis`／`input-trigger`／`trajectory`…），可作实现样板 |
| 4 | `D:\ai本地模型\dsh\profiles\desktop\cordis.patch.yml` | 桌面档的挂载方式（见 §四） |

> 注：该包 README 里引用的 `docs/cookbook/adding-a-conversation-node.md` **不在本机**（属宿主源码仓），**请以 §二 摘录为准**，或按 §五 的方法自行探明签名。

## 二、扩展机制（摘自 `dsh-client-ui-conversation/README.zh.md`）

- **视图环是一个 slot**：严格会话主体在 `children` 表里声明会话作用域的 `'conversation.view'` 列表；标签页由注册项（`id`／`order`／`label`）投影。其他插件用 **`ctx.slots.register`** 贡献标签页，每个视图负责自己的 chrome。
- **聊天消息行 = 彼此独立的注册表贡献**（关键）：
  1. Client 插件用 **declaration merging** 增加类型化的 `ChatNodeDataMap` key；
  2. 在 **`ctx.conversationEvents`** 上注册 **`ConversationNodeDefinition`**；
  3. 再向 **`conversation.chat.node`** 注册匹配的 **keyed renderer**。
  ⇒ **无须修改会话 fold 或中央 renderer switch**——这正是我们要的能力：**给"宿主注入"新增一种节点类型**，而不动别人的渲染逻辑。
- **工具节点**：每个 `tool-call` 节点经 `conversation.chat.node` 同名 key 分发；详情壳层经 `conversation.details.tool`；只有详情席位在 renderer 缺席时保留 raw-result 兜底。
- **编辑器接管**：`ApprovalPanel` 注册为按选择器路由的 **`'conversation.composer'`** 配置项（审批等待期间取代 InputBar）⇒ **同型做法可让"收口未闭环/等待裁决"接管编辑器**。
- **输入栏 seat**：`'conversation.input.plan'`／`'conversation.input.model'`；另有 overlay／dock／left／right 的列表 slot。
- **`ctx.uiConversation` 服务**：`views`／`groups`／`bindings`／`events`（另有 `inspectSystemPrompt`／`inspectRequestPrompt` 等检视入口）。

## 三、我们插件留给你的"稳定标识"（UI 侧据此分类渲染）

**工具名**（三个，前缀固定）：`discipline_gate`／`discipline_task`／`discipline_tools`

**消息前缀常量**（建议据此**新建节点类型**，而不是正则碰运气）：

| 常量／形态 | 值 | 来自 | 建议渲染 |
|---|---|---|---|
| `STEER_PREFIX` | `[十三希诺收口强制]` | 收口强制（`agent.steer`，信封为 `user`） | **系统注入节点**（不是用户气泡） |
| 成本提示前缀 | `[十三希诺成本提示]` | `SHISANUO_COST_HINT=1` 时（`agent.inject`） | 次要系统提示 |
| 证据行 | `【收口证据】…` | `discipline_gate` 的**工具结果**（`evidenceLine`） | **结构化证据卡** |

**证据行的字段（可直接解析）**：`cmd=`｜`claimedExit=`｜`realExit=`｜`断言通过=N`｜`证据强度=强/弱`｜`闭环=是/否`

**闭环语义**（决定视觉强调）：`闭环=是` ⇔ 使用了检查类算子**或**登记断言全部通过；`闭环=否` 表示"通过但未闭环，回合不会被放行"。

**遥测 kind（若要做旁证/时间线）**：`gate-tool`｜`gate-steer`｜`gate-steer-capped`｜`gate-pass-weak`｜`gate-fail-ladder`｜`gate-skip-readonly`｜`gate-level-understated`｜`level-divergence`｜`tools-catalog`｜`skill-catalog-cost`｜`cost-hint`｜`gate-disputed`｜`task-amend-after-dispute`（白名单在 `scripts/tally.mjs`）。

## 四、怎么挂上去、怎么验证

1. **挂载**：桌面档 `cordis.patch.yml` 的 `insert` 里加你的插件条目（本插件的挂法是 `name: 'file:///D:/DeepSeek/dsh-plugin-dev/src/shisan-xinuo-core.ts'`，Windows 绝对路径**必须**用 `file://` URL）。
2. **生效**：改完 **重启桌面应用**（长活会话不重载）。
3. **回滚**：改前备份 `cordis.patch.yml`（本仓历次备份命名 `*.bak-<用途>-<日期>`）；撤插件 = 移除该 insert 再重启。
4. **验证**：让一次会话触发目标形态（收口强制/证据行），看**是否以新节点类型渲染**；若报错，宿主会指出缺失的注册项——**让宿主报错来确认契约**是本项目反复用有效的方法（`SHISANUO_PROBE_TOOLS` 就是这么探出"per-agent 同名工具可注册"的）。

## 五、通用探针手法（自己探明 API 签名用）

1. 写一个最小插件，`console.log` 你想确认的东西（服务是否存在、方法名、返回类型）；
2. 用 **env 门控**（`if (process.env.SHISANUO_PROBE_X === '1')`）保证默认不生效；
3. 先跑 **headless** 探（便宜、可反复），再上桌面档；
4. **故意传错参数**，让宿主报错把契约告诉你（例：全局同名注册的正确报错文本直接指出了 `agent.ctx` 这条出路）。

## 六、红线（沿用本仓已定，动手前请先接受）

1. **不得使用 `ctx.sessions.registerMessageProjection()` 改写消息内容**——它会改**会话记录本身**，而会话日志是本项目的**证据底座**（判据、真退出码、审批链都以它为准）。它**可用但禁用**。
2. **per-agent 同名工具变体只许"加强"，不许"放宽"**——只允许加审计、加证据、加来源标注、收紧副作用面；**不得**用于绕过判定、美化结果、让工具"总是成功"。
3. **呈现层必须可降级**：UI 缺失或被宿主升级打碎时，功能要能退回文本/工具卡形态（治理不受影响）。
4. **密钥不入库、不入档、不入对话**。

## 七、建议的呈现清单（按痛点排序）

1. **来源徽标**（最痛）：把 `[十三希诺收口强制]`／`[十三希诺成本提示]` 渲染为**系统节点/横幅**，而不是"用户发言"——当前它们与真实用户消息同形，是信任上的第一处裂缝。
2. **收口证据卡**：解析 `【收口证据】` 为结构化卡片；`闭环=否` 或 `证据强度=弱` 用醒目样式（这是"通过但没闭环"的唯一可视信号）。
3. **工具目录卡**：`discipline_tools` 的文本输出表格化（可见／被裁／恢复路径）。
4. **争议标记**：`dispute` 的结果渲染为"已记录争议（不改判定）"独立标记，避免被误读为改判。

## 八、未验证项（你开发时会顺手确认，别当结论）

1. `ConversationNodeDefinition`／`conversation.chat.node` renderer 的**确切注册签名**（README 指了位置，但需读 `contract/slots.ts` 或按 §五 探明）；
2. `ctx.uiConversation` 的 `views`／`groups`／`bindings`／`events` 具体语义；
3. 宿主升级导致呈现层失效的**检测方式**（建议做一条启动自检：注册失败时打印明确告警，而不是静默）。
