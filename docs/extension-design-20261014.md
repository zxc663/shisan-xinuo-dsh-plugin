# DSH 扩展面盘点与设计提案（2026-10-14）

> 起因：用户指出前一轮「C14 不可行」是**查得太窄**——只看了 `ctx.skills`，没查"能否改工具／改结果／加界面"。
> 本文＝**实查后的能力面盘点** ＋ 三类问题的设计提案（含取舍与反向论证）。术语：**面**＝宿主向插件开放的挂点。

## 一、能力面盘点（实查自宿主包接口串，逐条标注证据）

| 面 | 存在？ | 能做什么 | 不能做什么 |
|---|---|---|---|
| `tools/pre-execute` | ✅ | 读工具名＋参数；**可拦截/改道**（本插件 L3 就用它） | 拿不到会话键（实测：回调只有 `exec/next`） |
| `tools/execute` | ✅ | 瀑布中间层 | — |
| **`tools/post-execute`** | ✅ | **可改写工具结果**（呈现/标记/脱敏的落点） | 改不了"消息"，只改工具结果 |
| `ctx.tools.register` | ✅ | 注册新工具（duplicate 语义**未实查**，见待验证） | 不能触碰别人的 ctx（沙箱明确禁止："never another context"） |
| `ctx.systemPrompt.section` | ✅ | 注册系统段（本插件纪律文本） | 无法裁掉别人的系统段 |
| `ctx.on(session/event)` | ✅ | 观测 `user/message`（含 `source.kind`，故能**识别**注入文本） | **不能改写/撤回**已注入的消息 |
| `agent.steer / followup / inject / send` | ✅ | 三种投递（`inject` 不唤醒；其余唤醒） | 参数类型均 `UserMessage` ⇒ **显示上都会被当成用户侧** |
| `ctx.skills.registerProvider` | ✅ | **提供**自己的 skill | **不能裁剪**宿主 skill 的可见面 |
| UI 插件族 `dsh-client-ui-*` | ✅ 大量（chat／conversation／approval／deliverables／commands／goal／dockkit／agent-preset／attachment…） | 桌面 UI 是**插件组合**出来的 ⇒ 有做自定义面板/渲染的现实可能 | 具体"消息渲染注册点"**未实查**（见待验证） |

**修正结论**：前一轮说"skill 可见管理不可行"**只对一半**——**裁剪**宿主可见面确实不在插件面；但"**提供自己的 skill 包**""**度量**""**用工具卡替代伪装话术**""**UI 插件做呈现**"这些都在手。

## 二、三类问题的设计

### A. skill 可见管理

**可做的（当下）**：
1. **自供给**：用 `ctx.skills.registerProvider` 提供"本项目相关 skill"，其可见性由我们控制；
2. **度量**（已落 `skill-catalog-cost`）＋**建议**（在 profile 层精简 skill 源——归宿主配置，不冒充插件能力）；
3. **导航工具**：注册 `discipline_skills`，按当前判级/任务域给出"该看哪个 skill"，把"全量目录常驻"换成"按需指路"。

**最强反驳**："你只是提供了一个新目录，宿主的目录照样常驻，成本没降。"
**处置**：**采信**——所以 A 的收益上限是"**把常驻成本转成按需指路**"（在模型愿意先查导航工具的假设下），**不是**削减宿主注入。这条必须如实写在文档里。

### B. 「伪装用户言论」的根治

**根因**：投递 API 的参数类型一律是 `UserMessage`，所以 `steer` 的注入在界面上必然是"用户说的话"。

**三条路**：
| 路 | 做法 | 取舍 |
|---|---|---|
| B1 **换通道** | 不再 steer 一段中文，而是让宿主产生一个**工具卡**（新注册 `discipline_closure`，由宿主自动调用一次，证据与要求写在结果里） | 证据型问题（收口/F2 护栏）本来就是"宿主在说"，用工具卡**语义天然正确**；但 `steer` 的**唤醒**语义工具卡不具备 ⇒ 需保留一句最小 steer 作为唤醒，指向工具卡 |
| B2 **改结果标记** | `tools/post-execute` 给结果打结构化标记（如 `origin: host`），供 UI 识别 | 只能覆盖工具结果，**覆盖不了注入消息** ⇒ 解决不了 steer 的外观 |
| B3 **UI 渲染** | 做**UI 插件**，把 `[十三希诺收口强制]` 渲染为系统横幅/注入卡而非用户气泡 | 最彻底、最"好看"；但依赖宿主 UI 扩展点（**未实查**），且宿主升级会碎 |

**推荐：B1 为主（立刻可做、不依赖未知接口），B3 为辅（体验层，可降级）。**
理由：B1 用**已在手**的 `tools.register` 就把"伪装人话"换成了"系统工具卡"——**语义上不再撒谎**；B3 负责让它**好看**，且缺失时能退回 B1 形态。

### C. 交互与"好看"的原则（三条，按优先级）

1. **来源可辨**（用户 / 模型 / 宿主）——这比好看更重要，是信任底座；宿主注入必须一眼看出不是自己说的。
2. **证据贴着结论**——收口证据、工具目录、被裁清单都应在**结论近处**，不是藏在轨迹里（C10 已做证据行，属这一条）。
3. **默认一行、按需展开**；颜色只表达语义（通过／未闭环／失败），不做装饰。

### D. 耦合度怎么选

**建议：契约式低耦合（治理核心）＋ 呈现层高耦合（单独 UI 插件）**。
即：核心只用稳定挂点（`tools.register` / `post-execute` / `session/event`），不碰宿主内部；"好看"的部分独立成一个 UI 插件，宿主升级时**碎也只碎呈现层**，并能**自动降级**回文本形态。

- 反向论证："高耦合直接改宿主 UI 是最快出效果的。" → **部分采信**：原型期可以；但本项目已被 `patternMode` 连坐失活教训过一次（上游一改，整条静默失效），所以**不把治理逻辑放进呈现层**。

## 三、待验证项（不得当结论用）

1. ~~`ctx.tools.register` 遇到**同名工具**是拒绝还是覆盖？~~ **✅ 已结案（2026-10-14 探针实测）**：
   - **全局同名注册 → 拒绝**：`THROW error=tool "job_output" is already registered (for a per-agent variant, register through that agent's agent.ctx instead)`
   - **per-agent 同名注册 → 接受**：`[probe-agent-register] target=job_output result=ACCEPTED disposer=function`
   ⇒ **"改宿主工具"这条路成立**：不是全局覆盖，而是**在某个会话（agent）级注册同名变体**，从而改写该工具在该会话内的行为。
2. ~~UI 插件族是否有**消息渲染注册点**？~~ **✅ 已结案（2026-10-14 接口面实查）｜可行，两条通道**：
   - **显示层**：`registerMessageConversationNode(ctx)`（会话视图的消息节点渲染注册）＋ `ctx.slots`／`ctx.uiRenderer`／`ctx.uiConversation`（槽位与渲染服务）⇒ 可把宿主注入渲染成"系统注入卡"，而非用户气泡。
   - **内容层**：`ctx.sessions.registerMessageProjection(def)`——宿主文档原文："Plugins declare content-changing events with `@messageProjection` and register a pure definition … Session calls the definition **before accepting an event** and caches its immutable message updates." ⇒ 它能在**消息被接受前改写内容**。
   - **本项目只采用显示层，明确不用内容投影**。理由：内容投影改的是**会话记录本身**，而会话日志是本项目的**证据底座**（判据、退出码、审批链全部以它为准）；改它等于改证据，与本项目"证据不可被改写"的第一原则直接冲突（同 §三之补 红线）。⇒ 记录为**可用但禁用**的能力，并在 README 的风险节标注。
3. ~~`steer` 与工具卡组合时，工具卡是否进入模型可见面？~~ **✅ 改判结案（2026-10-14）——这不是"待验证"，而是"在禁用被禁能力前提下的硬约束"**：
   - **不需要新通道**：模型对证据的可见性**已经由 `discipline_gate` 的工具结果承载**（C10 的 `evidenceLine`：命令／真退出码／断言数／闭环状态）——模型看得见、用户在工具卡里也看得见。
   - **宿主主动发起的收口强制**（turn-stopping）**只能用 `steer`**，而其参数类型是 `UserMessage` ⇒ **"显示为用户发言"在不启用内容投影的前提下是硬约束**。
   - **处置（接受约束，不伪造来源）**：① 固定前缀标来源（已有）；② 文本最短化并禁止重述（C11）；③ 强制消息**指向工具卡里的证据**，让"判断依据"落在系统侧；④ 把这条写进 README（已写）。
   - **明确不做的选项**：用 `registerMessageProjection` 改来源种类以求"完全不像用户"——**成本是篡改会话记录**，与证据底座冲突（§三.2 已禁用）。
   ⇒ 结论：**外观纯度让位于证据完整性**。这是一次有据的取舍，不是遗留问题。
4. `skills` 提供者注册后，宿主目录是否**去重/合并**？（决定 A 的实际成本影响 —— 若合并，则"自供给 + 指向"确实能改变实际可见内容）

### 三之补：能力面结案对设计的影响（据 §三.1）

- **A（skill 可见管理）获得新路径**：若宿主的 skill 列表/加载是**通过工具**暴露的，则可用 **agent 级同名变体**替换它 ⇒ 真正的"可见面裁剪"可能成立（待 §三.2/§三.4 一并确认）。
- **B1（工具卡替代伪装话术）**：我们注册**自己的新工具**即可，不依赖同名变体。
- **红线（新增，与"判据不可被被验方改写"同源）**：**per-agent 同名变体不得用于放宽、绕过或美化判定**（例如包一层让宿主工具总是"成功"）。它只允许用于**加强**方向：加审计、加证据、加来源标注、收紧副作用面。理由是——能改工具就意味着能改"工具的真实语义"，那正是本项目要防的同一个洞。

## 四、下一步（按推荐序）

1. 验 §三.1：写一个最小插件对同名工具做 register，看宿主行为（**只读探测，不动现有工具**）；
2. ~~§三.1~~ ✅ 结案：同名变体可行 ⇒ "改宿主工具"路径成立（红线：只许加强）；
3. ~~§三.2~~ ✅ 结案：显示层渲染点可行 ⇒ **B3 纳入**（独立 UI 插件，渲染"系统注入卡"与"证据卡"）；**内容投影可用但禁用**；
4. 落地序（建议）：**B1（工具卡承载证据与要求，语义不再伪装）→ 再 B3（UI 渲染，好看）**；B3 必须**可降级**（UI 缺失时退回 B1 形态）。

### 附：B3 可行性面（2026-10-14 实查，成本判断）

宿主暴露了完整的**会话节点注册族**：`registerMessageConversationNode`／`registerToolConversationNode`／`registerAssistantConversationNode`／`registerCommandConversationNode`／`registerInboxConversationNodes`／`registerRetryConversationNode`／`registerCompactionConversationNode`／`registerConversationNodes`，以及 **`ConversationNodeAssembler`** 与 `ctx.uiConversation` 服务（`views`／`groups`／`bindings`／`events`）。

⇒ **B3 结构上确认可行**（可把宿主注入渲染成独立节点类型），但**成本显著高于 B1**：需要新写一个 UI 模块（自带渲染约定，须先读现有 UI 插件源码摸清装配方式），且每次迭代都要挂载+重启桌面应用。

**处置：B3 不并入治理核心，另立一项后续工作**（与"耦合策略：呈现层独立、可降级"一致）。当前先把 **B1 落满**：证据已由工具结果承载（C10），强制消息只做"最短化＋标来源＋指向系统侧证据"（C11 已含禁重述，本轮补"以系统侧证据为准"）。
5. ~~§三.3~~ ✅ 改判结案：证据由工具结果承载（模型与用户均可见）；宿主主动强制受 `UserMessage` 类型约束，**外观纯度让位于证据完整性**；
6. 仍待验证：§三.4（skill provider 注册后宿主目录是否合并去重，决定 A 的实际成本影响）。

## 五、掩码语义实测（2026-10-14，Step 0）——推翻了交接档的"未定论"

**待解问题（交接档 §1 记）**：`content/budget.json` 的 L1 白名单是 7 件（`read/write/edit/glob/grep/pwsh/todo_write`）＋引擎强制并入纪律件，但真机上读到的工具面是 10 件，且**含 `subagent`**（不在白名单内）⇒ 怀疑 `restrict` 掩码对部分工具无效。

**做法**：加一个环境变量门控探针 `SHISANUO_PROBE_MASK`（`src/shisan-xinuo-core.ts`，只在**首个** `request/header` 事件打印一次），输出**声明面**（`ctx.tools.schemas()`＝已注册全集）与**线缆真值**（`request/header.header.tools`＝宿主这次真正发给模型的那份）的**双向差集**。headless 跑一次即可判定。

**可重跑命令**（仅需本机 DSH CLI ＋ 项目挂载的 permtest 档）：

```
$env:DSH_HOME='D:/ai本地模型/dsh/headless-home'
$env:SHISANUO_PROBE_MASK='1'; $env:SHISANUO_BUDGET_LEVEL='L1'; $env:SHISANUO_L3_OFF='1'
node "<dsh>/lib/bin.js" permtest "回复 ok"
```

**原始输出（2026-10-14 实测，逐字）**：

```
[shisan-xinuo] tool budget applied: level=L1 trigger=agent-created allow=9 deny=0
[probe-mask] declared=27 wire=9
[probe-mask] 仅声明面（被掩码裁掉）=discipline_task,job_output,job_list,job_kill,skill,web_search,web_fetch,exit_plan_mode,send_message,interrupt_agent,list_agents,get_goal,create_goal,update_goal,subagent,subagent_fork,read_image,workflow
[probe-mask] 仅线缆面（掩码外仍可见）=—
```

**headless 结论**：宿主发出去的 9 件**全部**在允许集内（"仅线缆面"为 `—`）；19 件被裁项（含 `subagent`、`subagent_fork`、`workflow`、`read_image`）一件未漏。旧版 `discipline_tools` 报的"可见工具"取自**声明面**（已注册全集），与掩码作用的**线缆面**本就不可比——这解释了"白名单 7 件却读到 10 件"的第一层矛盾。

### 五之补：桌面档真机复算**推翻了"零漏网"**（2026-10-14，GUI 实测）

把同一份源码挂进桌面档，在同一会话里连续升档并读回目录（`discipline_tools`），三路证据（截图 / `logs/exec-log.jsonl` / 工具返回原文）如下：

| 事件（本地时刻） | 允许集 | 线缆真值 | 差集 |
|---|---|---|---|
| 未声明档位（会话首请求） | 未裁剪 | `count=30` | — |
| 声明 `L=L1` → `budget-applied level=L1 allow=9`（01:16:05） | 9 | `count=10`（01:16:32） | **`subagent`** |
| 声明 `L=L2-F` → `budget-upgrade-capped allow=15`／`budget-applied level=L2-F(封顶 L2-S) allow=15`（01:16:35） | 15 | `count=16`（01:17:14） | **`subagent`** |

目录工具原样返回（节选）：`本档位显式允许：read, write, edit, glob, grep, pwsh, todo_write, web_search, web_fetch, job_list, job_output, exit_plan_mode, skill` ／ `线缆真值（宿主这次实际发给模型的 16 件）：…, skill, **subagent**, todo_write, …`。

**改判结论**：

1. **掩码不是封闭面**：同一份实现，headless 档 `allow=9 → wire=9`（无漏网），**桌面档 `allow=9 → wire=10`、`allow=15 → wire=16`，恒定多出 `subagent`**。⇒ 交接档的"未定论"**不是纯显示口径问题**：桌面档确实有一件工具逃出掩码。
2. **归属**：`subagent` 在桌面档由该档额外的插件面提供（headless 档同名为可裁项）。因此差异落在**宿主形态**（档位装载的工具来源不同），而非我们的掩码参数写错——但这个区别对使用者没有意义，**结果就是裁剪能被绕过**。
3. **对 T1/T2 的表述按实测收窄**：任务级"只升不放宽＋升档封顶"仍然有效（三路证据已证升档与封顶在真机上生效），但**不得宣称工具面已被完全收住**——`subagent` 是已知逃生口。**未验证项**：子代理继承的工具面是否也受掩码约束（本次未测），以及桌面档其余漏网项是否随宿主版本变动。
4. **处置（不静默）**：新增纯函数 `maskLeak(wire, allow)` 与常态化核对——每次 `request/header` 用线缆真值对本档允许集求差，非空即落 `budget-leak` 账并在目录工具里**如实上报越出项**（"报假面比不报更坏"的同一原则）。漏网从"看不见"变成"每次请求都能看见"。
5. **未做的选项**：不用 `deny` 反向补刀把 `subagent` 硬拉黑——那只能治这一件，换个宿主版本又会冒新的；核对层对**任何**越出项都成立。
