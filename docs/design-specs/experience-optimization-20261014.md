# 体验优化设计 · 先列问题与调研（2026-10-14）

> 性质：**只读研究产物**。本次未改任何代码、规则、预算文件。上游依据＝`docs/findings-from-real-trajectory-20261013.md`（F/G 清单）、`docs/audit-response-20261013.md`、`docs/plugin-assessment-and-roadmap-20261013.md`（C→B 路线）、`docs/extension-design-20261014.md`。
> 一句话：**已登记的缺口多数"机制在场"，但把模型真正堵住的那几条，恰好是"在场却不可用/不可执行/自相矛盾"的——本轮给出 9 条一手证据与 5 条改造方案。**
>
> **调研口径如实声明**：本次**联网调研未做**——本会话工具面（L1）不含 `web_search`/`web_fetch`（见 P3、P4），复用调研仅覆盖本机已有材料。联网待做项列于 §5。

## 1. 证据来源与等级

| 等级 | 来源 | 用途 |
|---|---|---|
| 一手实证 | 本会话（任务＝"这是什么仓库"→"体验优化设计"）的 3 次 `discipline_gate`、2 次 `pwsh`、1 次 `discipline_tools` 调用与逐轮注入面 | 现象 |
| 一手代码 | `src/shisan-xinuo-core.ts`（1721 行）、`content/budget.json`、`content/rules.json` | 根因 |
| 仓库存档 | `docs/` 29 档（F1–F10／G1–G9／R1–R4） | 对照与去重 |
| 未验证 | 根因判定、联网待核项、用户侧 UI 外观 | 见 §7 |

## 2. 问题清单（现象 → 证据锚点 → 双边体验代价）

### P1【高】收口工具的"要求结构"给出的是**算子语法**，而 `cmd` 是**shell 命令**——不可执行

- 现象：`discipline_gate` 三次调用全部 `realExit=1`。第 2／3 次我按打回文案改成 `path_contains:package.json::shisan-xinuo-dsh-plugin`，宿主 stderr ＝ `The filename, directory name, or volume label syntax is incorrect.`——**算子不是命令**，被原样交给了 cmd.exe。
- 锚点：要求结构出处 `shisan-xinuo-core.ts` L584（`② 可接受形态：not_exists…/path_contains:<路径>::<子串>/cmd_exit0:<命令>`）与 L671（阶梯 2 同文）；执行路径 L679-695 `runGateCommand` → L772 `await runCmd(cmd)`（直接把 `cmd` 丢给 shell）。算子解析器只服务 `discipline_task` 入参（L401-420），**gate 的 `cmd` 路径不经过它**。
- 对"我"的代价：唯一被允许的整改动作不可执行 ⇒ 只能试凑或停手；三次失败被记为"不符"，**归因错在我**。
- 对"你"的代价：你看到的是"模型 GATE 未过 ×3"，而真相是**工具自己的指令不可执行**。

### P2【高】打回文案指向 `discipline_task`，而该工具**默认不注册** ⇒ 只读/语义型任务没有合规收口形态

- 现象：整场状态行恒为"验收断言：未登记"；`discipline_tools` 报可见 3 个工具，**不含 `discipline_task`**。
- 锚点：注册受 `ASSERT_LAYER` 门控——L1025（默认关，注释记"每任务累计上下文 −41%"，研究用途才开）、L1696-1703（关则打印 `discipline_task skipped`）；但 L583 打回文案写"**可用 discipline_task 登记**"。断言求值链（L479+）与 gate 复核（L791-847）都在，只是**录入口被默认关闭**。
- 对"我"的代价：把"只读分析/文档/判断"这类**没有 shell 退出码可代表真值**的任务逼进二选一：凑一条真命令（F1 的成因）或声明未验证（被记为未闭环）。
- 对"你"的代价：G2/G7 声称的修复（"失败返回带要求结构"、"支持补交判据"）在默认配置下**从入口就是断的**。

### P3【高】档位是**会话级一次锁定且单向**——任务升档无效，能力悬崖无出口

- 现象：本会话第 1 个任务我声明 `L=L1` → 工具被裁到 L1；第 2 个任务是调研（我声明 `L=L2-F`），横幅仍写"**工具预算：L1**"，`web_search`/`web_fetch` 始终不可见 ⇒ **联网调研能力性不可完成**；`discipline_tools` 明写"恢复路径：**会话外**——本工具无恢复能力"。
- 锚点：`budget.json` L6 vs L9（L1 白名单 7 件；`web_search`/`web_fetch`/`job_output` 只在 L2-S）；触发逻辑 L1442-1449（**首条含 `L=` 的 assistant 文本**触发 `applyBudget`，随后 `budgetApplied=true` 永久为真，全文件无二次/升降路径）；L1168 环境变量级、L1169-1173 agent-created 级。
- **宿主日志坐实（2026-10-13T16:37:36）**：`logs/exec-log.jsonl` L7661／L7663／L7665 依次为 `tools-wire count:32` → `budget-applied level=L1 trigger=declared allow=9` → `tools-wire count:10`。即**裁剪前 32 个工具**（含 `web_search,web_fetch,job_output,job_list,job_kill,skill,send_message,interrupt_agent,list_agents,create_goal,update_goal,subagent_fork,read_image,workflow`）→ **裁后 10 个**，22 个被移出。⇒ P3 的"被 L1 裁掉"**由实测坐实，不再是推断**。
- 对"我"的代价：会话开头的一句判级把整场锁死；**开头低估 = 后续任务残废**（且我无从申请）。
- 对"你"的代价："判级→工具面"是产品主张，实际语义是"**首句判级→整场工具面**"，与文档不符。

### P4【高】同一插件对"工具面"报出**互相矛盾的两个数**；并且裁掉了收结果的工具

- 现象一：横幅"当前请求工具面=**10** 个"（＝我实际可调），`discipline_tools` 同轮报"可见工具（**3**）"、"本档位被裁剪（**0**）"。
- 现象二：L1 面里 **`subagent` 可见、`job_output`/`job_list` 不可见** ⇒ 我启动了后台子代理却**拿不到它的结果**（只能等推送），委托变成单向通道。**本会话即为实证**：本次调研委托了一个文档抽取子代理，结果无法用 `job_output` 取回（该工具不在当前工具面），只能被动等通知。
- **同一秒的双通道对照**：宿主日志 L7647 `tools-inventory count:3`（根 ctx）与 L7648 `tools-wire count:29`（真实请求面）**时间戳仅差 30 毫秒** ⇒ P4 由"观感矛盾"升级为"**机检可复现**"。
- 锚点：横幅取宿主请求头 `header.tools` 实测（L1376-1379）；目录取**根 ctx** 的 `tools.schemas()`（L1678-1684）——根 ctx 只看得见插件自己注册的工具，故恒为 3；`deny` 取自 `pendingMask.deny`，而 L1 掩码**只有 allow 没有 deny** ⇒ "被裁剪 0" 是结构性的假 0。
- 对"我"的代价：F3 的修复项（"只读工具目录让模型能说'我需要 X'"）**实现不正确**，我连"我本来有什么"都读不到真值。
- 对"你"的代价：同一个面板里两个数打架，审计面直接失真。

### P5【中】收口命令的**工作目录未定义、也未回报**

- 现象：第 1 次收口 `findstr /C:"shisan-xinuo-dsh-plugin" package.json` → `realExit=1`，**stdout 与 stderr 皆空**；同一字符串在仓库 `package.json` L2 确实存在。
- 锚点：`runGateCommand`（L679-694）`exec(cmd, {timeout, signal, maxBuffer})`——**未传 `cwd`**，继承插件宿主进程的目录；失败文案（L570-590）**从不显示 cwd**。
- 对"我"的代价：相对路径判据的成败取决于一个我看不见的目录；正确判据被误判为失败。
- 对"你"的代价：这是"假失败"的稳定来源，且证据里看不出原因。
- **宿主日志独立确认**：`exec-log.jsonl` L7692-7693 记录该次调用 `realExit:1`、`stdoutTail:""`、`stderrTail:""`——与我看到的工具返回逐字一致（**我并未"创造"这段**，可回读复核）。
- **根因未定论**（见 §7 第 1 条；本档收口时的对照实验已给出强指向）。

### P6【中】F2 的处置未落地：**易变状态仍留在系统段**

- 现象：纪律状态块（回合计数／GATE 计数／工具面数／断言态）每轮变化，且以系统段形态抵达模型。
- 锚点：`ctx.systemPrompt.section` + `text: () => [...]`（L1624-1637）——**动态函数式系统段**，数值一变即触发宿主 in-history 系统提示词更新。而 F2 的处置原文是"把**会变的部分**移出系统段…系统段保持**常量**"（`findings-from-real-trajectory` L18）。
- 对"我"的代价：每轮固定税 + 前缀缓存失效面；长会话下复利。
- 对"你"的代价：正是 F2 记录的 164K tok 那类账单的成因之一。

### P7【中】失败归因**没有"通道/环境故障"这一类**——沙箱故障被记在模型账上

- 现象：`pwsh` 工具连续 3 次在**沙箱授权阶段**失败（`SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\DeepSeek\dsh-plugin-dev)`）；而 gate 的内部 exec **确实跑起了 cmd.exe**（有真实退出码与 stderr）。两条通道可用性不一致。
- 锚点：`pwsh` 工具由宿主沙箱包装；gate 走插件进程内 `exec`（L684）。状态行把结果压成"上一工作回合 GATE: 未过(工具)"，计数只有 pass/mismatch/honestFail/refused/error（L1644-1646），**无"环境不可用"位**。
- **审计盲区（新）**：`logs/exec-log.jsonl` 中 `SetNamedSecurityInfoW` **0 匹配** ⇒ `pwsh` 的失败发生在插件 `pre-execute` 观测层**之前**，**插件自己的账本看不见本会话命令通道已坏**；P7 由"归因错位"升级为"审计链有洞"。
- 对"我"的代价：我明明没谎报，却被计入"不符 3"；且在 shell 名义可用（pwsh 在 L1 白名单里）而实际不可用时，**所有验证只能靠 gate 一条腿**。
- 对"你"的代价：账本把系统缺陷记成模型不诚实——这恰是本插件要治的那类"归因污染"。

### P8【中】"证据强度=强"与"能不能跑"脱钩

- 现象：两次不可执行的算子串调用，返回里写着「**证据强度=强** ｜ 闭环=否」。
- 锚点：`classifyEvidence`（L614-620）纯正则匹配算子名即判强，**不检查可执行性、不检查路径是否存在**。
- 对"我"的代价：我不能把"强"当作可执行的许可。
- 对"你"的代价：你读到"强"而那条命令根本没跑——**标签本身在制造可信度**，与 G6 的初衷相反。

### P9【低】占位文档与实物不符

- `src/README.md`、`content/README.md`、`data/README.md` 均写"开发中，当前为空"，而 `src/` 已有 1721 行核心、`content/` 已有 `rules.json`+`budget.json`。
- 对"你"的代价：新读者（含人）第一份材料即失真。

## 3. 复现核对表：已登记缺口 vs 声称修复 vs 本会话实证

| 缺口 | 文档处置 | 代码状态 | 本会话实证 |
|---|---|---|---|
| F1 无关命令可过收口 | 支持"判据来源移出模型" | 未变（判据仍由模型给） | 未复现为"通过"，但**根因复现**：判据选择权仍全在模型 |
| F2 系统提示词每轮更新 | "易变部分移出系统段" | **未落地**（L1624 仍为动态段） | 复现（P6） |
| F3 裁剪无恢复通道 | 补只读工具目录 | 已实现但**报假面**（L1678） | 复现（P4） |
| F5/F6 证据不可见／来源污染 | 前缀常量＋文档化 | 已实现 | 本会话**未收到 steer**（C2 宿主视角豁免生效）；状态块仍按系统提醒形态抵达，用户侧外观未验证 |
| F9 L1 也强制收口 | "L1 免 gate" | **已按更稳形态落地**：L1542 `hostLevel<=1` 免收口 | **修复生效**：本会话只读回合未被强制 |
| G2 失败返回带要求结构 | 落地 | 已实现，**内容错**（L584 把算子当命令） | 复现（P1） |
| G5 失败阶梯 | 落地 | 已实现，阶梯 2 不可执行、**无"任务不可判定"出口** | 复现（P1/P2） |
| G6 pass 标证据强度 | 落地 | 已实现，**与可执行性脱钩** | 复现（P8） |
| G7 支持补交判据 | 落地 `discipline_task` | **默认不注册**（L1696） | 复现（P2） |

## 4. 设计原则与方案（每条附最强反驳与处置）

**总原则：把"机制在场"升级为"机制可用"——凡收口链给模型的动作，都必须先可执行，再谈可信。**

| # | 方案 | 最强反驳 | 处置 |
|---|---|---|---|
| S1 | **判据与命令分字段**：`cmd` 只收 shell 命令；算子走新增 `assert`（gate 内联求值，不经 shell），解析器复用 L401-420 | "等于把断言工具塞回默认面，面变大" | **采信一半** ⇒ 不新增工具，只把已有断言求值链接到 gate 入参；算子**永不过 shell** |
| S2 | **档位任务级化**：允许按任务升档并落审计；**升档只放宽"只读/研究类"工具**（web、job_*），写/执行类不随升档放宽；升档与"能力缺口报告"必须用户可见 | "升档＝被验方自己放宽工具面（G3 同源）" | **部分采信** ⇒ 故升档只作用于**无副作用类**，且需显式理由落账；恢复权仍属会话外 |
| S3 | **归因三分离**：状态面新增"环境/通道不可用"类；`pwsh` 不可用与"模型谎报"不得同记 | "多一个状态位＝多一处可推责" | **采纳**：不可用态**不能**使收口自动通过，只能把"未验证"从罪责改为事实 |
| S4 | **证据强度重定义**：= 可执行 ∧ 引用路径/算子；不可执行形态在**跑之前**拒绝（syntax 类），不产生 mismatch | "预判可执行性不可行" | **采信** ⇒ 只做**形态**预检（算子前缀/引号/空命令），语义相关性仍不判 |
| S5 | **工具面单一真源**：目录改用宿主请求头/轨迹清单（L1376 同源），或先删除该工具避免误导 | "删了 F3 的恢复通道就没了" | **采纳（先修后留）**：修不成就删——**报假面比不报更坏** |

## 5. 复用调研（能复用绝不自研）

- **本机已有材料可复用**：上游 `PerryLink/dsh-permission-rules` 的**规则 DSL／argv 级 shell 分解／层级 `.dsh/rules.yaml`**——正是 S1 需要的"路径域＋纯检查表达式"表达力（换芯决策见 `docs/reuse-decision-permission-rules.md`）。
- **`Claude Code` Stop hook 家族**（`continueOnBlock`／`impossible`／`stophookactive`／8 次熔断＋环境变量上限）——`audit-response` §六已实查记录，**尚未吸收**；其中 `impossible` 恰对应 P2/G5 缺的"**任务不可判定**"出口，熔断上限对应 F8。**建议直接照抄语义命名与出口形态，不自研。**
- **宿主 `tools/post-execute`**（`extension-design-20261014` §一实查为"可改写工具结果"）——F5 要求的"证据由宿主回写、模型不可改写"的**现成落点**。
- **联网待做（本次未做，缺 `web_search`/`web_fetch`）**：① Stop hook 的 `impossible`/`continueOnBlock` 精确语义与边界；② 是否已有现成的**断言算子 DSL** 实现（bats／shellspec／checkmate 类）可整段复用而非自研；③ `dsh-client-ui-*` 中"消息来源标识"扩展点（`ui-handoff-20261014` 记为未实查）⇒ P7/F6 的用户侧外观正解。

## 6. 与既有清单的对接（29 档全量抽取；本档只补差，不重复立档）

| 本档 | 既有编号 | 关系 |
|---|---|---|
| P1 | G2／A2 | 同一缺口的**后果实证**：要求结构已落地，但形态给错（既有清单只记"应给要求结构"） |
| P2 | G7／A23 | **新增**：`discipline_task` 默认不注册，既有档未记"入口是断的" |
| P3 | C4／F3／C9 | **新增**：既有档记"自报触发率 1.4%"，未记"**会话级一次锁定且不可升档**"这一个致命后果 |
| P4 | C6／C17／D8 | **新增**：目录工具报假面（3 vs 10、裁剪 0）；既有档只记"目录工具已加 always-allow" |
| P5 | —— | **全新**：exec 未传 `cwd`，既有 29 档均未记 |
| P6 | F2／C8 | 复现：F2 的处置（易变内容移出系统段）**未落地** |
| P7 | A3（孪生面） | **新增视角**：A3 记"gate 是绕过审批的执行通道"，本档记"**它同时是唯一还能跑命令的通道**"（`pwsh` 被沙箱拒绝）⇒ 验证器与工作通道可用性倒挂 |
| P8 | G6 | 复现：证据强度标签与可执行性脱钩 |
| P9 | D8 | 并入下文"文档层对账缺失" |

**文档层新发现（非代码缺陷，但同属"表述与事实脱钩"）**：

- `BUDGET_ALWAYS_ALLOW` 被 `config-contract.md:48` 与 `findings-from-real-trajectory:32` 记为**五件**，实物为核心 `L219` 的**六件**（含 `discipline_tools`）；`ui-handoff:32` 按六件描述。**同一事实三处两说。**
- 结论层三处**同日自相矛盾**（子代理 D 组）：v1.0 语义（"首次公开发行" vs "改义为最小闭环"）、能力-价值曲线（"阶梯成立" vs "不足以判定"）、H5b 假警报（"可用" vs "难任务 8%／易任务 42% 不可用"）。
- ⇒ 与 P8 同族：**表述层与事实层之间没有对账机制**——判据实现出过四次缺陷（`plugin-assessment:89`），计数也是（子代理已核出多处）。这解释了为什么"机制在场"却反复"看起来有效"。

**明确不纳入本档（属另一条线）**：有效性电池的统计结论（H1/H2 不可分辨、H3 受阻、H5f 未检）、gate 自建执行通道的安全面（A3/A16）、UI 呈现层（B9/B15）。另：`todo-next:10-43` 的 C1–C16 几乎逐条标注"**未验证**（需改版前后对照）"——**这是本仓最大的待办池，建议与本档方案一并排期，否则每条修复都停在"机制在场"**。

## 7. 未定论与未验证

1. **P5 根因已升级为"高置信、未闭环"（本条即对照组记录）**：本档收口时补上了**对照组**——同一文件、同一 `findstr` 检查动词，**相对路径** `package.json` → `realExit=1`（stdout/stderr 皆空），**绝对路径** `D:\...\docs\design-specs\experience-optimization-20261014.md` → `realExit=0`、`evidence=strong`、`closed=true`。⇒ **"gate 的 exec cwd ≠ 会话工作区"高置信成立**。仍未闭环的部分：为何相对路径失败时 stderr 为空（未被解释）；另需排除"相对路径解析另有他因"。
2. `pwsh` 沙箱失败是**本机环境**问题还是插件/宿主组合问题——未定论（无宿主侧日志通道；且该失败**未进入插件账本**，见 P7 审计盲区）。
3. **用户侧 UI 外观未验证**：纪律状态块是否在界面上显示为"用户所说"，我无法从模型侧观察（F6 的 API 结论已有，呈现结论仍缺）。
4. 联网调研三项待核（§5）。另需分清：**"web 工具被 L1 裁掉"已由日志链实测（P3）**；但**"因此联网调研不可完成"仍可能叠加网络策略因素**——工具被裁后我无法调用，故该层**未测**，不作断言。
5. 本档所有"对'你'的代价"均为**推断**（从模型侧证据推用户侧可见性），标注为推断，不作结论。

## 8. 多任务长会话缺口（task-scope）· 2026-10-14 追加

> **问题形态更正（用户纠正，本档 §3 的 S2 因此作废）**：长会话里**并存多个任务**，每个任务的**判级、选项（工具面）、所需判据都不固定**。⇒ 任何"**会话级档位**""**一次性升档**""**会话外改配置**"的修法都答错了题。正确形态＝**任务**必须是一等公民：任务级档位、任务级工具面、任务级额度与账本，且**可升可降**。

**实现实况：全代码没有任何"任务"实体**——作用域只有两种：`session id`（`Agent.id = SessionId`，[core:1277](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1277)）与**插件实例**（进程级）。由此得到 11 条缺口：

| # | 缺口 | 证据锚点 | 长会话后果 |
|---|---|---|---|
| **T1** 高 | **工具面冻结在本实例"第一次声明"**：`budgetApplied` 一次性布尔 + `pendingMask` 单槽；事件侧 `if (!budgetApplied)` 直接不再解析判级；`L2-F`(`'*'`) 分支**未解除既有裁剪就 return** | [core:1150-1167](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1150-L1167)、[1442](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1442)、[1154-1157](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1154-L1157) | 第 2 个任务起判级**不参与预算**；**升到全量不解除裁剪**；反向亦坏——首任务声明 `L2-F` 后 `budgetApplied=true` 且 mask 为空 ⇒ 后续 L1 **收紧也不生效**（安全方向的错） |
| **T2** 高 | **新 agent 一律套用"旧任务的 mask"**：`agent/created` 施加的是 `pendingMask/pendingLevel`（实例级、首声明后不再更新） | [core:1169-1173](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1169-L1173)、实测 [exec-log:7705](D:\DeepSeek\dsh-plugin-dev\logs\exec-log.jsonl#L7705) `budget-applied trigger=agent-created allow=9` | 同进程内新会话/子代理继承**上一个任务**的工具面；子代理还叠加 T5' 拿不回结果 |
| **T3** 高 | **失败阶梯是"每插件实例"计数**：`failCount` 挂在注册时创建一次的 deps 对象上，仅"通过即重置" | [core:868-869](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L868-L869)、[1647](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1647)、[815](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L815)；仓内自认 `todo-next` C5 | 前一任务失败 2 次 ⇒ **后一任务第 1 次收口就已处在阶梯 3/3「停止试凑」** |
| **T4** 高 | **强制额度是"每会话 3 次"**：`steerCounts` 键=session id | [core:1329](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1329)、[1568-1595](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1568-L1595) | 多任务**共享 3 次**：前面任务用尽 ⇒ 后面任务**静默降级为不强制**（`gate-steer-capped`→放行）。治理强度随会话长度单调衰减，衰减点与任务无关 |
| **T5** 高 | **任务记录键=会话，不是任务**：`taskRecords`/`turnBuckets`/`steerCounts` 全按 session；断言合并 `auto` 恒保留 | [core:1262](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1262)、[1273](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1273)、[1295-1301](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1295-L1301) | 任务 A 的断言/`assertionsPassedAt` 会**绑到任务 B 的收口**或**替任务 B 免检** |
| **T6** 高 | **跨会话串味兜底**：解析不出 session 时，"本进程只有一条记录"就借用它，否则退到 `'default'` | [core:1288-1289](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1288-L1289) | 并发/多会话下把**别的会话的判据**当自己的；另产生不属于任何会话的记录 |
| **T7** 中 | **pinned 锚是全局的**：环境变量一次性解析，对所有任务生效 | [core:1100](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1100)、[1302](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1302)、[1311](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1311) | 为任务 A 钉的判据去**审判任务 B**（权威方向对，作用域错） |
| **T8** 中 | **"免收口"判据是回合级**：`hostLevel<=1` 取**本回合**最高副作用 | [core:1542](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1542)、[1430-1435](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1430-L1435) | 多任务同回合时：只读任务被同回合一次 write 拖进收口；而"只读交付"（研究/评审）**永不进收口链**。回合≠任务 |
| **T9** 中 | **三处判级互不校验**：预算档（首声明）／每回合 `declaredLevel`／gate 参数 `level`（模型自填） | [core:1445](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1445)、[751](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L751)、[1468-1470](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1468-L1470) | 多任务下三处漂移**不可发现**（档位 L1 与 gate 声明 L2-F 并存不报矛盾） |
| **T10** 中 | **档位表述在 `'*'` 时反向错误**：`level()`＝`pendingLevel \|\| (budgetApplied ? '已裁剪' : '')`；`deny` 恒 0 | [core:1677](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1677)、[1686](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1686) | 首任务声明 `L2-F`（全量不裁）时目录反而报"**已裁剪**"；"被裁剪 0"与"实际移除 22 个"并存（§2 P4 已坐实） |
| **T11** 中 | **用户账本是回合/全局混算**：横幅与计数无任务维度 | [core:1630-1633](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1630-L1633) | 你看到的是"本会话共收口 N 次"，**无法回答"这个任务收口了没有"** |

**关键结论（影响修法）**：宿主**已经给了撤销能力**——`ctx.tools.restrict(mask)` 返回解除器，插件自己就保存了它（[core:1139-1140](D:\DeepSeek\dsh-plugin-dev\src\shisan-xinuo-core.ts#L1139-L1140) `agentRestrictDisposers`，卸载时统一清理）。⇒ **"任务级可升可降的工具面"不是缺能力，是缺触发与作用域**：切换任务时 dispose 旧 mask、apply 新 mask 即可。同理 `failCount`／`steerCounts`／`taskRecords`／`pinnedRecords` 都只需换键。

**任务边界可从既有已实查信号拼**（无需新宿主能力）：`session/event` 的 `user/message` 且 `source.kind === 'user'`（可排除宿主注入，见 `extension-design-20261014` §一）＝任务起点候选；`discipline_task register` ＝显式开任务；gate `pass`（闭环）＝任务终点候选。

**因此 §3 的 S2 更正为 S2′**：不做"会话级升档"，改做 **任务级 mask 版本化**——任务切换即重算；升/降档都必须落审计行（`task-scope` 事件）；会话级只保留"总预算"而非"总权限"。
