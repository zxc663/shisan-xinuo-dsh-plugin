# shisan-xinuo-dsh-plugin

**DeepSeek Harness（DSH）运行时治理插件**——把工程纪律从提示词层下沉到执行层：模型尝试跳过前置条件、调用不该调的工具、或凭自述宣告完成时，由宿主扩展面上的确定性检查介入，而不是依赖模型回忆规则。源码单文件引擎（`src/shisan-xinuo-core.ts`）+ 数据层规则包（`content/`），一切行为面可用真实运行证据复查。

> **状态：工程验收版（内部）· 未发行。** 有效性对照已完成机制验证轮（四臂×3 任务×3 轮，36 会话，A/B/C/D 含干净 DSH 基线）：运行时控制组的收口合规 5/9 vs 纪律文本组 0/9；行为有效性待 n≥5 补样本轮判定。收口执行 v5（判级仅观测／工具裁剪退役／判据新增窄版物理副作用档／多项缺陷修复）已落地，并已合并入 `main`。

## 状态与发行口径

- **阶段**：工程验收版（内部）。机制面已验收，**有效性待补样本轮**（见下表主张 6）。
- **发行态**：**无发行版**——0 tag、0 release。**打包形态已具备**：`package.json` 声明 `dsh.bundle`（自 `1d00ffd`），干净克隆 `npm pack` 与装载实测通过（见 [验证库/已知边界与接受风险.md](验证库/已知边界与接受风险.md)）；**发行动作冻结**——tag／Release／SHA256SUMS／外部递交一律搁置，解冻需显式决定。
- **分支**：全部开发工作已合并进 `main`。
- **口径**：**只有打包好的公开发行版才算真实验证可用**。本仓现在**没有可用版本**，下表中的一切主张都只是开发态结论；发行暂不进行——先经过实际环境验证。

## 三库导航

| 库 | 放什么 | 入库标准 | 入口 |
|---|---|---|---|
| 想法库 | 未验证的想法与疑问 | 无门槛——如实标注即可，本身不构成主张 | [想法库/](想法库/) |
| 推进库 | 在推进的设计／批次／待办／路线 | 有验收判据、有回滚基线、有边界 | [推进库/](推进库/) |
| 验证库 | 可复跑的证据与结论口径 | 给出可重跑命令与退出码；不可复现的如实标注 | [验证库/](验证库/) |

## 希望社区帮助验证什么

本仓已有 29 套单测与 20 条可外部重跑的主张，但它们都是**开发态**证据。下面这些问题只能靠真实使用回答，欢迎直接开 Issue 讨论：

1. 在**非 Windows** 宿主（macOS／Linux）上，拦截与收口的形态是否与 Windows 一致？
2. 换成**更小的模型**（8B 级本地模型）后，L3 拦截与收口强制是否仍成立，还是退化为纯摩擦？
3. **误阻率**在真实项目里的量级是多少？现有误阻守卫（举例／通配／目录内容／删除+创建／恢复／备份六类）是否够用？
4. 收口强制的提示**在界面上显示为一条「用户发言」**（宿主投递接口的约束，详见「代价与风险」）——你能接受吗？有更好的呈现方式吗？
5. 与 [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) 的分工是否重复？什么场景下只该用其中一个？
6. 任务级作用域（按用户原文开任务、失败阶梯按任务归零）在你的长会话里是否真的减少了误伤？

## 如何反馈

- **Bug／兼容性／文档问题／设计讨论**：开 [Issue](https://github.com/zxc663/shisan-xinuo-dsh-plugin/issues/new/choose)，按类型选模板。
- **还没有定论的设计议题**：到 [Discussions](https://github.com/zxc663/shisan-xinuo-dsh-plugin/discussions)（实验性想法、Agent 工作流做法、跨项目借鉴）。
- **参与代码**：先读 [CONTRIBUTING.md](CONTRIBUTING.md)。欢迎提修改，但**不承诺全部采纳**；方向、优先级与合并决定留在维护者手里。
- **安全相关**：走私密披露渠道，见 [SECURITY.md](SECURITY.md)——本插件**不是安全边界**，这一点请先读清。

## 能力矩阵（主张=状态标签制，证据可复查）

| # | 主张 | 状态 | 宿主面 vs 插件增量 | 证据 |
|---|---|---|---|---|
| 1 | L3 危险操作在工具执行管线内被程序性拦截（命中→审批询问），且被拒命令经**任何工具通道**的 TTL 内重试由宿主**单调守卫**（`ctx.tools.guard`，2026-10-15 探针实证）封闭——后续监听者不可翻回 | **已实现有测试**（正则覆盖 6 域+9 豁免+嵌套 shell 形态；guard 单调层=指纹重放拒绝） | 审批卡 UI 与 pre-execute 管线为宿主原生；插件供红线规则、误拦豁免、形态封堵、单调 deny | 单测 8正10负+23例+58误拦样本；真实宿主 16 次拦截+审批链 3 次全通 |
| 2 | 收口验证依据真实退出码而非模型自述（discipline_gate 工具：宿主真跑 cmd，声明与实测不符=打回）；判据来源分档：会话外锚（pinned）＞用户原文派生＞工具自登记＞**动作落地级（`effect`，2026-10-16 新增，独立记账 `effect-closeout`）** | **已实现有测试**（四臂实验中 3 次打回无效验证——模型每次修正后重过；动作落地级已在真宿主上跑通） | 命令执行/退出码采集走宿主；判定语义（三态+拒跑）与判据分档为插件自有 | tests/gate-tool 44 例；tests/effect-assert 35 例；E1 报告 |
| 3 | 规则包可替换：改 `content/rules.json` 即改红线，不动引擎代码；无效配置 fail-closed 回退内置默认 | **已实现有测试**（真实宿主自定义域拦截实证） | 插件自有 | tests/config-rules 24 例 |
| 4 | ~~工具预算器：按任务判级裁剪工具面（restrict 掩码）~~ | **已退役（2026-10-16 收口 v5 批4）**——运行时裁剪让位上游披露插件（`dsh-tool-search`）；本插件零裁剪，`discipline_tools` 只如实报线缆真值 | — | 退役依据 `docs/reuse-decision-toolface-20261016.md`；rich 档实测 `tools-wire` 7 件/3,374 chars |
| 5 | 行为遥测与对账：exec-log 全落账，tally `--report/--check` 出数+对账（白名单/不变量/快照，抓植入差错） | **已实现有测试** | 插件自有（日志为插件所写，非宿主审计面） | tests/tally 16 例（5 类攻击样本全被抓） |
| 6 | 有效性（改善任务结果） | **未证**——机制验证轮 n=3 区分力不足（裸基线行为方差大），按预注册矩阵不判有效/无效 | — | docs/e1-v4-four-arm-report §三 |
| 7 | 拦截覆盖完备性 | **已知边界**——枚举型正则有天花板；「目标替代」（用 write 清空代替删除+对偷换目标做真验证）不可在正则层修，指向 v2 任务状态机 | — | docs/e1-v1-report §3、e1-v4 §三 |
| 8 | 任务控制器（状态机+验收条件持有）/ 受控执行器 | **规划（v2，待批）**——收口强制缺口（工具存在≠模型必用，删除任务自发调用率 1/3）由本版闭合 | — | docs/product-recalibration-20261013.md |

**诚实条款**：本插件保证「过程可审计、收口有真值」，不保证「模型更聪明」；三命题分立——机制存在（✓）≠机制有效（待补样本轮）≠产品有效（待对照终判）。审批卡、命令执行、事件管线均为 DSH 原生能力，插件的净增量在**可替换的策略、真值判定语义与强制闭环**。

## 代价与风险（如实）

- **收口验证是一条新的执行通道**：`discipline_gate`（及 `cmd_exit0` 断言、宿主收口复核）会在插件侧直接执行你声明的验证命令——护栏=危险域清单＋被拒命令指纹（10 分钟），**不是安全沙箱**；清单覆盖面之外（目标替代、重定向覆写、脚本清空等）不拦，与 pwsh 通道同一天花板；仅存在于上游 `.dsh/rules.yaml` 的自定义规则也不覆盖此通道。2026-10-13 加固：`discipline_task` 的 replace 仅作用于工具自登记断言——**用户原文推导断言恒保留，模型不可移除/改写**；并支持**判据锚点（pinned）**：`SHISANUO_ASSERTIONS` 可在会话外钉死断言（模型侧不可见），形成三级判据「pinned > auto（默认关）> tool」——**2026-10-13 起启发式推导默认退位**（SHISANUO_ASSERT_LAYER=1 可重新启用）。
- **一致性≠有效性**：`claimedExit` 比对只抓「谎报退出码」；`echo ok; exit 0` 类与目标无关的命令会通过（命令与目标的相关性无机器校验；资源断言仅覆盖可枚举路径）。
- **动作落地级判据 ≠ 目标级判定（2026-10-16 新增档，如实标注）**：当一回合**没有**任何已登记断言（pinned／用户原文派生／工具自登记）时，宿主会从**亲见的工具副作用**派生断言（写类→`exists`、删除类→`not_exists`）并据此收口，记为 `effect-closeout`——它证明「动作确实落地」，**不证明「目标已达成」**；该档与目标级 `auto-closeout` **分列记账，复核指标时不可混计**。命令类不派生 `cmd_exit0`（与"禁跑一条无关命令凑 exit 0"同一口径）；关闭方式 `SHISANUO_EFFECT_ASSERT=0`。
- **收口强制：成功侧=concludeTurn（默认启用），失败侧=steer 打回**：gate 闭环 pass 时经宿主 `ToolExecution.concludeTurn()` 标记回合终态（2026-10-15 探针+对照实验证实：工具结果后回合立即终止；此前 b2「不可用」结论系我方解构裸调丢 `this` 的调用姿势 bug）；`SHISANUO_CONCLUDE_ON_PASS=0` 可退位。未过收口的 steer 打回仍经 `steer` 注入（信封 `source=user` 为宿主接口约束），文本以固定前缀 `[十三希诺收口强制]` 显式标注来源；插件按该前缀排除自身注入，避免自我循环。**在界面上它呈现为一条"用户发言"**——请勿把它当作你自己说过的话：宿主投递 API（`send`／`followup`／`steer`／`inject`）的参数类型均为 `UserMessage`，故"显示为用户"是接口约束而非本插件选择；成功侧改道 concludeTurn 后，伪装用户发言的频次只剩失败路径。
- **「可用但禁用」的能力面（如实披露）**：宿主另外开放了两条更强通道，本插件**主动不用**——① `ctx.sessions.registerMessageProjection()` 可在**消息被接受前改写内容**；② `agent.ctx` 上可注册**同名的 per-agent 工具变体**（改写宿主工具在该会话内的语义）。理由：前者改的是**会话记录本身**，而会话日志是本项目的证据底座；后者若用于放宽/美化判定，等于把治理机制变成新的攻击面。**本插件的红线：这两条只允许用于"加强"方向（加审计／加证据／加来源标注），不得用于放宽或改写证据。**
- **遥测日志默认明文落盘**：`<repo>/logs/exec-log.jsonl`（命令截断 200 字符、stdout/stderr 尾 300 字符；写入前对常见密钥形态自动脱敏——非穷尽）。可用 `SHISANUO_LOG_DIR` 指到私密目录；`SHISANUO_LOG_DISABLE=1` 可整体关闭落盘（不留痕环境；启动以 stdout 一行声明，代价=放弃审计底座）；日志不入库（.gitignore）。
- **循环防护弱于社区同类**：收口强制=每回合最多 1 次 steer；无 `impossible` 类 hook 逃生口——被阻塞时以「如实报告」收口（宿主记 `unverified`/`assertion-unresolved`）。
- **开发态绑定**：无 `dsh.bundle` manifest（仅 `file://` patch 挂载）、绑定 cordis `4.0.5-alpha.1`、未发行——宿主 alpha API 变更可能破坏兼容。
- 一句话：**不要把本插件当作安全边界**——拦截面=枚举覆盖，验证面=真退出码；两者治「过程」，不承诺「安全」。

## 安装

**发行形态（bundle，0.2.0-rc.2 实测）**：从 Release 下载 tgz 后：

```bash
dsh plugin --profile <你的profile> add ./shisan-xinuo-dsh-plugin-<版本>.tgz
```

预编译 `lib/` 为必需（Node 22 type-stripping 不支持 node_modules 下 .ts，实测）；运行时零宿主硬依赖（cordis 仅 type-only import），故无 peer 拒装面。

**开发形态（file:// 直载 .ts）**——DSH profile 的 `cordis.patch.yml` 追加：

```yaml
- insert:
    - id: shisanxinuo-core
      # Windows 绝对路径必须用 file:// URL（ESM loader 把裸 D:/ 判成 d: 协议）；按你的仓库位置替换
      name: 'file:///D:/path/to/shisan-xinuo-dsh-plugin/src/shisan-xinuo-core.ts'
```

正式 bundle 化（`dsh.bundle` manifest）=发行批工作，未做。

## 配置（契约详见 docs/config-contract.md）

数据层两件（原第三件 `content/budget.json` 随**工具裁剪层退役**移除，见「能力矩阵」#4 与 CHANGELOG 批4）：

- `content/rules.json`：L3 危险域+只读豁免（**fail-closed**：无效回退内置默认，防护不静默解除）
- `content/discipline.md`：注入的纪律文本

环境变量（全部可选，未设时用随仓默认值）：

| 变量 | 作用 |
|---|---|
| `SHISANUO_RULES` / `SHISANUO_DISCIPLINE` | 覆盖规则包/纪律文本路径 |
| `SHISANUO_LOG_DIR` | 覆盖遥测日志目录（默认 `<仓库>/logs`）；`SHISANUO_LOG_DISABLE=1` 关闭落盘 |
| `SHISANUO_ASSERTIONS` | 会话外钉死验收断言（pinned；格式同 `discipline_task`：`kind:payload; …`）——模型不可移除/改写，clear/replace 均无效 |
| `SHISANUO_ASSERT_LAYER` | 启用**启发式断言推导**（默认关）：判据来源默认以会话外锚（pinned）与工具自登记为一线，推导仅作可选辅助——依据=电池实测误推导 3/13 且关闭后步数 8→6、每任务累计上下文 −41% |
| `SHISANUO_EFFECT_ASSERT` | 关闭**窄版宿主默认判据**（默认开；`=0` 关闭）：宿主只从**亲见的工具副作用**派生断言（写类→`exists`、删除类→`not_exists`；命令类只认删除且过误阻守卫），且仅在该回合**无任何已登记断言**（pinned／用户原文派生／tool 自登记）时生效。它证明**动作落地**、不证明**目标达成**，故独立记账 `effect-closeout`（不与目标级 `auto-closeout` 混计）。依据=2026-10-16 批5 续执行单（严格为主＋物理副作用子集） |
| `SHISANUO_L3_OFF` / `SHISANUO_NO_ASSERT` | 研究旗标（实验用，默认关）：拦截退位为仅记录／关闭断言面（不推导、不注册登记工具）——用于对照实验 |
| `SHISANUO_ZEROTOOL_GUARD` | F2 盲区护栏（默认关）：开启后，「零工具调用却声称完成」的回合会被记录（`zerotool-claim`）并轻量提示一次（每回合上限 1）——该类回合原本不进入任何收口检查 |
| `SHISANUO_PROBE_TOOLS` | 工具注册语义探针（默认关，**仅探测会话使用**）：启动时尝试一次**同名工具注册**并打印结果（全局＝拒绝／per-agent＝接受），用于验证"改宿主工具"能力面。产物见 `docs/extension-design-20261014.md` §三.1 |
| `SHISANUO_COST_HINT` | 成本提示（**实验，默认关**）：开启后每回合最多一次经 `inject()` 注入"轮数／累计工具调用数＋每步重发上下文"。**2026-10-16 更正**：宿主**现已回传 `usage`**（含 `cacheReadTokens`），故"宿主不回传用量、报 token 即为编造"这一前提**不再成立**（该提示当前仍只报可观测计数，未改版）。前缀 `[十三希诺成本提示]` 自曝来源 |
| `SHISANUO_ARM=A\|B\|C` | 实验臂切换（优先于旗标文件；A=惰性观测，B=纯纪律文本，C=全量，默认 C） |
| `SHISANUO_DSH_BIN` / `SHISANUO_DSH_HOME` / `SHISANUO_E1_TMP` | E1 批量实验的本机环境（DSH 入口/home/临时目录） |

## 测试与测量

```bash
npm test   # 29 套单测（scripts/run-all-tests.mjs 跨平台入口；无需构建，Node ≥22.18 默认 type stripping 即可）
node scripts/tally.mjs --report --freeze   # 出数+冻结快照
node scripts/tally.mjs --check             # 对账（exit 1=发现违规）
node scripts/e1-run.mjs                    # headless 三臂实验（环境经上表变量注入）
```

轨迹层取证方法（会话注入面/工具线缆面/审批事件解析）见 `tmp/trace_*.py`（实验辅助脚本，不入库分发）。

## 拦截换芯：外置拦截引擎（可选 · B3 落地）

拦截层可外置给社区成熟引擎 [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)（Apache-2.0；本项目实测 v0.7.15）：危险域拦截由其规则引擎承载，本插件保留「判级→规则」「收口真值」「steer 强制」「遥测对账」净增量；**工具面披露**亦让位上游 [dsh-tool-search](https://github.com/Letter2025/dsh-tool-search)（0.1.7，实测 wire 7 件/3,374 chars）——插件的运行时裁剪层已退役（见「能力矩阵」#4）。

- 生成规则文件（唯一规则源=`content/rules.json`）：`node scripts/gen-permission-rules.mjs --out <工作区>/.dsh/rules.yaml`
- profile 配置行（regex 模式为生成文件前提；v0.7.15 内置基线为 glob 写法、regex 模式下会致条目失活，故须关闭）：

```yaml
- id: permission-rules
  config:
    patternMode: regex
    builtin: { enabled: false }
```

- 语义回归（与我方引擎全量语料逐条对照；引擎缺席时 SKIP）：`node scripts/regression-permission-rules.mjs` —— 2026-10-13 实测 170 例 0 不一致。
- 真机抽检与映射表：`docs/b3b-generator-and-semantic-regression-20261013.md`。

## 实验与证据

三轮有效性实验（预注册制：判据先于跑分冻结）：

- **E1-v1**（headless 三臂×3 任务）：机制全按设计运行；发现两个天然绕过——`cmd /c del` 嵌套形态（已闭合+回归）与「目标替代」（留 v2）
- **E1 桌面轮**（GUI 真实操控）：审批链全通（approval→allowed-once→执行）；token 用量 GUI 真值
- **E1-v4**（四臂×3 轮，含干净 DSH 基线）：C vs B 收口 5/9 vs 0/9；裸模型删除行为三型方差（目标替代/不作为/真删）；惰性插件≈干净基线（A≈D 纯度通过）
- **轨迹层审计**：43 会话注入面解析——四臂同质（均含宿主原生 runtime-context+skill-catalog），无第三方纪律污染

报告：`docs/e1-v1-report-20261013.md` / `docs/e1-desktop-report-20261013.md` / `docs/e1-v4-four-arm-report-20261013.md`；预注册与设计：`docs/design-specs/`。证据分层与可重跑命令见 [验证库/](验证库/)。

## 目录

- `src/shisan-xinuo-core.ts` 引擎（单文件：拦截/收口真值/机判/披露接线/遥测）
- `content/` 规则包（Config 面）｜ `scripts/` 测试与工具链（run-all-tests / tally / e1-run / gen-permission-rules / regression-permission-rules / gui-verify / check-docs-index）｜ `tests/` 29 套单测
- `想法库/` 未验证想法 ｜ `推进库/` 在推进事项的入口索引 ｜ `验证库/` 可复跑证据与结论口径
- `.github/` Issue 与 PR 模板＋CI ｜ `SECURITY.md` 安全披露（含「不是安全边界」声明）｜ `LICENSE` MIT
- `docs/` Config 契约/实验预注册与报告/路线图/方向校准报告/GUI 验证规程 ｜ `CHANGELOG.md` 版本记录（内部）
- `CONTRIBUTING.md` 公开文本规范（提交/注释/文档＋机检）
- `AI会话知识沉淀.md` 会话知识沉淀（AI 版：宿主接缝／沙箱 ACL／会话日志标记／反代真值／判据分档）｜ `踩坑经验库.md` 踩坑记录（症状→根因→解决→预防）

## 版本史与路线（详见 CHANGELOG.md）

v0.1 机制雏形 → v0.2 真值闭环（gate 工具）→ v0.3 可修改性（Config 化）→ v0.4 上下文控制（预算器，**已于 2026-10-16 退役**）→ v0.5 判定制度+E1 → **v1.0 工程验收（内部）** → **2026-10-15 探针批+施工批**（宿主 API 五项实证／concludeTurn 根因改判+收口改道默认启用／guard 单调层／发行形态 bundle 化实测）→ **2026-10-16 收口 v5**（判级仅观测／段指纹／启动自检／gate 降级／闭环宿主终结／**工具裁剪退役**／pinned 绕过洞修复——见 CHANGELOG 与 docs/design-specs/layer3-quantification-results-20261016.md）→ **2026-10-16 决策批**（判据新增窄版 `effect` 档＋独立记账／四项裁决落地／会话拒载事故修复／**对外发布冻结**／知识沉淀落档）。

下一程（方向校准报告提出，待批准）：v2 任务控制器（状态机+验收条件持有+收口强制——本插件核心缺口的正解）→ v3 能力路由（分层注入+Skill 按需）→ v4 错误模型+持久化 → v5 有效性终判（n≥5 四臂+脱敏对照）。路线=docs/product-recalibration-20261013.md。

## 审计吸收（2026-10-13 · 第三方白盒审计）

- **F-01 收口防假**：文本 GATE 不再计入合规；断言任务由**宿主在回合收尾自动复核**（全过=收口成立 `ok-auto`；**动作落地级复核=`ok-effect`**，与目标级分列；未过=steer 打回）；无断言任务必须真调 `discipline_gate`，不可验证如实记 `unverified`。
- **F-02 完全权限**：`discipline_gate` 的 L3 拒跑**不再被 full-access 豁免**（全权只免审批卡交互）。
- **F-05 预算（已退役）**：原机制=裁剪仅认显式 `L=…` 状态行、`pwsh` 常驻白名单，定位=**token 收敛，非安全边界**；该层已于 2026-10-16 收口 v5 批4 退役（披露让位上游 `dsh-tool-search`），主张 4 相应改判为「已退役」。
- **F-04/F-06/F-08/F-09**：对账白名单与写入面同步（24/24，新增机检测试）｜补 5 例漏拦样本（含 `base64 -d | sh` 新域）＋复核脚本修复入测｜指纹匹配加词边界｜devDeps/去硬编码/`npm test`/CI（Node 22/24）。
- **如实边界**：分回合跳过、推导覆盖面（F-03/F-07）、重定向覆写类语义样本——均已声明；宿主层实验日志不入库，第三方不可独立复现（审计 §3.2），单测与检查脚本可独立复现。
- 完整处置清单：`docs/audit-response-20261013.md`。
