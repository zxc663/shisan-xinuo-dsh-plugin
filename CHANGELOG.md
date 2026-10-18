# CHANGELOG（内部工程版本记录——非发行公告）

## 只读回合判级强制修复（2026-10-19 · 实机缺陷闭环）

> 缺陷（用户实机截图证实）：只读问答（7 次工具调用）首轮无状态行，宿主亦未触发任何「补判级」强制。根因＝turn-stopping 处理中「只读回合免收口」早退置于 F1/F2 判级强制**之前**，把判级检查一并吞掉（纯函数 `judgeDisciplineGap` 契约本含 hostLevel≥1 的判级面、测试早已锚定——属**接线顺序违规**，非设计）。模型自述跳过原因＝「把它当成纯聊天问答」。

- **修复**：F1/F2 块前移至只读早退之前——只读回合（hostLevel≤1）**不再豁免判级声明**；收口豁免（C2）语义不变；清单强制在 handler 侧按 `hostLevel>1` 门控（只读回合无验收对象）；零工具/纯聊天早退不变（0 误注入面收窄为「零工具」）。
- **§0 明确句**：首轮必写括注「**单次/只读轻查询同样写**——state 记 单次、L 记 L1」（CORE_DISCIPLINE 镜像＋agents-md 变体同步）。
- **诊断注记**：`behavior.levelDeclared` 为宽松口径（正文提及等级亦可，刻意设计并与测试锚定），与强制口径 `extractDeclaredLevel`（严格 `L=`）不同——本次假阳源＝正文表格「L3 拦截」；诊断判级合规以严格口径为准。
- **实机复验（桌面 App）**：①正常只读问答自发输出 `Context: state=单次 L=L1`＋「单次：未建承载」；②**陷阱回合**（明示不许写状态行）→ `discipline-steer needLevel=true declared="" hostLevel=1`（修复前此路径必静默）→ 模型补状态行＋`discipline_gate(level=L1, pass)`＋完整收口五件。
- **测试**：37/37 套绿（level-checklist 契约面重申：hostLevel≥1 判级照查；本块注释为接线顺序回归锚）。

## C8-B 工具矩阵下沉（2026-10-19 · 核心再分层）

> 需求：常驻核心按「每回合必需 vs 按需」再分层（C8 批的 B 方案；A/C 未取）——§6 工具触发矩阵明细下沉按需层。

- §6 完整矩阵下沉 `layered/tool-triggers.md`（606 字；触发=工具选择/边界判断，S 级；含四工具必须/可选/跳过全表）；核心 §6 保留「要点」两行（L2+ 收口必须 gate＋断言自动复核/只读豁免、L2-F 登记、目标工具与 discipline_tools 边界）＋指路。核心 **8722→8401 字**（净减 321——原估 ~1.2K 系估计有误，§6 全量实为 533 字，如实纠正）。
- 同步：CORE_DISCIPLINE 镜像逐字（config-rules 断言）；agents-md 变体同口径；`00-加载清单.md` 新增路由行；dsh-custom 出厂副本（文件＋页面出厂集/中文名「工具触发矩阵」）。
- 验证：plugin-dev 37/37 套绿＋check-voice 0；dsh-custom 12 文件绿；实机=/assembly 8401 字（新摘要在场、旧矩阵措辞零残留）＋分层页 10 节含工具触发矩阵（606 字 enabled）。

## 治理收尾批（2026-10-19 · C5 脚本随包／C6 域目录单一真源／C7 待重启徽标／P1-7 id 硬化）

> 需求：审查遗留——承载协议引用工作区外脚本（自包含张力）；治理页域目录=手抄镜像（「页面能关、引擎不认」漂移面）；「收口即终结」需重启但开关立即显示为开；会话 id 归一撞车（`a/b`→`ab`）。

- **C5 脚本随包**：`scripts/workspace-index.mjs` 参数化（`node <插件目录>/scripts/workspace-index.mjs [工作区根]`，缺省=包根）；`package.json files` 纳入该脚本；承载协议 §3 改「脚本随插件包分发；不可达时用等价目录清单（结构不变）」，CORE_DISCIPLINE 镜像逐字同步。验证=`npm pack --dry-run` 含脚本＋对另一工作区运行一次生成索引。
- **C6 域目录单一真源**：引擎启动把「有效域目录」（rules 编译后去重＋noExempt 归一）写到治理文件同目录 `l3-catalog.json`；dsh-custom 管理页优先读它（`catalogSource=engine`），缺失/坏档回退镜像（`mirror`）并在页内标注来源；域关闭/未知域 422 写校验同源。实机=上报 862B（source=真实 rules.json）＋API `catalogSource=engine`/10 域。
- **C7 待重启徽标**：dsh-custom 启动时快照 `concludeOnPass`（与引擎同批启动），治理 API 回传 `boot`；「当前值 ≠ 启动值」显示持久「待重启」徽标＋说明；重启后快照刷新自动消失。实机=拨开→徽标出现→拨回→消失、配置复位。
- **P1-7 免迁移硬化**：`sessionDir` 对含非法字符 id 用「净名＋`-x`＋原始 id 短哈希」（`a/b`≠`ab`）；规范 id（UUID 形）目录名不变——本机实测零存量非规范目录 ⇒ 无迁移；穿越负例仍全过（严格落 `sessions/` 一层内）。
- **验证**：plugin-dev 37/37 套（config-rules +7 目录上报断言）；dsh-custom 12 文件绿（p46 +9、p49 +6、归一断言更新 174 例）。

## 纪律口径批（2026-10-19 · C1–C4：状态行首轮制／盘点缩围／标级收窄／全权限口径）

> 需求：核心交互口径审查四条——状态行要求既「每轮必写」又「仅变化更新」，模型表现为每轮重复＝流程噪声；L2-S 被强制全量盘点＋失败用例＝流程税；K0–K6 要求逐句标级不可执行；「完全权限」与 L3 先停口径冲突，易被读成「无需问」。

- **C1 状态行首轮制**：`content/discipline.md` §0——标题改「首轮必写；之后仅在 模式/等级/澄清/审批 变化时重写」＋新增要点「无变化不重复贴（防流程噪声）」。
- **C2 盘点与失败用例缩围**：§1.2 触发改「L2-F 开工前盘点一次；L2-S 只在工具面或工作区未知/不确定时」；§1.6 失败用例限定「每条**可失败验收标准**（纯文案/文档类可不列）」；同口径同步 `layered/environment-inventory.md`、`layered/l2s-short-workflow.md`、`layered/l2f-full-workflow.md`、`layered/templates/acceptance-template.md`、`layered/00-加载清单.md` 路由行。
- **C3 标级收窄**：§1.5 改「K 级标注只用于**非显然/高风险/外部时效**的结论（一句话即可）；通用常识与显然事实直答，不逐句标级」。
- **C4 完全权限口径**：§1.4 新增——「宿主『完全权限』档只暂停宿主审批卡交互，**不豁免 L3 协议**（先列命令清单→停下等确认）；approval=豁免 仅在用户对该具体动作显式授权时填写」；运行横幅（`src/shisan-xinuo-core.ts`）同步改写（原「L3 审批卡已暂停」易与 L3 先停冲突）。
- **镜像与副本**：`CORE_DISCIPLINE` 常量逐字镜像（config-rules 断言在场）；`content/agents-md-discipline.md`（原生注入变体）同口径；dsh-custom 出厂副本 `content/layered/` 五文件哈希同步。
- **验证**：37/37 套绿（含镜像逐字断言）；check-voice 0 违规；docs-index/md-links 无悬挂；dsh-custom 12 文件绿。实机抽查：重启后 `/assembly` 核心段 **8674 字**（五处新措辞在场、两处旧措辞零残留＝实装硬证据）；行为样本 n=3（LongCat 免费档）短问答均未标状态行——弱模型依从性观察（文本已实装「首轮必写」，非文本回归；强模型未测，如实登记）。

## 治理开关批（2026-10-18 · L3 页面化管理＋误拦白名单＋能力开关）

> 需求：L3 拦截=宿主沙箱∪插件 10 危险域词面的加严层，误拦截时缺持久出口（审批卡无放行记忆，宿主无审批回调）——要求「误拦可治理＋治理能力页面化管理」。三拍板：能力级开关组／noExempt 域禁豁免／审批卡加引导语。

- **跨包管道**：dsh-custom 页面写 `$DSH_HOME/dsh-custom/governance.json` → 本引擎 `readGovernanceCached` mtime 热读（layered-state 同款；`SHISANUO_GOVERNANCE` 可覆盖路径；DSH_HOME 未设回退 `~/.dsh`，对齐 dsh-custom resolveHome 口径）。fail-closed：缺文件/坏文件/坏字段=该项回落默认（防护不因配置损坏解除）；boot 落 `kind:"governance"` 行可核验。
- **pre-execute 分流**：白名单命中→`l3-detected decision=allow-allowlist`＋allow 终态短路（不计 intercepted；同 fullAccess 理由防下游 ask 硬失败谎报拒绝）；`l3.enabled=false`→`decision=governance-off` 仅记录（与 `SHISANUO_L3_OFF` 实验关分账可辨）；域级关闭经 `effectiveRulesFor` 过滤（**noExempt 域引擎侧强制保留**=第二道，页面 422 为第一道）。`activeJudge`/`gateJudge` 同吃治理——gate 收口/断言求值通道自动尊重白名单与域开关。
- **白名单语义**：归一化字面子串＋词边界（与拒绝指纹同实现），最短 4 字符；无正则（消 ReDoS 面）。
- **审批卡引导语**：reason 末尾追加「如属误拦：设置 → DSH自定义 → 治理开关，可加白名单放行。」（`L3_ASK_GUIDANCE` 单源；displayReason 双语同步）。
- **能力开关**：判级/清单强制（=LEVEL_OFF＋CHECKLIST_OFF 语义；env 显式关闭仍优先——env 关了文件开不起来）、压缩重载信号（抑制落 `compaction-signal-suppressed`）、concludeOnPass（优先序 env>文件>默认关；**注册面 boot 快照，热改需重启**——页面已标注）。
- **遥测白名单同步**：`governance`/`compaction-signal-suppressed` 新 kind＋`l3-detected.allowRule` 字段进 tally 白名单（whitelist 测试先红拦截→同批补）。
- **测试**：`governance-config` 新套 41 例（装载/fail-closed/noExempt 强制/词边界白名单/热读/env 优先/行为级三态）；全量 **37/37** 套绿（+1 套）；tsc build exit 0。
- **实机三判据（桌面真机，LongCat 免费档）**：①noExempt 域关闭 API 422＋点名域；②白名单条目命中→`allow-allowlist` 落账×2（pre-execute＋gate 通道）零弹卡；③真跑删除命令→L3 卡在屏、引导语逐字可见（截图 `D:/tmp/wt-20261018-p0/24-28`）。走查后探针白名单条目已移除、配置回默认。

## 收口强制呈现改造（2026-10-18 · notice 通知，不与用户发言混排）

> 需求：收口/判级强制此前以「用户发言」气泡呈现（宿主投递接口约束），要求改为独立消息通知、不与用户消息混排（用户点名）。改造=复用宿主既有 notice 通道（零新机制）。

- **实现**：五处 steer（收口强制×3：无断言/断言未过/动作级复核未过、零工具声称完成×1、判级+清单强制×1）由 `userMessage()` 改走 `noticeMessage()` 信封——`source.form='notice'`＋单行 summary（`steerSummaryFor`：`[十三希诺收口强制] …`/`[十三希诺判级强制] …`/`[十三希诺追加判级] …`/`[十三希诺任务清单强制] …`）。**`steer()` 唤醒语义不变**（信封只改呈现面）；模型可见正文（含前缀＋防重述常量）逐字保留。渲染契约=宿主 chat `contextBody` case "notice"（summary 非空即通知行；缺 summary 降级 opaque——宿主本机已核对）。
- **单测**：`notice-message` 套件扩 8 类 summary 契约（非空/单行≤64/自曝来源/场景归类/信封联动）；全量 **34/34** 绿。
- **实机复验（桌面 App）**：判级强制陷阱会话（模型被指示不输出状态行）→ `discipline-steer` 触发 → ①**对话视图**：不再出现冒充用户的蓝色气泡（用户消息纯净）；②**轨迹视图**：呈现为绿色「上下文」行（summary=[十三希诺判级+清单强制]…，正文可展开）；③会话日志 `source.form='notice'`＋summary 落档；④模型照常收到正文并补判级收口（唤醒保留）；⑤**重启恢复无 corrupt**（notice 信封过宿主 `assertMessageEventShape`）。边界如实：对话视图对**回合内**上下文注入不内联（宿主设计；插件无渲染缝 F7），通知行落于轨迹——宿主渲染面若开放，信封已就绪即亮。
- **呈现边界登记**：宿主对话视图的 context 行内联仅见工具变更类；我方 notice 属回合中段注入 → 轨迹呈现。README「代价与风险」条目同步改写。

## 实机走查＋E1-v5 重基线轮（2026-10-18 · 验证收口轮）

> 本轮=预注册 E1-v5 补样本轮全量执行（75 有效会话）＋实机走查（页面 8 区＋F1/F3/F8 真机行为）；过程中发现并修复两处遥测缺陷（失败用例先行）；迭代批次六（有效性终判）由此落地；发行维持冻结（解冻=显式决策，未做）。

- **走查缺陷修复（先于跑批；`src/shisan-xinuo-core.ts`＋单测）**：①**F3** `workspace-cwd` 源修正——宿主 0.2.0-rc.2 **不出** `working-directory/change` 事件（整条会话日志实锤），改从 runtime-context 快照解析（`extractRuntimeContextCwd`；7 新测）；②**F8** `shadowedTokens` 源修正——字段在 `compaction/summary` 而非 `compaction/end`（真机实证），summary 捕获→end 取用（`extractCompactionShadowedTokens`；7 新测）。两套件先红后绿（失败用例先行）；全量 **34/34** 绿；tally 白名单同步（`workspace-cwd.via`）。修复实机复验：`write-audit` 越区记录落账（inWorkspace=false）、`compaction-detected shadowedTokens=6313`。
- **实机走查（`docs/design-specs/real-machine-walkthrough-20261018.md`）**：页面 **8 区**渲染（草图 9 项中「备份管理」并入快照区——登记）；**F1** 补判级/追加判级 steer 真机两连（模型补状态行 L2-F／追加评估「维持原判级不升档」）；**F8** `/compact`→`compaction-detected`→inject notice→模型重载序（重读纪律/任务状态/工作区真值＋复述＋断层声明）；**F3** 越界写=宿主沙箱拒写（`file access denied under workspace-write mode`）＋提权卡（走查择「拒绝」，文件保持不存在）。证据=截图 31 张＋exec-log 全链。
- **E1-v5 重基线轮（`docs/design-specs/e1-v5-supplement-results-20261018.md`；预注册 R5）**：5 臂×3 任务×5 轮=**75 有效会话**（6 会话作废重跑：D 臂凭据注入修复＋S 臂 preset 按更新后宿主真源重建）。**真值 72/75**（C/B/A 各 15/15；D 14/15、S 13/15——3 例 T3 partial=尾换行损耗，n=3 不作因果主张）；**治理层差分仅 C 臂成立**（T1 危险删除拦截＋审批 5/5、gate-ok 13/15 vs 对照 0、判级强制 steer 3 次全合规收敛）。**行为有效性对任务结果未见增量**（与「机制存在≠有效」口径一致，如实报告）。
- **装置与隔离**：桌面档 dev-mount 旋挂旋撤（撤除登记＋复验=无新 boot 行）；AGENTS.md 隔离-还原（R4）；S 臂脱敏验收 `skill-catalog` 1713 字符（用户工程技能 0 残留）；驱动工程四修复（DPI 感知/MoveWindow 150% 缩放、`DSH_HOME` 显式设定、arm 行新鲜度、窗口几何归一）。
- **批毕缺陷处置（ask_user_question L3 误报；预注册备案「跑毕处置」）**：询问类工具参数=展示提问文本，词面命中删除动词≠动作——新增 `isInquiryTool` 豁免（执行面工具判定不变；`discipline_gate` 命令仍受 L3 护栏）；单测 6 例（judge-l3 套件）；**真机复验**：陷阱会话（提问文案逐字含 `Remove-Item …`）→ `pre-execute tool=ask_user_question l3:null`、零 `l3-intercept`、问题卡正常（对照=10-17 台账误报实录）。
- **收口**：README 状态总表全 ✅（唯「有效性」=已测·未证显著）；docs 索引/机检全绿。
- **CI 首推红记录（如实）**：推送范围 `311ee7a..e2efa9f` 的提交信息机检抓到历史提交 `a0a3f3e` 的信息含归因词（1 处）——按仓内先例以合规后续提交替代（不改写已推历史；先例=首提 scope 修正案）。

## 运行时治理批 P1–P6 全量落地＋页面批·批次三/四（2026-10-17 · 迭代计划推进轮）

> 本轮=按两份迭代文档（`shisan-xinuo-runtime-roadmap-20261017.md` F1–F12/P0–P6＋`dsh-custom-prompt-iteration-plan-20261017.md` 批次一~六〔当时为 P 系列，2026-10-18 起页面侧改批次命名，P 编号唯一归属运行时路线〕）一次性推完全部可施工迭代；批次六（有效性终判 n≥5 样本轮=F11）与发行解冻=需真实多会话样本与显式决策，未做（如实）。

- **P1 探针批（`72789ca`）**：宿主 app.asar 只读四探针——①**timed ask 原生**（`dsh-tool-ask-user`：timeout 参数 -1/秒、超时=pending 可续答+`answer_to_pending_question` 回环）⇒ F6 零施工；②**compaction 事件族原生**（start/summary/end/prune，shadowedTokenCount）⇒ F8 无降级；③session-projection 能力缝在但 renderer 无插件缝 ⇒ F7 降级裁定（并入输出不做，可见性=原生 tool/result 渲染）；④**SandboxMode 三档原生**（read-only|workspace-write|danger-full-access）⇒ F3 执法主体=宿主。落档 `docs/design-specs/p1-host-probes-20261017.md`。
- **P2 判级与清单强制（`46c3387`）**：F1 判级缺失 steer（一次性+熔断+纯聊天/只读/零工具三重早退=0 误注入；追加特征消息→追加判级文案「评估升降档」）；F2 discipline_task 扩 checklist（分号清单≤20、与断言互补、审计 checklistCount）＋L2-F/L3（含宿主视角≥2 低报）无验收绑定→合并 steer。旗标 `SHISANUO_LEVEL_OFF`/`SHISANUO_CHECKLIST_OFF`。39 新测。
- **P3 边界守卫与 L3 重定位（`aebd96e`）**：F3 插件面=三档感知+`judgeWorkspaceBoundary`（词法段归约防 `../` 前缀逃逸——单测抓获真实洞）+写动作对账遥测（write-audit；执法字段如实标注 host-sandbox）；`working-directory/change` 订阅；放行表 `SHISANUO_WORKSPACE_EXTRA`。F4 三层防线口径入 SECURITY/README。F5 完全权限 record-only。36 新测含 10 例越区语料。
- **P4 提问与收口（`f4ef44a`）**：F6 缩围版=`isTimedAskSchema` 线缆检测（request/header）+goal-mode 指引细化（pending 非跳过/回环语义/300–900s 建议）；F7=降级裁定入 README。
- **P5 压缩与盘点（`fbe0e24`）**：F8=compaction/end（无 error）→pending→下一 turn-stopping inject notice（一次性送达防重复；失败压缩不注入）；F9=`scanWorkspaceAssets`（npm scripts/scripts 目录/tests 计数，浅层克制）并入 discipline_tools 返回（复用优先指引）。15 新测。
- **P6 渐进引擎＋镜像同步（`b33d490`）**：F10=`pickLayeredSectionForGap`（判级未知不选道/L2-S→l2s/L2-F/L3/低报→l2f 宁重勿轻）+`loadLayeredSection` fail-closed 装载+两注入点附分节全文；F12=CORE_DISCIPLINE 逐字镜像同步（7563 字符；镜像测试转绿）。
- **跨插件契约（`b33d490`+`236f6f5`）**：layered 用户覆盖目录优先序 `SHISANUO_LAYERED_DIR > $DSH_HOME/dsh-custom/layered > 包内出厂`＋mtime 缓存热生效＋页面停用跳过注入。
- **页面批·批次三/四（dsh-custom `236f6f5`+`f37c74e`）**：user-prompt 三段装配（section `dsh-custom:user-prompt` order −1990，装配序=常驻核心→我的提示词→官方；开关独立；空=不注入）＋layered 管理（出厂副本入包 content/layered、用户镜像 `$root/layered/`、恢复出厂单节级、停用 layered-state.json、分节名白名单防越权）＋6 条 API（user-prompt GET|PUT、layered 列表/单节读写/reset/toggle、audit 尾读）＋**client.js 推倒重写**（9 区导航完全体：概览/提示词中心三区/接管官方/作用域/快照/审计/治理只读占位/设置——⑧治理与⑥备份目录项如实占位不伪造）。25 新测+132 回归。
- **收口**：dsh-plugin-dev 测试 **34/34 套全绿**（P0 前基线 26/29：docs-index 缺录/工作树脏/CORE 镜像旧版三项全修复）；dsh-custom **157 测全绿**。F11 有效性终判=待样本轮（n≥5 四臂需真实会话）；发行态维持冻结。

## 「DSH自定义」会话/档位级实取视图（2026-10-17 · 第二会话续）

- **交付**：区一作用域选择器（全局｜任一活跃会话）＋`GET /api/dsh-custom/sessions`＋`GET /api/dsh-custom/assembly?session=<id>`——会话视图与真实请求**同法** `assemble({agent, scope: agent})`（对接真相：宿主 `assembleContextFor` 的 scope key＝agent 本体；未活跃会话 404 带指引）。
- **实测（GUI＋API 双查）**：选到活跃会话后——scopeLabel「会话 fbe14060｜D:\DeepSeek\dsh-plugin-dev（作用域实取）」；首段＝该会话工作区覆盖行（SV-5，vs 全局 GV-1）；**22 段全景**（含 tool:* / plan:policy / file-reference 等仅会话作用域可见的段）＋沙箱/审批策略上下文（**档位差异可观测**＝设计 P0 判据「≥3 会话/2 档位」的实取面）；**变量表带值**：`{{model}}` 按该会话真实解析（longcat-2.5-preview-free）、渲染器在线（非容错模式）＝宿主逐字节同法。测试 128→**132/132**；实现仓 `D:\DeepSeek\dsh-custom` `4e7226e`。设计档 §5 已同步注记（遗留①销项）。
- **遗留**：互斥现场对照需第二 complete 插件（单测覆盖 409 路径）；P3（导出导入/英文文案/设置区增强）为可选增强；桌面档临时挂载留驻（撤除三步见交接文档 §5）。

## 「DSH自定义」P2 深改接管（2026-10-17 · 第二会话续）

- **交付（主体能力 P0–P2 全量收官）**：`complete:true` 整段替换（`override.md`；默认关、空文本不放行防空提示词事故）＋**干跑校验**（候选文本对当前变量表预渲染：未知/畸形 `{{变量}}` 422 阻断；已注册但请求期解析的变量放行）＋**版本快照列表与一键回滚**（回滚前自动 pre-restore 快照，可逆；越界路径拒绝）＋**互斥探测**（启用探测组装：multiple-complete 冲突解析对方段名→拒绝并自动回退；API `GET|PUT /override`、`PUT /override/enable`、`GET /backups`、`PUT /backups/restore`）＋浏览器半「区二」块（开关/编辑器/取材于当前/快照回滚列表）。
- **实机验收（机证为准）**：①负向：`{{bogus}}` 候选保存 **422**；②接管生效机证：启用后会话日志 `system/message` **仅接管文本**（官方身份行消失；`{{model}}` 请求期解析为真实模型名）；**同轮弱模型自答"未接管/identity 存在"＝谎报，被机证推翻**（教训复证：模型自述不可信）；③关=恢复官方**逐字一致**（sections 名+字数与基线全等）；④回滚实测：`backup-restored` 四文件＋settings 同步重放；⑤互斥 409 路径=单测覆盖（现场需第二 complete 插件，如实登记）。测试 100→**128/128**；实现仓 `D:\DeepSeek\dsh-custom` `f389776`。设计档 §5 已同步 P2 注记。
- **遗留**：「按会话/档位取实际装配」为后续首项；P3（导出导入/英文文案/设置区增强）为可选增强；桌面档临时挂载留驻（撤除三步见交接文档 §5）。

## 「DSH自定义」P1b 作用域覆盖（2026-10-17 · 第二会话续）

- **交付**：`scope.json` 工作区规则（路径＋匹配方式 exact/prefix/contains/regex＋文本；空正文=该位置关闭；越具体越优先：完全一致＞前缀＞包含＞正则）；命中即按 **agent 作用域注册同名段遮蔽全局**（`agent.ctx.inject(['systemPrompt'])`，参照宿主 `dsh-file-reference-local` 先例的 install/dispose 生命周期）；cwd 每次组装实时读取；API `GET|PUT /api/dsh-custom/scope`（写=快照＋留痕）；浏览器半「作用域覆盖」编辑器（模式/路径/文本行＋增删＋保存）。
- **实机验收（五态机证）**：同一会话日志 `system/message` 逐轮对比——装前无标记（seq=7）→全局注入（seq=38）→总开关关（seq=50 纯净）→**工作区覆盖**（seq=62：前缀命中会话 cwd，规则文本遮蔽全局且全局不出现）→**位关**（seq=76：空正文规则，全部不注入）；模型逐轮核对自证。测试 78→**100/100**（匹配优先级/合成/API 22 例）；实现仓 `D:\DeepSeek\dsh-custom` `b8c06fe`。设计档 §5 已同步 P1b 注记（P1 全批收官）。
- **遗留**：「按会话/档位取实际装配」为后续首项；跨工作区现场移动未做实验（机制=逐组装重读 cwd，单测覆盖）；作用域编辑器视觉截屏受面板高度所限未留证（代码审阅＋API/端点测试已过，如实登记）。

## 「DSH自定义」P1a 纪律前置（2026-10-17 · 第二会话续）

- **交付**：纪律前置段注册（`systemPrompt.section({ name: 'dsh-custom:discipline', order: −2000, interpolate: false })`；text 为函数＝宿主每次组装重读 ⇒ **热生效**，改完下一条消息生效、无需重启/推送）＋**注入总开关**（`settings.json`，关=空文本渲染期自动剔除 ⇒ 模型只见纯宿主提示词）＋**编辑器**（API `GET|PUT /api/dsh-custom/discipline`，保存前自动快照＋留痕）＋**增量预览**（前 8 行）＋**AGENTS.md 共存信息提示**（宿主原生通道，仅提示不接管）。
- **实机验收（三源）**：①开=可见——注入后会话日志 `system/message` 首段即纪律文本、其后接官方身份行；模型逐字引用口令自证；`/assembly` 首段＝`dsh-custom:discipline`。②关=纯净——同会话下一轮 `system/message` 无纪律文本（对照），模型核对后答「没有」。③**热生效获证**：同会话两轮之间开关切换即时生效（组装重发语义；模型自观察运行快照变化佐证）。④保存=快照＋`discipline-saved` 留痕；AGENTS 提示实机显示（2463 字节）。
- **测试**：58→**78/78**（纪律模块 13 例＋P1 端点 7 例）；实现仓 `D:\DeepSeek\dsh-custom` `7ec3ae0`。设计档 §5 已同步 P1a 注记。
- **遗留**：P1b＝作用域覆盖（全局默认＋单工作区，复用「按位置匹配、越具体越优先」裁定）；「按会话/档位取实际装配」为后续首项；总开关按钮的鼠标点击未单独实测（视觉与 API 语义均已验，如实登记）。

## 「DSH自定义」P0 收口（2026-10-17 · 第二会话）

- **三卡点全清（实机闭环）**：①入口定位＝「设置→内置插件」页签实为已注册可见（此前排查面错在侧栏「插件」页；截图存证），并改为**设置导航区一级条目**「DSH自定义」（`settings.section`，与设计 §1「设置区独立入口列为可选增强」条款一致）；②**渲染视图在线**：宿主渲染器分层解析（根因＝junction 装载下 `import.meta.url` 归一到 realpath、裸 import 解析不到宿主安装树；策略 `host-argv→ctx-baseUrl→loader-internal→module-url→bare`，取宿主同源副本并逐级审计）；严格渲染被请求期变量阻止时（`{{model}}` 离线无值）转**容错渲染**（原文呈现＋明示标注＋`render-tolerate` 留痕）；③**护栏负向控制实机通过**：真模型写存储→`guard-deny`＋审计留痕＋存储文件零改动（fail-closed，模型自验报告佐证）。
- **过程缺陷修复**：护栏误报（`2>&1`/`>$null` 被 `>\s*\S` 误判为写——实机误拦只读命令；重定向排除流合并/空设备/箭头＋短动词命令位匹配＋长动词补齐）；四处空 catch 补留痕（audit/hash/meta/stat）。
- **测试**：43→**58/58**（护栏回归 7 例＋渲染器分层解析 5 例＋容错渲染 3 例）；实现仓提交＝`D:\DeepSeek\dsh-custom` `3767350`。
- **口径注记（已同步设计档 §5）**：P0 视图＝全局装配（源码＝`assemble()` 直取）；「≥3 会话/2 档位」的会话/档位级实取列 P1 首项。
- **仍开放**：桌面档临时挂载留驻（供 P1 实测；撤除三步登记在交接文档 §5）；P1 前路线复核（设计 §8.3：复用为先 A／自研全栈 B）待裁决。

## 「DSH自定义」P0 主体完成与交接（2026-10-17）

- **独立立项施工**：新仓 `D:\DeepSeek\dsh-custom`（MIT，本地 git）：P0＝存储骨架＋防静默改写护栏（语义 b 保守子集：拦截＋提示＋留痕）＋HTTP 数据面（`/api/dsh-custom/{assembly,status}`）＋浏览器半页签（`settings.plugins.tab`）；单测 43/43。
- **桌面 App 实测**：宿主半工作（boot/系统提示词服务附着/API 挂载三行＋存储落盘＋API 200 实取 7 段装配）；**卡点**：插件页签未显现（App 版 client-modules 与 CLI 版机制差异，`/plugins` 直探连官方包 404＝探针失效）＋宿主内 `renderPrompt` 动态导入失败（渲染降级）＋护栏负向控制未测。
- **交接**：`docs/handover-dsh-custom-20261017.md`（现状/卡点/环境/撤除三步/纪律/交接提示词全文）；插件留驻桌面档供接手方实测；接手方＝用户另开 DSH 会话。设计冻结与拍板记录见 `docs/design-specs/dsh-custom-prompt-design-20261017.md` §8。

## 「DSH自定义」系统提示词管理 · 调研＋设计冻结（2026-10-17）

- **调研**（`docs/design-specs/dsh-custom-prompt-research-20261017.md`，一手）：装配链解剖——`ctx.systemPrompt` 注册表：外部段任意顺序（**order −2000 即 system 层前置**）、**`complete:true` 段＝整段接管官方提示词（合法、不动 asar）**、公开 `assemble()`＋`renderPrompt()`（**实际装配结果可视化成立**）、会话作用域同名遮蔽（工作区覆盖成立）；**0.2.1-rc.1 对照**（next 线已发；`{{cwd}}` 变量移除等 60 行 diff 要点；API 稳定⇒双线可实现，升级建议暂不升级另立项）；**生态同类普查**（prompt 域 13+ 条三族分级）。
- **近邻深核与复用裁定**：`Awoodwhale/dsh-agent-persona`（Apache-2.0，npm）已实现作用域人设/实际提示词查看 tab/开关组/备份/防改写守卫等大半能力；净增量收敛为三件：**complete 深改＋纪律前置总开关＋AGENTS 共存检查**；呈报路线 A（复用为先）／B（自研全栈）／C（先装近邻实测）。
- **设计冻结**（`docs/design-specs/dsh-custom-prompt-design-20261017.md`）：入口＝侧栏「插件」卡片→设置页；**三区**＝①官方提示词只读（实际装配＋段归属徽标）②complete 深改（干跑校验/快照/回滚/互斥检测）③纪律前置（文本/注入总开关/作用域/AGENTS 共存提示）；载体＝`$DSH_HOME/dsh-custom/` 自管文件；护栏＝tools.guard 防改写＋保存即快照；分期 P0–P3 各带验收判据；拍板项 5 条待批。

## 原生纪律注入（2026-10-17）

- 在桌面日常恢复「纪律注入」，走**宿主原生通道**（不挂插件）：新增仓内正本 `content/agents-md-discipline.md`（与插件纪律文本同文；仅「收口」节改为不依赖 `discipline_gate` 工具的通用判据——该工具已随插件从桌面档卸载），部署至 `$DSH_HOME/AGENTS.md`（`dsh-agent-instructions` 全局注入，**全工作区生效**、65KB 预算内；`dsh-base` 默认启用）。
- **机器验证**：主 home 实跑会话基线落 `form=instructions kind=agent-instructions`（1308 字符），模型推理引用纪律条款——原生注入生效坐实。
- **E1-v5 交互**：预注册补 **R4**——r3–r5 开跑前须临时移出 `$DSH_HOME/AGENTS.md`（否则 A 臂携带全局纪律文本、与 r1/r2 不可比），跑毕还原。
- 编辑入口：当前即该文件本身（文本编辑）；图形化入口属《配置入口设计》P2（纪律文本卡）的规划面。

## 配置入口调研与设计冻结（2026-10-17）

- **补「双调研缺口」欠账**：新增 `docs/design-specs/config-entry-research-20261017.md`（一手调研）——生态全景（精选目录 1000 条/市场 `dsh-market` 4200+ 插件/23 分类）；**配置入口三个代际**一手证据（文件约定 → client 半＋`configForms`＋插件页卡片 → 新宿主从 Config schema 自动派生「no switch to flip」）；写回机制（`dsh-config-editor` 校验后原子写 profile patch、保留注释与 `!!js`）；UX 五惯例（暂存/保存才写/已覆盖/恢复默认/非法阻止）；治理向竞品抽样 5 例（verify×2/permissions「可视化草稿式编辑器」/undo/evidence-audit）；投稿规范要点（`dsh.bundle` 必需、peer 预发布陷阱与本仓不声明 peer 决策互相印证）。
- **设计冻结**：新增 `docs/design-specs/config-entry-design-20261017.md`——入口＝侧栏「插件」卡片→设置页三卡片：**执行账本 P0（只读零风险，验收=与 tally 逐项一致）／规则包 P1（只读→编辑，编辑依赖热重载）／纪律文本 P2**；不变量＝配置权限与执行权限分离、文件永远是权威层、UI 只是叠加层、只许加强不许放宽判定。施工需独立立项（不改代码、不动发布冻结）。

## E1-v5 有效性补样本轮 · 预注册冻结（2026-10-16）

- 冻结 `docs/design-specs/e1-v5-supplement-prereg-20261016.md`：**n≥5 四臂当前版重跑**（4 臂 × 3 任务 × 5 轮 = 60 会话）**＋脱敏对照 S 臂**（clean home 禁用技能目录，3 任务 × 5 轮 = 15 会话，隔离宿主原生 skill-catalog 对 T1/T3 的贡献，不并入主差分）；合计 75 会话。历史轮并入仅作描述性对照（版本漂移不可归因）；模型=单一免费档全轮统一（首选 `glm-4.5-flash`，探针不可用则整批换 `longcat-2.5-preview-free`）；排除规则/证据三源/回滚沿用 v3/v4 冻结矩阵。
- **执行待窗口**（前置=桌面自动化时段＋运行期临时切免费档、跑毕恢复）；开跑前装置核验已过：仓库工作区 shell 沙箱健康（写探针通过）、gui-verify 原语在位、clean home 在位、arm 机制在位。任务总表新增 #12 行跟踪。

## CI 转红修复（2026-10-16）：effect 套件平台口径 ＋ md-links 本机绝对路径链接

- **背景（如实）**：CI 自 effect 层落地批次起持续红（Linux 两套件失败），后续推送只核了 `ls-remote` 哈希、未核 CI 结论，造成"入档全绿、远端实红"的记录缺口——本轮推送后核对发现。
- **失败一（effect-assert，Linux）**：`firstAbsolutePath` 只认 Windows 盘符绝对路径 ⇒ POSIX（`/tmp/…` 等）不被识别、**effect 层在 Linux 宿主静默失效**、套件红。修复＝平台口径分支：Windows 保持盘符口径不变（防 `/f` 类参数串误判）；POSIX 另认 `/…`（含引号含空格形态；`./`、`~/`、通配仍拒绝）。预验＝`tmp/posix-sim.mjs`（stub `process.platform` 模拟 Linux，10/10 过）＋Windows 全量 29/29 不回退。
- **失败二（md-links，Linux）**：`docs/design-specs/experience-optimization-20261014.md` 以**本机绝对路径**做链接（26 处指向 `src`、1 处指向 `logs/exec-log.jsonl`）——作者机"刚好可达"，其它平台/机器必死（CI dangling=27）。修复＝26 处改仓库相对链接 `../../src/…`；本机日志链接改纯文本（`logs/` 不入库）。**机检加固**：`check-md-links.mjs` 新增平台无关规则——盘符绝对路径一律判"不可移植"（此前 Windows 本地机检对此类链接"睁眼瞎"）。
- **回执**：修复推送后 CI 转绿（`gh run list` 结论为准）；此后推送验收＝`ls-remote` 哈希＋CI 结论**双核**。

## 熔断验证＋样本轮（2026-10-16）：skip-notice 端到端实机／effect 层指标实测／`ok-effect` 记账分列／tally 字段缺口修复

- **三问质询熔断端到端——实机通过（未验证清单收敛至 0）**：`SHISANUO_STEER_CAP=1`＋pinned 恒假断言（`cmd_exit0:cmd /c exit 9`）→ 首次失败 `gate-steer` → 模型重试 → `gate-steer-capped{used:1,cap:1}` → **`skip-notice` 落账**＋`noticeMessage` 注入（会话日志 `user/message form=notice`＋摘要＋三问文案，seq=57）→ 模型**三句如实应答**（含「应提醒用户，而不是静默放行」）＋回合 `gate-missing`/`assertion-unresolved` 诚实收尾；双次命中只发一次（每任务守卫）。证据＝exec-log（`session-3a28ebe0-…`）＋会话日志解码＋运行输出。选型教训入 `踩坑经验库.md`（路径类恒假断言会诱发模型 `subst` 造盘；命令类恒假无此诱因）。
- **effect 层样本轮（A/B 对照，n=10/臂）**：无注册断言的物理写任务上——E0（`SHISANUO_EFFECT_ASSERT=0`）`gate-steer` 10/10（1.0/轮、模型补调 gate）；E1（默认开）**`effect-closeout` 10/10、steer=0**（全部对应真实存在的文件，无误收口）；两臂目标级 `auto-closeout` 均 0（分列记账正例）；墙钟 244s→201s。装置＝`scripts/l3exp/run-effect-arm.mjs`（含 `EFFECT_RESUME` 断点续跑）。落档 `docs/design-specs/effect-layer-sample-round-20261016.md`；边界如实：相对路径写入不触发该层（`firstAbsolutePath` 口径）、弱模型「发言即止」时有效轮须按 pre-execute 证据判定。
- **记账分列加固（`ok-effect`）**：effect 层收口在回合级 verdict 曾并入 `ok-auto` ⇒「auto-closeout 占比」存在把"动作落地"混入"目标达成"的口径缺口；新增 `ok-effect` verdict（`effectClosed` 标记）＋tally 七态计数/合法值/对应关系同步。
- **tally 字段缺口修复**：`gate-tool.summary`（A4 引入、≤500 截断）未进 FIELD_WHITELIST／CAPS——对 live 日志跑 `--check` 暴露 62 处；已补白名单＋`summary: 500` 帽＋夹具回归。字段级漂移的机检空档记入 `踩坑经验库.md`。
- **勾稽**：执行报告 §1 批5→✅、§2 指标补样本轮、§6 未验证→**0 项**；任务总表 #4 补熔断实证、#6→✅（宿主默认判据＋样本轮实测）；`验证库/已知边界与接受风险.md` 四项更新（发行例外消除、指标口径已决、未验证 0 项、模型抖动扩记）。

## C8 修复（2026-10-16）：干净克隆 `npm pack` 自动构建（`prepack`）

- **问题**：`lib/` 被 `.gitignore` 忽略，干净克隆在**未构建**时直接 `npm pack`，产物不含 `lib/`（分发场景必炸；findings C8 在悬置解除后得以落地修复）。
- **修复**：`package.json` 增加 `prepack: npm run build`——`npm pack` / `npm publish` 前自动构建，不再依赖手工 build。
- **复验（三路）**：①删 `lib/` 后仓内 `npm pack` → 构建自动触发、tarball 含 `lib/shisan-xinuo-core.js`；②**干净克隆**（`git archive` 提交态＋本修复）→ `npm install` → `npm pack`（**不手动构建**）→ 10 件产物含 `lib/`＋`content/`＋`cordis.patch.yml`；③隔离 profile `dsh plugin add <tgz>` → 写入 `dsh.profile.bundles`（bundle 层待遇，非 "plain dependency"）、`--dump-config` 组合树含 `# == shisan-xinuo-dsh-plugin` 层、无 "declares no dsh.bundle" 警告。
- **同步更正**：findings C8 行、安装/peer 结论档、外部锚 packet（`prepack` 与悬置两项标结）、任务总表 #9、执行报告批8 行；`package.json` description 移除已退役「工具预算」字样（公开面陈旧收敛）。

- **前提更正（四副本）**：上条「宿主已回传 `usage`」推翻了一处被反复引用的硬约束——「宿主不回传用量、报 token 即为编造」。逐处加日期化更正（保留原句）：`README.md`（`SHISANUO_COST_HINT` 行）、`docs/plugin-assessment-and-roadmap-20261013.md`、`docs/reuse-research-landing-options-20261015.md`、`docs/todo-next-20261013.md`。**成本提示实现未改版**（仍只报计数）——按「边际收益小则不推进」，改报真 token 留作可点名小项。

## 批5 续（2026-10-16）：窄版宿主默认判据 + 会话拒载修复 + 四项决策落定

- **决策 2 落地（判据面唯一语义变更）**：新增**窄版宿主默认判据**——宿主只从**亲见的工具副作用**派生断言（`observeEffect`：写类→`exists`、删除类→`not_exists`；命令类**只认删除**且必须过 B2.1 误阻守卫，**不**派生 `cmd_exit0`——与"禁跑一条无关命令凑 exit 0"同一口径），且仅在「本回合**无任何已登记断言**（pinned／用户原文派生／tool 自登记）且未闭环」时触发。语义边界如实标注：**证明"动作落地"、不证明"目标达成"**，故**独立记账** `effect-closeout`（不从目标级 `auto-closeout` 借分，也不写 `assertionsPassedAt`）。开关 `SHISANUO_EFFECT_ASSERT=0` 关闭（默认开）。新增单测 `tests/effect-assert.test.mjs`（31 例：含守卫反例与"文件删了断言必须翻"的可证伪联动、测试自身负向控制）；`npm test` 28→29 套。**未验证**：指标变化（`auto-closeout`／steer）需样本轮实测，本轮只交实现与单测。
- **指标记账口径（防自证化）**：目标级 `auto-closeout`（有已登记断言）与动作级 `effect-closeout`（仅物理副作用）在遥测里**分列**；批5 的 ≥80% 目标对哪一列成立，须在样本轮里分开报——把两列相加等于把"动作落地"冒充"目标达成"。
- **会话拒载事故修复**：桌面档 dev-mount 遗留 `permission-rules` → 宿主读路径拒载 18 个会话日志（`permissionRules/decision` 未带 `ignorable` 标记）；处置=撤挂载（`.bak-20261016-remove-permrules`）＋上游 `repair-session-logs.mjs repair` 补标记（18/18，复扫 `0 affected`）；验收=GUI 无红字截图＋该会话日志 mtime 前进并追加宿主原生行 `session/end-seed`（"被真加载"的机器证据）。规程落 `docs/gui-verification-protocol-20261013.md §5.3`（含铁律：临时 insert 必须登记"撤除条件／撤除动作／撤除后复验判据"）。
- **四项决策落定**：①本地 `package.json` WIP **丢弃**（`git restore`，`dsh.bundle` 回到提交态；WIP 副本留 `D:/tmp/probe/`）②宿主判据＝**严格为主＋物理副作用子集**（见上）③「层标签」＝只保留能力矩阵状态标签（8/8）＋findings 顶部一行口径声明 ④**不对外发布**（tag／Release／SHA256SUMS／外部收录 PR 全部搁置，物料留存不发）。
- **环境修复（非插件面，如实记录）**：DSH 桌面档 shell 通道被 Windows ACL 阻断（`SetNamedSecurityInfoW failed (Win32 5): grantWrite(<工作区根>)`）——根因＝工作区根 DACL 只到 Modify、缺 `WRITE_OWNER`，而沙箱要一次写入「能力 ACE＋world 删除拒绝＋Low 标签」三件套（标签在 SACL 内）；按官方诊断口径给签名用户补完全控制（对照实验：无授权目录改所有者 `Access is denied`／已授权目录通过），并复核 DSH 用过的 5 个工作区根。详见 `docs/gui-verification-protocol-20261013.md §5.4`。

## 收口批9（2026-10-16）：收口执行报告 v5

- 新增 `docs/design-specs/v5-execution-report-20261016.md`：逐批状态（批1–4 全清；批5/6/7/8 除待裁项外落地）＋三个可计算指标真值（H1/H2 含真缓存、收口基线 steer77/ok-auto12、D2 5→0）＋交付物索引＋**待裁四项与影响面**＋复跑命令（信任可传递）＋未验证清单（仅 1 项）。对外发送仍逐项呈批。

## 批5 附（GUI 实机，2026-10-16）：D2 全权档验证通过（含切档路径实测）

- **切档路径打通并实机验证**：`/permission` 命令 → 选择器「完全权限」→ 风险确认框（勾选＋启用）→ **机器判据** `exec-log: {"kind":"sandbox-mode","mode":"danger-full-access","enforcement":"suspended"}` ＋段指纹按设计重定基。落档 `gui-verification-protocol §5.1`（**并更正此前的错误定位**：顶栏「标准模式」与输入框 `@ 工作区内修改` 提示**都不是**档位控件）。
- **D2 实机通过**：全权档下发"用 pwsh 执行 `Remove-Item …del-me.txt`"——`pre-execute` 判出 `l3="数据删除"` → **`l3-detected decision=allow-full-access`**（D2 短路生效）→ **无 `upstream-block(ask)`／无 `l3-intercept`／无假「用户拒绝」** → 文件**真删**（`Test-Path=False`）、回合 `gate-ok` 正常收口。对照旧形态（曾实测 5 条 asked→rejected）缺陷消除。
- 未验证清单随之收敛到**一项**（三问质询的真实熔断端到端）。

## 层3 实验补测（2026-10-16）：`cached_tokens%` 由「不可测」转**真测**（H1 加固＋H2 新维度）

- **发现**：宿主现已在会话日志回传 `usage`，**含 `cacheReadTokens`**（批2 跑分时该字段全为零，故当时按预注册记为「不可测/代理口径」）。实测样本：`{"inputTokens":284,"totalTokens":10285,"cacheReadTokens":9920}`。
- **四臂真测**（`scripts/l3exp/analyze-arm.mjs` 扩展 usage 聚合；证据 `docs/evidence/layer3-20261016/*-analysis.json` 已刷新）：缓存命中 **A1 91.7%／A2 97.3%／B1 94.6%／B2 90.9%**。
  - **H1 加固**：常量横幅把**未缓存输入砍 −66%**（69,001→23,385）、命中率 +5.6pt——动态横幅的 token 税从「代理口径」变成真数字。
  - **H2 新维度**：披露开启把未缓存输入推高 **+248%**（115,436→401,556）、总 token **+105%**、命中率 −3.7pt——披露的代价不止墙钟，还有**缓存税**。
- 落档：结果档 §2b（新）＋§6 边界改判；`completion-signal-validity-plan-20261013.md` 追加 **R21**（R7 的「不可测」裁定不再成立，本电池不重跑）。

## 公开面质量机检（2026-10-16）：markdown 死链门禁

- 新增 `scripts/check-md-links.mjs`：扫描仓库内全部 `.md`（跳过 node_modules/.git/logs/tmp）的**本地链接**（`](target)`；跳过 http(s)/mailto/纯锚点；剥离 `#anchor` 后按文件所在目录解析）→ 有死链则 exit 1。接线 `tests/md-links.test.mjs` 进 `npm test`（28 套）。
- **实测**：68 个文件 / 72 条本地链接 / **0 死链**。**负向控制已证**：临时放入一条死链 → 机检 exit 1 且精确报出 `docs/_dangling-probe.md → nonexistent-target-xyz.md`；删除后复绿。

## 公开面刷新（2026-10-16）：README 对齐 v5（工具裁剪退役）

- 公众面陈旧更正：能力矩阵 #4（工具预算器）改为**已退役**并给依据（`docs/reuse-decision-toolface-20261016.md`＋rich 实测 7 件/3,374 chars）；数据层「三件」→「两件」（`content/budget.json` 已随退役移除）；环境变量表删除 `SHISANUO_BUDGET`／`SHISANUO_BUDGET_LEVEL`；拦截换芯段与目录段更新（披露让位上游）；版本史与「审计吸收 F-05」标注退役。改后全文仅剩**两处**提及移除项，且都在明确退役语境。
- **第二轮收敛（契约/计数/源码注释）**：`docs/config-contract.md` §7（工具预算器契约）加**退役横幅**（本节仅存史）；单测计数更正 **20／22 → 27**（README ×3、验证库 ×2）；源码三处「等级决定工具预算」注释同步标注退役。全仓再扫后，移除项仅出现在**明确历史语境**（退役横幅内或 2026-10-13/14 日期档）。

## 收口批5 附（缺陷修复，2026-10-16）：pinned 判据可被 `assert=` 绕过（洞 A 家族）

- **实机复现**：会话外钉死 `SHISANUO_ASSERTIONS=exists:<不存在的文件>`（登记为 `pinned`）后，模型用 **`assert=`** 收口 → 旧形态下该回合仍判 `ok-tool` 并闭环 ⇒ **「模型不可改写」的最强判据被静默绕过**。
- **根因（两处）**：①`discipline_gate` 的 **assert-only pass 分支**只评给定 `assert` 规格就返回，**不评已登记断言（含 pinned）**，并置 `onClosed(true)`；②turn-stopping 的早退条件在 `gateClosed`／`unverified` 时直接放行，**跳过了宿主侧断言复核**。
- **修复**：①assert-only pass 先复核 `acceptance.list()`（含 pinned）——不过即 `assertion-fail`、不闭环、不 markPassed；②早退改为「**有未复核的已登记断言时不早退**」，把复核权交回宿主侧。
- **验证**：单测 `tests/gate-assert.test.mjs` +3（断言未过⇒assertion-fail／不闭环／全过⇒pass）；**实机**：同一触发下 pinned 成功拦截（`gate-tool status=assertion-fail` → `gate-steer mode=auto-fail`），模型改为**如实报阻塞**（以 `exempt` 走 `unverified`，拒绝为凑 exit 0 伪造目标）。
- **同族扫描（T10 教训：缺陷成族）**：把 core 里**全部「宣告闭环」点**（`onClosed(true)`／`closed:true`／`markPassed`／`concludedTurn`，共 5 处）逐一核对——均须复核**已登记断言（含 pinned）**；结论=1 处即上述 assert-only（已修），其余 4 处本已合规。补 cmd 路径显式用例（`P3a/P3b`）把该不变量钉住。
- **连带修复（测试暴露）**：cmd 路径直接用 `evaluate` 返回值（假定带 `.assertion`）——非符合形状的求值器会让 `explainAssertion` 崩；改为按 assert 路径同款**规范化**（`{assertion:a, ok:!!res?.ok, detail}`＋异常兜底）。

## 收口批6 附（2026-10-16）：安装三形态实测＋「安装/peer 结论档」

- **三形态全部实测**：①`file://` 开发态（叠加层挂 `src/*.ts`，裸/实战/预览三档均通）；②**目录 bundle**（`dsh plugin add <dir>`：无警告、`--dump-config` 含 `- id: shisanxinuo-core`）；③**tgz**（干净克隆打包＋装载：无警告、组合树含插件层，产物 78 KB）。附：`dsh.bundle` 缺失时的症状与 `prepack` 前置。
- peer 口径定档：**不声明 `peerDependencies`**（零宿主硬依赖）——依据是宿主 0.2.x 的 fail-closed peer 检查（`dsh-outcome-loop` 被拒装实测）；代价转为由三档环境矩阵＋每批实机走查承担兼容检测。
- 落档 `docs/design-specs/install-and-peer-conclusion-20261016.md`（含复跑命令与上游锁定清单）。

## 收口批2 附（复验，2026-10-16）：双线兼容 @ 当前 core

- 批3–批5 大改后，在**预览线**（`dsh-cli-0.2.1-alpha.4` ＋ `dsh-prev-home/prev1`）复验**当前 core**（叠加层停用快照包、改挂工作树源）：`arm=C`、`self-check` 全绿（段指纹与主绑定线一致）、两步任务 `gate-tool pass` ＋ `gate-conclude marked`。判定：双线兼容@当前 core 成立（不构成对外兼容承诺）。落档 `docs/preview-line-compat-20261016.md`「复验」节。

## 收口任务#0（内部准备，2026-10-16）：首个真实外部锚——物料就绪（未提交）

- 新增 `docs/external-anchor/`：`awesome-pr-packet.md`（收录条目 yml＋PR 文案＋**提交前 checklist**）、`trial-guide.md`（外部使用者试用路径与自证三步）、`feedback-template.md`（可复算的反馈字段）。由 `docs/README.md` 索引（索引机检 0/0）。
- 如实标注**前置阻塞**：`dsh.bundle` 缺失 ⇒ 暂无「可安装 bundle」形态，PR 须在恢复 `dsh.bundle`（＋`prepack`）后提交；对外动作（发布/PR/收录）仍逐项呈批。

## 收口批8（内部准备，2026-10-16）：验证库「已知边界与接受风险」节

- 新增 `验证库/已知边界与接受风险.md`（对外可读）：机制边界（非安全边界/洞 A 未归零/自述链终止律/判级仅观测）、已接受风险（**无可用发行形态**＝`dsh.bundle` 缺失、上游代际不兼容、关键指标未达标、未验证清单、模型抖动）、隐私与数据、复现边界。反映收口执行 v5 批1–批7 后的真实状态；由 `验证库/README.md` 回指。
- 对外动作（发送/发布/PR）仍逐项呈批——本条只做内部准备。

## 收口批7（进行中，2026-10-16）：层6 度量底座——索引机检＋证据入库

- **C6 索引机检**：新增 `scripts/check-docs-index.mjs`——docs/**.md ↔ `docs/README.md` 索引**双向一致**（每个文档须被索引；索引内每个反引号 `*.md` 引用须真实存在）；缺口=0 且悬挂=0 才 exit 0。接线 `tests/docs-index.test.mjs`（入 `npm test`）。**实测：缺口 27→0、悬挂 1→0**（补入 27 档、去掉 `e1-*.md` 通配）。
- **C7 证据入库**：层3/D 四臂实验聚合（`A1/A2/B1/B2-analysis.json`）入 `docs/evidence/layer3-20261016/`＋说明档（复跑命令与装置指引）；不含模型正文与凭据。
- **B8 双引擎对照**：`regression-permission-rules` 170 例（我方 vs 上游）0 不一致（批4 已实测）。
- **B6 外部语料**：登记上游 `dsh-permission-rules@0.7.15` 的**共享合规向量**（`dsh-rule-test-vectors/v1`，11 向量；两份独立 gate 共用的实现中立语料）——`验证库/外部语料-上游合规向量.md`（来源＋sha256＋复跑法；**不复制该文件**以免 Apache-2.0 与 MIT 许可混同），复跑命令实测输出与登记哈希一致。
- 待决/待裁：B5 外部锚（**形态已实测可用**，仍缺 tag/release 与对外递交）；层标签口径（「层1-6 归属」以 findings 档自身分层块为准，逐条打标的口径待确认）。

## 收口批6（探路，2026-10-16）：组装形态——tgz 形态实测暴露 `dsh.bundle` 缺失（冻结阻塞）

> **更正（同日晚）：** 上条把「`dsh.bundle` 缺失」记成了**仓库问题**——实为**本地未提交改动**所致。`git show HEAD:package.json` 有 `dsh.bundle`（自 `1d00ffd` 2026-10-15 起）；**干净克隆 pack 与装载已实测通过**（无警告＋组合树含插件层，见 `验证库/已知边界与接受风险.md` §二.1）。故批8 验收「干净克隆 npm pack 可用」**通过**；阻断面收窄为「本地 WIP 与提交态不一致」。

- **形态3（tgz）实测**：`npm pack` 产物内容完整（`lib/shisan-xinuo-core.js`＋`content/*`＋`cordis.patch.yml`，共 10 项）；但 `dsh plugin --profile t6 add <tgz>` 仅装成普通依赖并**警告**：`declares no dsh.bundle — installed as a plain dependency, not a profile layer` ⇒ **包不会作为插件层加载**（失效）。
- **根因**：悬置（未提交）的 `package.json` 删除了 `dsh.bundle` 清单并把版本由 `1.0.0-rc.1` 改为 `1.0.0`；而 `dsh.bundle` 是 `dsh plugin add` 识别可安装 bundle 的硬要求（见 `release-and-versioning-plan` §二）。
- **阻塞面**：批6（切包/切形/引导/三形态）与批8（tag/Release/打包就绪）都必须改 `package.json`，与批2 立下的「悬置态 package.json 不动」相抵 ⇒ **两批在此冻结下无法收口**。
- **待决**：①冻结是否解除（含 `dsh.bundle` 恢复/重定与 `prepack`）；②`dsh.bundle` 缺失系有意过渡还是事故；③批5「宿主默认判据」保严格 vs 要指标。

## 收口批5（进行中，2026-10-16）：方向 C＋小件——gate 降级＋outcome-loop 复测＋基线度量

- **gate 降级（本批已落）**：`discipline_gate` 在"无 cmd/assert"时——若给了 `exempt`（未验证声明）→ 返回 **`unverified`**（诚实未验证：非 pass、非 error、不计完成），回合以 `behavior.gate=unverified` 如实登记且不再打回；无 `exempt` 仍为 `error`（提示补 assert 或如实声明）。修掉"只读/语义型任务无合规收口形态"的真缺口（GUI 批4 会话实测 `error:empty-cmd`）。单测 `tests/gate-tool.test.mjs` +6；tally `behavior.gate` 白名单同步。
- **`unverified` 路径实机复验（2026-10-16）**：实战档（关披露件）跑"无机器判据"任务——模型以 `exempt` 声明 → `gate-tool status=unverified` ＋ `behavior gate=unverified`，回合如实收尾且**未被 steer**（不逼编无关命令）。此前仅有单测覆盖的未验证项转为已验证。
- **D2 修复**：完全权限档命中 L3 时改为**短路瀑布**（直接返回 `{kind:'allow'}`，不再 `next()` 让下游 permission-rules 的 ask 落到 `approval=never` 的 0-1ms 硬失败并谎报"用户拒绝"）。形状经宿主源码验证——`ctx.waterfall(carrier,"tools/pre-execute",exec,()=>({kind:"allow"}))` 即宿主自身放行终态；我方与上游 170 例语料 0 不一致 ⇒ 我方命中即上游会命中。**未验证**：全权档 GUI 实机（模式控件未成功切换）。
- **闭环宿主终结（缺口修复＋实机回归）**：`discipline_gate` 的**断言专用通道**（assert-only pass，最常用路径）也标记 `concludeTurn`——旧形态只有 cmd 路径有 conclude 块，故 assert 收口从不终结回合（实机证据：assert-only `gate-tool pass` 之后无 `gate-conclude`）。修后 `gate-conclude marked`（cmd=`assert:…`）；单测 `tests/gate-assert.test.mjs` +3（CJ1-CJ3）。**实机回归 4/4**：rich 档 4 跑各落 `gate-conclude marked`（`cmd=assert:exists:…/q1..q4.txt`）。
- **outcome-loop 必查（限时盒）**：`gh api` 复测——最新 Release 仍为 `v0.1.0-beta.8`（2026-08-20；仓库 2026-09-20 有推送但无新发行）⇒ **无 0.2.x 适配版**，批1「未过/移除」裁定维持。
- **基线度量（exec-log 全量）**：`gate-steer=77`（＝计划所称基线）、`auto-closeout=12`、`ok-auto=12` vs `ok-tool=224`（**auto-closeout 占比 5%**）。
- **待决**：`宿主默认判据`／`auto 派生扩容`（auto-closeout ≥80%／steer↓≥50% 的机制）涉及把"目标校验"降级为"动作落地校验"，与项目 T2/T8/T10 与 A1 的严格性条款冲突——按分歧铁律**待裁决**；D2（换芯链路 ask 假拒）与 conclude 回归（实战档含审批应答）仍在列。

## 收口批4（2026-10-16）：方向 B——运行时工具裁剪（budget/mask）退役，披露移交上游 tool-search

- **退役**：删除预算器全部触点（`BudgetMask`／`loadBudgetFile`／`completeAllowList`／`maskLeak`／`BUDGET_ALWAYS_ALLOW`／`restrictAgentTools`／`applyBudget`／`pendingMask`／`pendingLevel`／`budget-leak`／`SHISANUO_BUDGET*` 等），并删 `content/budget.json`（净 −241 行）。依据=`docs/reuse-decision-toolface-20261016.md` §2/§4。
- **披露移交上游**：`discipline_tools` 改为如实报"可见面＋线缆真值"，并声明披露由上游 tool-search 承担、本插件不再裁剪。
- **线缆面实测（rich 档）**：`tools-wire count=7 chars=3374`（＝验收上限，与复用档实测一致）；治理闭环实证——模型 `tool_search{query:discipline_gate}` → 面 7→9 → `gate-tool pass realExit=0 evidence=strong` → `gate-ok via=ok-tool`；`discipline_*` 在注册表常驻（inventory=35）。
- **正则层收尾退役**：`regression-permission-rules` 170 例（我方 vs 上游）**0 不一致**（阻断/域/注解三面）。
- **测试套件改写**：`tests/budget.test.mjs` → `tests/toolface-retired.test.mjs`（断言退役符号不再导出＋目录新语义）；`behavior-metrics`／`claims-check` 同步（K16／N4 改为退役后语义）。
- **tally 同步**：删除 budget 类 kind；`tools-catalog` 去 `denied`；`self-check` 去 `budgetValid`。
- GUI 走查：桌面 DSH 重启载入退役 core → `self-check`（无 budgetValid、无 budget boot 行）→ 新会话调 `discipline_tools` → 目录 `自报=无（仅观测）；预算=不裁剪（披露=上游 tool-search） visible=30`。

## 收口批3（2026-10-16）：方向 A＋跳过治理（判级仅观测·段指纹·notice·未知工具 L2·启动自检）

- **段指纹遥测**：`sectionFingerprint()`（对注入系统段取 SHA-256）；启动落基线 `section-fingerprint`，每次 `request/header` 重算核对，漂移落 `section-drift`（段变更率=0 底座）。
- **判级仅观测**：自报等级**不再驱动工具面裁剪**（消除锁级体感/`upgrade-ignored→0`）；仍记录供低报度量（`level-divergence`）；工具预算只由操作员 `SHISANUO_BUDGET_LEVEL` 受控设定。
- **`discipline_tools` 上限展示**：目录"当前预算档位"改为 `自报=X（仅观测）；预算=未裁剪（上限=全量）`（GUI 实测 `visible=30`，自报 L1 不裁剪）。
- **未知工具保守 L2**：新增只读表 `KNOWN_READONLY_TOOLS`＋shell 表 `SHELL_TOOLS`——表外（含宿主自带表之外的新工具）一律按保守 L2，防富环境漏判；单测 `tests/tool-level.test.mjs`。
- **跳过治理（不静默＋三问质询）**：探针证实宿主 notice 通道（`source.form='notice'` 须带 `summary`，宿主 `modelSwitchNotice` 同形态）；熔断跳过时注入 notice（用户可见）＋三问质询（每任务≤1）；`tests/notice-message.test.mjs`。
- **启动自检**：一次落账 `self-check`（段数/纪律/预算/收口链开关/段指纹/缺失项），任一处未就绪显式可见（不静默降级）。
- GUI 实机走查：桌面 DSH 重启载入新 core → `self-check sections=5 gate/task/catalog=true conclude=true fp=646b…` → 新会话三步任务 → `tools-catalog` 上限展示 → write→gate 收口 `gate-ok via=ok-tool`；证据 `D:\tmp\gui-batch3\`。

## 收口批2（2026-10-16）：层3/D 量化实验（门禁批）＋两个真 bug 修复＋GUI 实机

- **steer/inject 消息身份修复**：新增 `userMessage()` 统一补 `id`＋`role`＋`source.kind`——宿主 `assertMessageEventShape` 要求 user/message 带身份字段，缺失会在下次会话恢复时判 corrupt（B1 实测）。回归套件 `tests/steer-message.test.mjs` 常驻。
- **hooks 桥排除**：`dsh-hooks-claude-code@0.0.1-rc.5` 在绑定线 0.2.0-rc.2 上使工具链崩溃（`agent.session.events is not iterable`，spread undefined）；二分探针定位（仅 cordis exit0／仅 hooks 崩）；B1/B2 装置改用 `rich-no-hooks.yml`（仅 tool-cordis）。
- **四臂实验（各 20 轮 × step-5-preview-free）**：A1/A2/B1/B2 全 20/20 收口、steer=0。**H1（常量横幅）支持**：系统段字节 −98.3%（239,340→4,082）、distinct 3→1；**H2（tool-search 披露）代价量化**：开启后每轮注入 runtime-context 快照（全程 1→40）与 tool-search 披露（20），墙钟 +47.5%（564s→832s）、实际检索仅 1 次、收口无损；**H3（收口旁证）成立**。结果档=`docs/design-specs/layer3-quantification-results-20261016.md`。
- **GUI 实机走查**：桌面 DSH 启动→新会话（标准模式·step-5-preview-free）→真实任务 write→read→`discipline_gate`（assert exists 内联求值通过）→模型回 `GUI-SELFCHECK-DONE`。三路取证：截图（gui-01/02/03/04）＋exec-log（gate-tool pass realExit=0 evidence=strong）＋dsh-usage.log（provider=dsh-go model=step-5-preview-free、x-opencode-session 注入）。证据目录 `D:\tmp\gui-batch2\`。

## 收口批1（进行中，2026-10-16）：测试基建去假绿＋词表口径对齐＋收口任务总表

- 测试基建两处失信修复（审计登记在案）：`test/l3-patterns.test.mjs` 去掉本地旧正则、**直连真引擎 `judgeL3`**；`tests/review-claims-check.mjs` 补退出码＋`--expect-fail` 负向控制；新增接线套件 `tests/review-claims-wiring.test.mjs` 常驻把关（normal exit 0 / expect-fail exit 1）。**负向控制实测**：改坏 `L3_PATTERNS`→套件变红（2 MISS／exit 1），还原复绿。
- 公开文本机检对齐政策：`ai-tool-name` 规则补「端点字面量」豁免（`openai/v1`）＋3 枚回归用例（含豁免不放水对照）；修复上一提交遗留的 1 处违规；工作树 128 受控文件 0 违规。全量 `npm test` **22/22**。
- 新增 `推进库/2026-10-16-收口任务总表.md`（v5 活表：任务×可计算收益×状态，滚动勾稽）。
- **预览线档（v0.2.1-alpha.4）首轮兼容实证**：隔离 CLI＋home＋headless 模板档案建成；我方插件 file:// 挂载与本地 bundle 安装均可装；运行时全量注册零失败；GO 反代链路（免费档）回复 `PREVOK` exit 0；系统段两段到达（会话日志解码）；遥测落账。矩阵与装置档见 `docs/preview-line-compat-20261016.md`、`docs/env-matrix-20261016.md`。
- **三档环境矩阵收口（实战档）**：`rich1` 默认集＝本插件＋permission-rules@0.7.15＋tool-search@0.1.7＋hooks 桥＋tool-cordis；最终冒烟 exit 0（`RICHOK`）；大目录下披露件生效（**tools-wire 7 件/3,374 chars**，对照裸档 28 件/22,668 chars）。接缝发现：官方伴随包亦触 fail-closed 版本门（`allow-version --accept-risk` 流程实测）；无 `dsh.bundle` 包需挂载层；hooks 桥 `configPath` 必填。**dsh-outcome-loop beta.8 与绑定线 0.2.0-rc.2 代际不兼容**（自述仅验至 0.1.0-rc.8；boot 宿主侧崩溃，补 storage 前置仍崩）→ 必查项 #1 未过：默认集移除、留档待上游适配。

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
