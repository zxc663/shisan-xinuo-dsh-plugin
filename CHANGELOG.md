# CHANGELOG（内部工程版本记录——非发行公告）

## 收口批1（进行中，2026-10-16）：测试基建去假绿＋词表口径对齐＋收口任务总表

- 测试基建两处失信修复（审计登记在案）：`test/l3-patterns.test.mjs` 去掉本地旧正则、**直连真引擎 `judgeL3`**；`tests/review-claims-check.mjs` 补退出码＋`--expect-fail` 负向控制；新增接线套件 `tests/review-claims-wiring.test.mjs` 常驻把关（normal exit 0 / expect-fail exit 1）。**负向控制实测**：改坏 `L3_PATTERNS`→套件变红（2 MISS／exit 1），还原复绿。
- 公开文本机检对齐政策：`ai-tool-name` 规则补「端点字面量」豁免（`openai/v1`）＋3 枚回归用例（含豁免不放水对照）；修复上一提交遗留的 1 处违规；工作树 128 受控文件 0 违规。全量 `npm test` **22/22**。
- 新增 `推进库/2026-10-16-收口任务总表.md`（v5 活表：任务×可计算收益×状态，滚动勾稽）。

## 探针批＋施工批（2026-10-15）：宿主 API 五证实／concludeTurn 改道／guard 单调层／发行形态打通

- **探针批（docs/probe-host-api-20261015.md）**：对实际绑定线 0.2.0-rc.2 宿主包静态取证——`ctx.tools.guard`（单调缝，源码注释确认）、`concludeTurn`、`defineTool`、`workflowEngine`、`ctx.goals` **五个 API 全部存在**；第三方评审 P0-1/P0-3 的「能力普查缺口」成立。
- **concludeTurn 根因改判＋修复**：b2「本版不可用」结论被推翻——宿主实现 `WeakSet.add(this)`，我方解构裸调丢 `this` 即抛 weak-set 错（**调用姿势 bug，非宿主能力缺失**）。修复：`ct.call(execCtx)`；补齐无断言 pass 分支缺失的 conclude 块（弱证据不闭环不标记）；真会话对照实验证实语义（探针：工具结果后回合立即终止；对照：模型仍有收尾发言）。
- **收口改道默认启用（方案三施工）**：`concludeOnPass` 默认 ON（`SHISANUO_CONCLUDE_ON_PASS=0` 退位）；失败路径 steer 打回不变。
- **guard 单调层（方案一施工）**：新增 `ctx.tools.guard` 注册——被上游规则拒绝的命令 TTL 内经任何工具通道重试=单调拒绝（重放防护，HMR 移规则不豁免）；L3 ask 留 pre-execute（guard 只承载 deny，官方分工）。「下游优先」顺序机制保留（用户 deny 压过我方 ask 的实测语义；瀑布重排 API 未实证不盲拆——如实偏离评审「退役补丁」口径并记录理由）。
- **发行形态打通（P0-4 闭环）**：`dsh.bundle` manifest＋`cordis.patch.yml`（包名+子路径）＋`pnpm pack`；**实测发现 Node 22 type-stripping 不支持 node_modules 下 .ts → 预编译 lib/ 为发行必需**（新增 `npm run build`＝tsc 转译，构建零错误）；隔离档 tgz 安装→组成树合成→**会话级挂载证实**（注入面含纪律文本）。运行时零宿主硬依赖（cordis 仅 type-only），不声明 peerDependencies——规避宿主 fail-closed peer 检查（outcome-loop 拒装案例）。
- 新日志 kind：`probe-conclude`／`guard-deny`（tally 白名单机检先红后绿）。构建配置：`tsconfig.build.json`（转译导向宽松型）＋`types/cordis-stub.d.ts`（宿主 alpha 类型面波动隔离）。
- 验证：`npm test` 20/20；探针会话×4＋对照×1（证据=会话日志+exec-log）；发行链 tgz→add→dump-config→boot 五步实测。

## 仓库结构（2026-10-15）：三库结构落地 ＋ 协作面建设

- **三库结构**：新增 [想法库/](想法库/)（未验证想法，含条目规则与索引）、[推进库/](推进库/)（在推进事项的入口索引＋入库标准：验收判据／回滚基线／边界）、[验证库/](验证库/)（三层证据＋可重跑命令＋结论口径）；原 `想法思路总结/` 改名入列。README 增「状态与发行口径」「三库导航」「希望社区帮助验证什么」「如何反馈」四节。
- **公开口径收紧**：**只有打包好的公开发行版才算真实验证可用**。本仓当前 0 tag／0 release／无打包产物（`package.json` 无 `dsh.bundle` 清单，仅 `file://` 开发态加载），故现阶段**没有可用版本**，全部主张为开发态结论；发行暂不进行（先经过实际环境验证）。
- **协作面**：Issue 表单四类（Bug／兼容性／文档／设计讨论）＋模板选择页（含 Discussions 与私密披露入口）；PR 模板（变更动机／影响面／可重跑验证与退出码／文本规范）；`SECURITY.md`（含「不是安全边界」的先行声明与私密披露渠道，仓库已开启 private vulnerability reporting）；`CONTRIBUTING.md` 拆为 A 贡献指南（欢迎范围／反馈路径／PR 流程／处理方式／MIT inbound=outbound）与 B 公开文本规范（原 §0-§5 顺延为 B1-B6）。
- **机检引用去编号化**：`scripts/check-voice.mjs` 与 `tests/repo-voice.test.mjs` 改为按节名引用规范（不再依赖易漂移的 § 编号）。
- 验证：`npm test` 20/20 套件绿；公开文本机检 103 个受控文件 0 违规；20 条机制级主张 20 成立。

## 体验缺口修复（A 组，2026-10-14）：不可执行形态／目录报假面／环境故障误判

- **P1（最高杠杆）`discipline_gate` 新增 `assert` 参数**：取值形如 `not_exists:<路径>`／`exists:<路径>`／`path_contains:<路径>::<子串>`，由插件**内联求值、永不过 shell**；`cmd` 与 `assert` 至少给一个。此前"失败打回"文案里给的算子（`not_exists/…`）会被原样当成命令喂给 `cmd.exe`（Windows 下不成立），模型在"一时拿不出可执行验证命令"时无路可走、只能挑一条必定返回 0 的无关命令凑通过。现在失败／阶梯文案统一**指向 `assert` 参数**。
- **P2 `discipline_task` 默认可达**：不再受 `ASSERT_LAYER` 默认关闭的门控（`SHISANUO_NO_ASSERT=1` 仍为最高优先关闭位）。
- **P4 目录改报线缆真值**：`discipline_tools` 的"可见工具"改取 `request/header`（宿主真正发出去的那份），并**删除恒为 0 的 `deny` 字段**——报假面比不报更坏。
- **P7 环境故障单列**：沙箱／ACL 拒绝（如 `SetNamedSecurityInfoW` 失败）归为新状态 **`channel-unavailable`**，明示"这是环境故障、不是你的验证未通过"，不计入 `mismatch`／`honest-fail`，并给出 `assert` 作为绕开该通道的出路。
- 证据：`tests/gate-assert.test.mjs`（14 条，含**反证**——给 `assert` 时 `runCmd` 调用次数恒为 0）；`scripts/claims-check.mjs` 新增可外部重跑主张 K12–K15 ＋ 判据自测 N1–N3。

## 任务级作用域（B 组，2026-10-14）：一次性单向门 → 任务级可升

- **任务键**：以**用户原文消息**开任务（客观锚，不依赖模型自觉），`discipline_task register` 可显式覆盖同一任务；`taskId` ＝ 自增序＋时间戳。
- **失败阶梯与熔断计数按任务分桶**：`failCount`／`steerCounts`／`taskRecords` 换键到任务 ⇒ 新任务即重置。修掉"跨任务累计"——上一轮任务的失败会把下一轮的模型直接推到高阶梯（"停止试凑"），而它对这一轮任务一无所知。
- **工具面版本化**：`budgetApplied` 布尔单向门改为**档位序**（`appliedRank`）——新任务档位**高于**当前生效档时重新应用（借宿主 `restrict` 返回的解除器先解除旧限制）；**降档不自动放宽**（延续"只许加强不许放宽"）。
- **升档封顶**：升到"全量"（`*`）时按 L2-S 的显式白名单收窄，并追加只读研究类（`web_search`／`web_fetch`／`job_*`／`skill`）——避免一次升级即无限制放宽。
- 新日志 kind：`task-open`／`budget-upgrade-ignored`／`budget-upgrade-capped`（已入 tally 白名单；白名单守护机检先红后绿）。
- 证据：`tests/gate-assert.test.mjs` ⑤（换任务阶梯归零）；`scripts/claims-check.mjs` K14。

## 掩码语义实测（Step 0，2026-10-14）：headless 零漏网，**桌面档 `subagent` 逃出掩码**

- 探针 `SHISANUO_PROBE_MASK`（默认关）在首个 `request/header` 打印**声明面 vs 线缆真值**的双向差集。headless：`declared=27 wire=9`、`仅线缆面=—`（零漏网）。
- **桌面档真机复算推翻了"零漏网"**：同一份源码挂进桌面档，`L=L1 → allow=9 / wire=10`，升到 `L2-F(封顶 L2-S) → allow=15 / wire=16`，**两次恒定多出 `subagent`**（截图＋`exec-log`＋工具返回原文三路取证）。⇒ 掩码不是封闭面。
- 处置（不静默）：新增 `maskLeak(wire, allow)` 与常态化核对——每次请求用线缆真值对本档允许集求差，非空即落 `budget-leak` 账，并在 `discipline_tools` 里如实上报越出项与件数。**未验证项**：子代理继承的工具面是否受掩码约束。详见 `docs/extension-design-20261014.md` §五／五之补。

## 工具参数 schema 修复（2026-10-14）：宿主升级后整轮运行失败

- **症状（真机）**：桌面档会话整轮失败——`Invalid schema for function 'discipline_gate': schema must be a JSON Schema of 'type: "object"', got 'type: null'`（连续两轮）。
- **根因**：三个工具的 `parameters` 用的是自有**扁平 DSL**（`level: {type:'string', required:true, …}`），`discipline_tools` 更是 `parameters: {}`。宿主新版本要求**标准 JSON Schema**（`type:"object"` + `properties` + `required` 数组），空对象被读成 `type:null` ⇒ **工具注册校验失败、整轮中断**。
- **修复**：`discipline_gate`／`discipline_task`／`discipline_tools` 的参数全部改为标准 JSON Schema（`required` 由逐字段布尔改为数组）。`execute()` 读参方式不变。
- **护栏（新增套件）**：`tests/tool-schema.test.mjs` —— 逐个构建工具定义并断言 `parameters.type === 'object'`；该类故障此后会**在套件里直接红**，而不是到真机上才炸（18/18 套件）。
- **教训**：宿主为 alpha，**工具契约会变**；凡"宿主读我们给的结构"的地方，都应有形态护栏（本条即补上）。

## F2 盲区护栏（2026-10-13）：零工具调用却声称完成

- 背景：完成信号电池的 F2 发现——回合若没有任何工具调用，收口链（断言自动复核／gate 强制）整体跳过，此类回合的"已完成"声明无任何核验；电池中 4 例零工具回合均为诚实停点，但**盲区本身成立**。
- 变更：新增判定 `judgeZeroToolClaim`（完成语 ∧ 无阻塞语）与开关 `SHISANUO_ZEROTOOL_GUARD`（**默认关闭**，避免骚扰纯聊天回合）；开启时记录 `zerotool-claim` 并轻量提示一次（每回合上限 1，沿用防循环约束）。
- 遥测：`zerotool-claim` 已同步进 tally 白名单（守护机检先红后绿：新增 kind 未入表时测试直接 FAIL，实测一次）。

## 判据来源默认序调整（2026-10-13）：启发式推导退位为可选辅助

- 依据（电池实测双重指标）：误推导 3/13（代价＝1 次假阻塞＋1 次超时＋2 次 steered）；关闭推导后步数 8→6、每任务累计上下文 351 KB→208 KB（−41%）。
- 变更：`ASSERT_LAYER` 默认关闭；新增 `SHISANUO_ASSERT_LAYER=1` 显式启用（研究／实验）；`SHISANUO_NO_ASSERT=1` 仍为最高优先关闭位。
- 判据来源默认序＝会话外锚（pinned）> 工具自登记（tool）；推导层在启用后仍受「pinned > auto > tool」约束。
- 跑批器同步：C／D 两臂显式设 `SHISANUO_ASSERT_LAYER=1`，与既有电池数据保持同语义可比。

## GUI 抽检与高能力档首证（2026-10-13 · 桌面 App）

- 注册 ModelScope provider（headless/desktop 双侧；密钥入各自 `.credentials.yaml` refs，外于仓库、不入库）；高能力档=`deepseek-ai/DeepSeek-V4-Pro`（推理型）＋备选 `Qwen/Qwen3.5-397B-A17B`。
- GUI 四会话（删除/陷阱/钉死锚/无锚）：与 headless 电池结论一致；G2 模型自诊断机制错误并交还人类裁决，G3 外部锚干净收口。详见 `docs/validity-report-20261013.md` §6。

## 完成信号有效性验证轮（2026-10-13，85 会话）

- 执行预注册电池（`docs/design-specs/completion-signal-validity-plan-20261013.md`，含 R1–R5）：五臂（A 裸/B 仅 gate/C 全量/D 全量＋锚/P 锚替启发式）× 锚定 12＋无锚 6＋陷阱 1；模型固定免费档，headless 批量。
- 结果：`docs/validity-report-20261013.md`——H1 不可分辨（0/12 vs 0/12）、H4 成立（误推导 3/13，外部锚 0）、F1/F2/F3/F4 四条附加发现；建议修订=推导降级为辅助、锚优先（待批）。
- 工具：新增 `scripts/validity-run.mjs`（含 `--reclassify` 离线重判与断点续跑）；核心新增研究旗标 `SHISANUO_L3_OFF`／`SHISANUO_NO_ASSERT`（默认关）。

## 判据锚点批（2026-10-13，审计续审之三）

- 新增 **pinned 断言（判据锚点）**：`SHISANUO_ASSERTIONS` 在会话外钉死验收断言——不进入任务记录、`clear`/`replace` 物理不可触；收口链（turn-stopping 自动复核/收口遗留落账/gate 断言复核）统一按「pinned>auto>tool」求值。
- 遥测新增 `pinned` 日志 kind（tally 白名单同步；白名单守护机检先红后绿验证）。
- 文档：audit-response §七（洞 A/B 拆分、残余边界与「可迁移判据」采用）；README 配置表与「代价与风险」同步。

## 判据权威加固批（2026-10-13，审计续审之二）

- `discipline_task.replace`：仅替换工具自登记断言；**用户原文推导断言（auto）恒保留**（模型不可移除/改写判据）；reason 门退役（防护对象已由边界层关闭）；审计字段 `replacedAuto→preservedAuto`。
- 遥测新增 `SHISANUO_LOG_DISABLE=1` 关闭开关（不留痕环境）。
- 文档：audit-response §六（口径更正——收口强制存在行业成熟同类；有机谎报样本未命中如实记录）；README「代价与风险」补「一致性≠有效性」与循环防护对比；positioning/implementation-batches 同步更正。

## 审计续处置：代价与风险四件（2026-10-13）

- 日志脱敏：遥测写入前对常见密钥形态做深脱敏（sk-/gh*/Bearer/token=…/URL 凭据），新增测试套件。
- 收口强制前缀收敛为单一常量（发送与排除共用，消除字面量漂移风险）。
- README 新增「代价与风险（如实）」：验证通道护栏边界、steer 注入形态、日志明文与脱敏、开发态绑定——明确「不作为安全边界」。

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
