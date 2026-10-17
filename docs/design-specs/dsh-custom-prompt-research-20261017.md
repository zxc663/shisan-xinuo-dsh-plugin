# 「DSH自定义」系统提示词管理 · 调研报告（2026-10-17）

> 性质：设计前调研（补「双调研缺口」欠账第二单）。范围＝①system 提示词装配链（含 0.2.1-rc.1 对照）②生态同类普查与复用裁定 ③UI 惯例复用。结论供「设计冻结→拍板」前置。
> 需求基线（已澄清）：设置级页面「DSH自定义」：管理/深度自定义官方系统提示词；纪律文本作 **system 层前置**；载体＝插件自管全局文件（全局默认＋工作区可覆盖）；**注入总开关**；与 AGENTS.md 共存的防重复；不按单 agent 场景硬编码。入口钉在侧栏「插件」卡片；新插件独立立项（core 管执法、按需挂）。

## 1. 装配链解剖（0.2.0-rc.2，一手：包内 d.ts 与官方 README）

`ctx.systemPrompt`（`@deepseek-ai/dsh-system-prompt`）＝每次模型步骤前的提示词注册表＋协作式组装流水线。

| 机制 | 事实（一手） | 对我们的含义 |
|---|---|---|
| 段注册 `section({name, order, text, interpolate?, complete?})` | 任意有限 order；同层同名重复=抛错；**带作用域段遮蔽同名全局段** | 合法注入通道 |
| 官方顺序常量 | `HARNESS_IDENTITY=-1000`、`PERSONA_PREFIX=0`、工具段 1000–3100、`TOOLS_SDK=5000`、`HARNESS_SOURCE=10000`、`PERSONA_SUFFIX=10200` | **前置**＝order `-2000`（排在全官方之前）；另可用于**段归属标注**（官方 vs 外部） |
| **`complete: true`** | “该确切段成为**唯一的**系统提示词段”；工具/上下文/变量仍照常解析；**多于一个有效 complete=组装失败** | **深度自定义的合法机制**：整段替换官方文本，不动 asar、升级不碎；**独占性=冲突风险**（与任何也用 complete 的插件互斥） |
| `system-prompt/assemble` 瀑布（专家级） | 监听者可改装配结果；**但 complete 段在瀑布后恢复**⇒有 complete 的作用域里瀑布改不动提示词 | 备用通道（不做 complete 时的段级后期处理） |
| `assemble(context?)`（**公开**）＋ `renderPrompt()`（导出函数） | 返回 `PromptAssembly{sections(名+文本), contexts, tools, variables}`；严格插值 | **“实际装配结果”可视化成立**（页面第一大区的底气）；段名可作归属与来源标注 |
| 作用域 | `agent.ctx` 注册仅影响该 agent 并遮蔽全局同名项；`system-prompt/change` 不带筛选 | **“全局默认＋单工作区覆盖”成立**（会话级作用域） |
| persona 槽位 | `deployment:persona-prefix/-suffix` 段名为公开常量——“两边用**同一个段名**才构成替换而不是重复” | 官方明示的“按名替换”惯例；给“段级替换”留了合法口子（作用域内同名遮蔽） |
| 配置面（免插件） | `includeHarnessIdentity`（可去掉固定开场白）、`personaPrefix/Suffix`、`toolOrder` | 即便零插件，宿主配置也能改开场身份句——写进新插件页的“对照说明” |
| 渲染与缓存 | 渲染结果作为 system 角色消息（surface 0 号节点）；文本稳定则前缀稳定 | 编辑的生效与成本边界（改一次=重算一次） |

**可行性裁定表**（需求 → 机制 → 裁定）：system 层前置→order<−1000 外部段→**成立**；深改官方全文→complete 段→**成立（合法，唯一风险=与其它 complete 互斥）**；段级替换→作用域同名遮蔽→**成立（作用域内）**；查看实际装配→`assemble()`+`renderPrompt`→**成立**；工作区覆盖→agent 作用域→**成立**；回滚→关开关即恢复官方（无持久改动）→**成立**；“分清我方/官方”→段名＋官方顺序常量→**成立**。

## 2. 0.2.1-rc.1 对照（升级风险核查）

- 版本线：npm `latest=0.2.0-rc.2`、**`next=0.2.1-rc.1`**（`dsh-system-prompt`／`dsh-agent-preset`／`dsh-agent-instructions` 均已随线发布）。本机桌面与 CLI 均 0.2.0-rc.2；桌面走 nightly 通道。
- `dsh-system-prompt` 0.2.0→0.2.1 差异（README 逐行 diff 60 行）：①**`{{cwd}}` 变量被移除**——0.2.1 起自定义 persona 模板**不得**再含 `Your working directory is {{cwd}}.`，否则组装在请求前直接失败（工作目录改由“工作目录服务”的 user 上下文提供）；②新增 `refreshContext()`（pre-step 后刷新运行时事实）；③上下文区分 **required/可选**（`suppressRuntimeContext` 只移除可选）；④`interpolate:false` 适用范围扩到动态上下文；示例变量改为 `provider`/`response_language`。
- **API 稳定性裁定**：`section/complete/assemble/renderPrompt` 语义未变 ⇒ 本设计在两条线均可实现；**升级建议＝暂不升级**（rc 线且带一处破坏性变量变更，且本机全部装置与实验基于 0.2.0-rc.2）；升级作为独立事项（升级清单：persona 后缀中的 `{{cwd}}` 清理＋三档矩阵重验）。

## 3. 生态同类普查与「复用裁定」（本单最重要的发现）

精选目录 1000 条中 prompt 域命中 13+ 条。按行为分三族：

| 族 | 条目（抽） | 行为 |
|---|---|---|
| **系统提示词注入/作用域** | **`Awoodwhale/dsh-agent-persona`**、`1015677515/dsh-prompt-ErrorNotes-desk`、`Aliuyanfeng/dsh-soul` | 人设/教训/个性化→system 段；按位置分发；按回合重注入 |
| 请求改写/学习型 | `Hua1Q1nG/dsh-prompt-self`、`BrambleXu/dsh-prompt-profile` | 按”学到的档案/配置档“改写每次请求 |
| 输入框草稿类（非 system） | `FeatherHunter/dsh-prompt`、`Frog755/dsh-prompt-vault`、`Fishsb/dsh-prompt-enhancer`、`1321928757/dsh-prompt-polish` 等 | 提示词片段库/润色/建议——在输入框层，不在系统提示层 |

### 近邻深核：`Awoodwhale/dsh-agent-persona`（v0.1.4 · Apache-2.0 · npm 在架）

**它已实现的能力（一手：README/package.json）**：多人设各声明适用范围（工作区路径/会话 ID×完全一致/前缀/包含/正则；越具体越优先；显式默认人设兜底；空正文=在位置关掉；位置自动转移）｜**追加或替换**（保留宿主身份句接人设在后，或去掉身份句只用人设）｜改完下一条消息生效（时间戳重读）｜`tools.guard` 拒绝模型改写人设文件（只读命令放行）｜存储损坏保护＋首次保存前自动 `.bak-<时间戳>` 备份｜导入/导出 JSON｜**三处界面**（设置→Agent 人设页；**会话顶部「人设」tab 展示实际发出的 system prompt（渲染/源码双视图）**；侧栏卡片集成）｜偏好开关组（自动保存/显示 tab/侧栏注册/禁模型改写）。

**其对位与空缺**（对本需求）：

| 需求点 | dsh-agent-persona | 缺口 |
|---|---|---|
| 工作区/会话作用域 | ✅ 内建（匹配器齐全） | — |
| 全局纪律注入 | ✅ 可作“默认人设”实现 | —（纪律文本直接可以装进去） |
| 实际提示词查看 | ✅ 会话 tab 双视图 | 无**段级归属标注**（官方 vs 外部） |
| 深度自定义官方全文 | 部分：仅“身份句开关＋人设段替换” | **无 complete 整段编辑** |
| 注入总开关 | 部分（逐位置空正文/停用） | **无全局一键关** |
| AGENTS.md 共存防重复 | 未涉及 | **缺口** |
| 载体与回滚 | ✅ 自管 JSON＋备份＋导出 | — |

**复用裁定（按“能复用绝不自研”铁律）**：工作区作用域/生效模型/备份/查看视图/开关——**均已存在且成熟**；我们的净增量收敛为三件：**①complete 整段编辑（官方文本深改）②纪律前置＋注入总开关 ③AGENTS.md 共存检查**。并附两条硬约束：**complete 独占**（与其它 complete 插件互斥→共存检测必须做）；其“身份句开关”若与本插件 complete 同时启用会打架→设计中显式互斥提示。

## 4. UI 惯例（复用前单结论，含新先例）

- 入口＝侧栏「插件」卡片→设置页（生态主流；官方八卡与第三方同型）；
- **新先例**：本近邻走 **“设置 → Agent 人设”独立设置项**（说明第三方插件注册设置区入口有现实路径），但其亦提供会话内 tab；我们按既定口径钉「插件」卡片，设置区入口列为可选增强；
- 表单/暂存/已覆盖/恢复默认/校验阻止＝五惯例（前单）；写回有 `dsh-config-editor`；客户端半打包＝`__ModuleLoader__`＋externals-only（lazy-tools 形）；
- 本近邻同款栈：npm 发布＋install 脚本＋settings 页＋client 半——**可直接作为实现形态范本**。

## 5. 风险与边界

1. **complete 互斥**：本插件启用深改时，同 scope 内不得再有其它 complete（含未来宿主机制）——页面须显式检测与提示；与 `dsh-agent-persona` 同挂时，深改开启与其“身份句替换”互斥（提示用户二选一）。
2. 严格插值：编辑文本中出现未知 `{{变量}}` 会**组装失败**（模型请求前）——编辑器必须做全量变量校验（对照 `assemble()` 的变量表）。
3. 升级面：0.2.1 的 `{{cwd}}` 移除属破坏性变更，设计须不依赖该变量；升级另走独立事项。
4. 安全面：被编辑的是**模型提示词本体**——变更须留痕（版本化快照，可回滚，与近邻同款 `.bak`/JSON 双轨）；“禁模型改写”守卫（tools.guard 先例）值得照抄。
5. 生态名撞车：目录内“提示词”命名高度拥挤——命名与描述须明确“系统提示词本体管理”以区分输入框草稿族。

## 6. 复跑（信任可传递）

```bash
npm view @deepseek-ai/dsh-system-prompt dist-tags        # 版本线
npm.cmd pack @deepseek-ai/dsh-system-prompt@0.2.1-rc.1   # 升级对照（README diff 60 行要点见 §2）
gh api repos/Awoodwhale/dsh-agent-persona/contents/README.md   # 近邻能力一手
gh api "repos/awesome-dsh-plugin/awesome-dsh-plugin/contents/data/plugins" --jq ".[].name"  # 同类普查
# 本机一手：@deepseek-ai/dsh-system-prompt/lib/types/index.d.ts（API 全貌）与 README.zh.md
```

## 7. 结论与呈报（拍板项）

1. **技术面全通**：前置/深改/查看/作用域/回滚均有**合法机制**（order 外部段＋complete＋公开 assemble）——不需要动 asar，“升级即碎”的主要红区不存在。
2. **复用面：近邻 `dsh-agent-persona` 已覆盖大半**。呈报三条路线待拍板：
   - **路线 A（复用为先，推荐）**：先用近邻满足“纪律注入＋作用域＋查看＋开关”；本插件只做三件净增量（complete 深改／AGENTS 共存／段归属），或最终只出一个“深改＋共存”小插件并与其互斥协作。
   - **路线 B（自研全栈）**：按原规格做一个完整的「DSH自定义」；机制与 UX 深度借鉴近邻；代价＝重复建设其已成熟的部分，收益＝单页统一体验。
   - **路线 C（分步）**：先装近邻实测其“默认人设=纪律”形态与工作区作用域（半天，零开发），据实测再定 A/B。
3. 设计冻结稿按**路线 B 的分期骨架**给出（`dsh-custom-prompt-design-20261017.md`），其中 P0＝只读视图＋总开关（对 A 路线同样成立、可独立交付）。
