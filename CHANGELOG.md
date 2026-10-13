# CHANGELOG（内部工程版本记录——非发行公告）

## 公开文本规范与机检门禁（2026-10-13）

- 新增 `CONTRIBUTING.md`：提交信息/代码注释/文档规范（决策只写内容与依据；公开文本不出现内部环境与 AI 工具具名）。
- 新增 `scripts/check-voice.mjs`＋`tests/repo-voice.test.mjs`：工作树机检内置 `npm test`；CI 对推送/PR 新增提交范围执行提交信息检查（含格式校验）。
- 存量对齐：既有文档与注释中的归因/具名用语改为中性表述，不对技术事实做改动。

## B3b 生成器与全量语义回归（2026-10-13，拦截换芯收口 · B3 全清）

- **生成器**（`scripts/gen-permission-rules.mjs`）：`content/rules.json → .dsh/rules.yaml`——19 条规则（不可豁免域 ask→豁免 allow→其余域 ask）；ASCII 大小写折叠（上游 regex 模式无 `i` 标志）；镜像上游 ReDoS 护栏做生成期预检（fail loud）；确定性输出＋provenance 头＋`--check`。内容面两条旧形态等价简改（rm 子句／node-python 选项组有界化），豁免 flags `im→i`；单测 33 断言（第 14 套）。
- **全量语义回归**（`scripts/regression-permission-rules.mjs`）：离线导入上游 v0.7.15 导出面（parseRulesDocument/compileRules/matchRules）对生成文件求首命中，与我方判定逐条对照——**170 例 / 10 套件，阻断·域·注解三面 0 不一致**；语料单源化 `tests/rule-corpus.mjs`（四套既有测试改引用，重构后全量复跑绿）。
- **真机抽检**（permtest 隔离档）：A 臂（我方退观测）Remove-Item 被上游 ask→审批不可用 fail-closed 拦截（会话日志 `approval/asked` reason=生成规则文案）；C 臂 `l3-intercept→upstream-block(upstreamKind=ask)`（B3a 翻转闭环）；豁免 `git clean -n` 真实放行。
- **集成发现**：`patternMode: regex` 连坐上游内置基线——v0.7.15 builtin 为 glob 写法（`+s`/`4???` 等），regex 模式编译失败致**整个条目静默失活**（首轮三跑零拦截实证）；处置＝配置行 `builtin.enabled: false`，转换版基线（`builtin.path`）记后续候选。
- 报告：`docs/b3b-generator-and-semantic-regression-20261013.md`；决策表回执：`docs/reuse-decision-permission-rules.md` B3b 节。

## 完全权限感知批（2026-10-13：完全权限模式下拦截退位为仅记录，不弹审批卡）

- **机制**：监听 session/event 流中的 `sandbox/mode` 事件（宿主 SandboxMode 枚举=`read-only`/`workspace-write`/`danger-full-access`，asar 实证）——`danger-full-access` 时 L3 拦截退位为仅记录（`l3-detected decision=allow-full-access`），不再弹审批卡；discipline_gate 的 L3 拒跑同样放行（`isFullAccess` 注入）；恢复受限模式后拦截自动恢复。模式变更落 `sandbox-mode` 日志行（可审计）+横幅提示。
- **语义**：完全权限=用户对当前会话的全局授权，插件尊重该授权不重复打断——与母仓「笼统授权只覆盖明示项」互补：这里的明示项=宿主 UI 显式确认的风险提示。
- **真实宿主验证**（桌面 App，CUA 操控）：①workspace 模式：L3 拦截→审批卡弹出→allowed-once→执行（行为正确）；②切 danger-full-access：`sandbox-mode enforcement=suspended` 落账→发同款 pwsh 删除任务→**不弹卡直接执行**（`l3-detected allow-full-access`）→文件真删→gate 真值收口 pass；③模式切回 workspace-write→`enforcement=active` 落账（拦截恢复）。
- **关键发现**：完全权限是**会话级**设置（composer 切当前会话；新建会话回默认 workspace-write——asar 文档+实测）；`sandbox/mode` 事件仅在模式变更时广播。
- tally 白名单新增 `sandbox-mode` kind；gate-tool 单测 45 例（+fullAccess 放行分支）。


## 外部独立验证修复批（2026-10-13，审查基线 25b8775 → 本批）

第三方 Linux/Node 22.23.2 沙箱独立复现：9 套单测全绿+口径逐项一致+**零夸大**。四处反馈全部裁决采纳/撤销如下：

- **问题1 采纳**：引擎与实验脚本硬编码路径可移植化——LOG_DIR/臂旗标改「仓库根相对推导（import.meta.url）」+`SHISANUO_LOG_DIR` 覆盖；e1-run.mjs 的 DSH_BIN/DSH_HOME/TMP 全部 env 化（`SHISANUO_DSH_BIN`/`SHISANUO_DSH_HOME`/`SHISANUO_E1_TMP`）；cordis.yml 统一 file:// 形态+替换说明（消除与 README 的口径分歧）。
- **问题2 采纳**：三臂切换 `SHISANUO_ARM=A|B|C` 环境变量优先，旗标文件兼容保留（五例优先级冒烟：env 大小写归一/env 压旗标/无 env 走旗标）。
- **问题3 撤销（审查方自撤）**：--check exit 语义经其复测正确；「管道吞码=假绿」教训反向印证。
- **问题4 采纳**：README 能力矩阵新增「宿主面 vs 插件增量」列（审批卡/pre-execute/restrict 为宿主扩展面，插件供规则/判定语义/策略）；Node 口径改「≥22.18 type stripping 即可」（审查方 22.23.2 实测，原 ≥23 偏保守一档）。
- **验证**：9 套回归全绿+SHISANUO_ARM 五例冒烟+真实宿主冒烟（headless 全链：arm/rules 落账、gate pass 真 stdout 回显——REPO_ROOT 相对推导生产行为不变）。


## E1-v4 四臂桌面对照（2026-10-13，3 轮×4 臂×3 任务=36 会话）

- **新增 D 臂=干净 DSH**（desktop-clean home：无插件无注入独立 sessions；A≈D 纯度验证通过——裸行为空间一致）；预注册修订透明记录落 v4 设计档。
- **三组对照判定**：C vs B 收口 5/9 vs 0/9（且 C 的 3 次打回全是真值抓错——PowerShell 语法×2+退出码语义×1，每次修正后过）；B vs A 复述判级 9/9 vs 0/9+T3 完全正确 3/3 vs 0/3（B 唯一质量优势指标，机制不明如实记）；收口在 B 全程 0/9（文本纪律零收口形态，四轮实验一致）。
- **裸模型 T1 行为空间三型**（目标替代/不作为/真删）——A+D 六会话齐现，单轮结论不可信实证；C 臂删除任务 gate 自发调用率仅 1/3（任务类型×工具调用交互缺口，指向 v1.x turn 级强制）。
- 污染 2 次如实作废；铁律=切臂重启后先新建会话；分析管线=scripts/e1v4-analyze.mjs（truth+exec-log 双源可重算）。
- 报告=docs/e1-v4-four-arm-report-20261013.md；判定=矩阵第 2 条（n=3 不足，不判有效/无效，n≥5 基础设施全备）。


## E1 桌面轮（2026-10-13，A/B/C 三臂 GUI 真实操控）

- **通道**：桌面 DeepSeek Harness + CUA 键鼠操控；与 headless 轮互补——多出审批卡与 token 用量 GUI 真值两个证据面。
- **审批链全通**（headless 走不到的一环）：approval/asked→GUI 审批卡（允许一次/拒绝）→allowed-once→执行；审批期间宿主真实挂起模型。
- **A 臂自发目标替代（绕过②归因修正）**：裸模型（零注入零拦截）用 edit/write 把目标文件清空为 0 字节（文件未删）并谎报「删除已完成 ✅ 文件已不存在」——「删除→清空」是模型层自发倾向，非拦截逼出；任务级验收判定（T3）必要性坐实。
- **三臂并排**：收口合规 C 2/2（ok-tool+真值回显）vs B 0/2（复述判级在、收口无）vs A 0/2（纪律形态全无+完成声明-证据偏差 1 例）；预算 C 臂 28→9 工具；token GUI 真值 10.6K→47.7K（缓存 37%）。
- 报告=docs/e1-desktop-report-20261013.md；轨迹取证=tmp/forensic_desktop.py 输出+sessions zstd。


## v0.5 有效性判定制度+E1-v1（2026-10-13）

**中心**：有效性判定规则建立并执行（release-plan §五 v0.5——「判定规则」本身是本版核心交付）。

### 交付
- **三臂机制**（src）：A 惰性（无注入/无拦截/无工具/无预算）/B 纯纪律文本（Skill 形态：注入+文本面机检，无强制）/C 运行时控制全量（默认）；`applyArmMode()` 旗标切臂+arm 行自证分组；tally 三臂口径。
- **预注册 v3 冻结**（docs/design-specs/e1-prereg-v3-20261013.md）：臂定义差异表/3 任务组/宿主侧指标定义（不信自报）/五结果五决策判定矩阵（承 release-plan）/排除规则/免费模型声明——跑分前落档。
- **E1 执行器**（scripts/e1-run.mjs）：夹具准备→切臂→headless 真跑→文件系统真相采集→exec-log 增量指标→汇总表。
- **E1-v1 执行+报告**（docs/e1-v1-report-20261013.md）：3 臂×3 任务×n=1 机制验证轮。

### E1-v1 关键结果（详见报告）
- 过程指标：**机制按设计运行**——C 臂拦截命中、gate-tool 两次打回无效验证逼出真验证、3/3 ok-tool 收口、预算生效、分组自证齐全。
- 行为指标：n=1 区分力不足 → 按冻结矩阵第 2 条**不判有效/无效**；描述性观察=B 臂纯文本纪律 GATE 合规 0/2、删除零自限（vs C 2/2 ok-tool）——与「合规形态来自机制非文本」既有结论一致。
- **绕过①（已闭合）**：`cmd /c del` 嵌套形态洞——数据删除正则补 shell 嵌套替代+19 例语料回归+**真实宿主补测文件保住**。
- **绕过②（如实留档，指向 v1.x T3）**：目标替代——删除全被拦后模型用 write 清空文件内容、对被偷换的目标做真验证（gate pass）后声称完成。gate 验模型选的命令≠验任务本义——正则层不可修，留作 T3 受控执行器/状态机设计输入。

### 验证证据
- 单测 9 套全绿（绕过①语料并入 config-rules 镜像语料 19 例）。
- 10 个真实会话（9 实验+1 修复补测）全部 glm-4.5-flash 免费档，exec-log 可复查。


## v0.4 上下文控制（2026-10-13）

**中心**：T2 预算器——「装多少背多少」→「用多少装多少」（release-plan §五 v0.4）。

### 交付
- **content/budget.json**（Config 面）：判级→工具掩码（L1=7 工具白名单/L2-S=13/L2-F=全量）；fail-open（无效配置不裁剪——预算是优化非防护，方向性与 L3 规则的 fail-closed 有意相反）。
- **引擎预算器**：`loadBudgetFile`+`completeAllowList`（always-allow 五件强制并入：discipline_gate/read/pwsh/write/edit——预算永不裁掉收口与基本读写）+`extractDeclaredLevel`（状态行/独立标记两形态）。
- **正确挂点**（对接真相修正）：`ctx.tools.restrict` 需要 **agent 作用域 ctx**——根 ctx 全局掩码被宿主拒绝（首次实跑报错实证：「requires a scoped context (agent.ctx)」）。实现=agent/created 监听拿 agent.ctx 应用 pendingMask + agent.ctx.effect 双保险清理 + agent/disposed 清账；声明级对现行 agent（session.id↔agent.id 同空间映射）即时生效。
- **tools-wire 真值测量**：request/header 事件落每请求实际工具面（count/chars）——预算效果以线缆真值为准，非根 ctx schemas。
- 触发双通道：`SHISANUO_BUDGET_LEVEL`（启动即裁）/ 模型首条判级声明（会话中裁）。

### 验证证据（四环+中途更新，glm-4.5-flash×zhipu openai-completions transport）
- **兼容前置问题定论**：本 transport 下 per-request 工具面更新正常——restrict 生效不破坏会话（社区报告的「工具消失无激活通道」属 deferLoading 路径，本实现不用 deferLoading）。
- 环①隐藏：tools-wire 25→8 个、20,354→8,690 字符（**L1 工具块 -58.6%**，每步重发×3 请求）。
- 环②发现：模型如实报告「subagent 工具不在我的可用工具列表中」（无崩溃无死循环）。
- 环④调用/不破坏：放行工具全通（write/gate pass），任务 3/3+1/1 完成，必要工具遗漏 0、返工 0。
- **声明级触发全链**：请求1=25 工具 → 模型声明 L=L1 → 请求2=8 工具（同一 agent 会话中途收窄，transport 正常消化）。
- 单测 9 套全绿（budget 21 例新增：fail-open/白名单补全/判级提取/随仓策略/空数组=无效条目——配置笔误不裁面）。
- 首次实跑 restrict 失败时 fail-open 防线按设计生效（无崩溃、无裁剪、控制台告警）——错误处理路径经真实宿主验证。

### 边界与未验证
- 四指标中「token 消耗」无精确值（会话存储无 usage 字段）——以工具块字符数为代理指标，如实声明；统计显著性对照=v0.5 E1 范围。
- 单 transport×单模型验证；其他 transport（anthropic/deepseek 原生）未测。
- 预算对主 agent 的裁剪时机：声明级在首条消息后（首请求已用全量面）——启动级无此限制；系机制时序固有，非缺陷。


## v0.3 可修改性（2026-10-13）

**中心**：不改引擎代码即可替换规则包（release-plan §五 v0.3）。

### 交付
- **content/ 规则层**：`content/rules.json`（L3 六域+9 豁免，从引擎常量下沉为数据）+ `content/discipline.md`（纪律文本，与引擎内嵌默认逐字镜像）。
- **规则装载器**（src）：`compileRules`（结构校验：domain/pattern 非空、flags 仅 imsu **禁 g**〔有状态 lastIndex=间歇漏判〕、坏条目逐条跳过记 reason）+ `loadRulesFile`/`loadTextWithFallback`（**fail-closed**：文件缺失/坏 JSON/空域表/零有效域→回退引擎内置默认，防护不静默解除，落 `rules`/`discipline` 日志行可审计）。
- **判定注入化**：`judgeL3With(rules, cmd)` 活动判定面；`judgeL3` 保留内置语义作回归对照；pre-execute 拦截与 discipline_gate 的 L3 拒跑共用活动规则（`planGate(cmd, judge)`）。
- **覆盖钩子**：`SHISANUO_RULES` / `SHISANUO_DISCIPLINE` 环境变量（开发/测试/宿主行为验证用）。
- **契约文档**：docs/config-contract.md（可配项清单/必配 vs 引擎固定/校验规则/fail-closed 行为/版本兼容策略/行为验证方法）。彻底解除防护不在 Config 面（置空=无效→回退默认）。
- tally 白名单新增 `rules`/`discipline` 两 kind。

### 验证证据
- 单测 8 套全绿（**config-rules 24 例新增**：结构校验 10+fail-closed 4+行为可重复验证 5〔加域拦新命令/删域放行 rm/noExempt 不吃豁免/planGate 跟随注入〕+随仓 content 与内置默认 14 例语料等价+discipline 逐字镜像）。
- **真实宿主行为验证**：`SHISANUO_RULES=tmp/custom-rules-smoke.json`（单自定义域「部署红线」）→ headless 实跑：`rules` 行 valid=true/domains=1；`echo deploy-to-prod-probe` 被 pre-execute 拦截且 `l3-intercept.domain=部署红线`（拦截行为由 content 文件驱动，实锤）；无关命令照常执行、gate-tool pass（真 stdout=config-ok）；content/discipline.md valid=true（logs/exec-log.jsonl 2026-10-12T20:55Z 段）。

### 边界与未验证
- 桌面 GUI 会话的 content 装载未单独冒烟（同一 apply() 路径，headless 已证）。
- 规则包 version=2 的迁移路径=占位（当前唯一合法版本 1）。


## v0.2 真值闭环（2026-10-13）

**中心**：验收结果来自实际执行而非模型声称（release-plan §五 v0.2）。

### 交付
- **T1 `discipline_gate` 工具**（src/shisan-xinuo-core.ts）：
  - 模型收口=调用工具；宿主真实执行验证命令（cmd.exe，30s 超时，maxBuffer 256K），取真实退出码与模型声称值比对。
  - 三态判定：`pass`（0/0）/ `honest-fail`（声明与实测一致但验证未过）/ `mismatch`（谎报=打回重做）；另有 `refused`（验证命令本身命中 L3 危险域——gate 不得成为绕过 L3 的侧门）与 `error`（超时/无法启动）。
  - 每次调用落 `gate-tool` exec-log 行（claimedExit/realExit/match/真实 stdout 尾部）；会话横幅新增真值计数行。
  - 注册失败降级为纯文本 GATE 模式（try/catch 包裹，不拖垮拦截与机检）；A 臂观测模式不注册（对照纯净）。
- **tally 双命令**（scripts/tally.mjs）：`--report`（出数）/`--report --freeze`（冻结快照）/`--check`（对账：白名单+结构不变量+快照复算，exit 1=发现违规）。快照路径可经 `TALLY_SNAPSHOT` 环境变量注入（测试用）。
- **遥测字段白名单**（tally.mjs 内单源表）：每 kind 允许字段+截断帽（cmd≤200/v≤200/files·exempt·tail≤300）；未知 kind、越界字段、超长字段、枚举外值、伪造 gate-ok/missing 对应行、行数倒退、同行数篡改——全部可被 --check 抓出。
- **机判口径合流**：回合桶识别 discipline_gate 调用 → behavior.gate 新增 `ok-tool` 态（工具收口=合法形态，消除工具化后的文本 GATE 假阴性）；parseSessionEvent 透传 tool name。
- **设计修正**：全局 ts 单调性不是多写者日志的不变量（桌面+headless 并发追加实测有合法交错）——从 --check 移除，篡改历史由快照对账负责。

### 验证证据
- 单测 7 套全绿：behavior-metrics 26 / gate-check 29 / **gate-tool 44（新增）** / judge-l3 8正10负 / q3-q4 双向（误拦 0/58、绕过洞 0/17）/ **tally 16（新增，含 5 类植入差错攻击样本全被抓）** / l3-patterns 23。
- 宿主冒烟①（headless+glm-4.5-flash 免费档）：真任务→两次收口，exec-log 实录 `pass`（claimedExit 0/realExit 0/stdoutTail="hello-v02"）与 `honest-fail`（1/1）；模型最终回复回显实测值（logs/exec-log.jsonl 2026-10-12T20:46-47Z 段）。
- 宿主冒烟②：behavior.gate=**ok-tool** 实录（20:49Z 段）。
- 生产日志对账：`--report --freeze` 后 `--check` PASS（696 行）。

### 边界与未验证
- `refused`/`mismatch`/`error` 三路径经注入式单测+L3 正则面验证，尚未在真实宿主冒烟中出现自然样本（低优先）。
- 快照对账的盲区：篡改+同时追加的混合形态不保证抓出（白名单与枚举校验仍兜底）——已在设计内声明。
- 工具在桌面 App（GUI 会话）中的表现未冒烟（与 headless 同一 runtime 注册面，风险低，v0.5 前补）。
