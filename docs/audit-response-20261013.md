# 第三方审计处置报告（2026-10-13）

> 输入：第三方白盒审计《DSH插件第三方审计报告-shisan-xinuo》（审计对象=main@24 commits；独立复现 11 套单测全绿）。
> 处置口径：**三方向题全走推荐项**，其余按审计意见机械修复；每条结论附证据与边界。

## 一、方向决策记录（用户批准：1A / 2A / 3A）

| 题 | 选项 | 落地 |
|---|---|---|
| F-01 收口防假 | **A：删文本 GATE 兜底＋宿主自动收口** | 文本行永不等于合规；断言任务由宿主在 turn-stopping 直接复核（全过=`ok-auto` 收口成立；未过=`auto-fail` steer 打回一次）；无断言任务必须真调 `discipline_gate`，不可验证记 `unverified`（gate 值 `missing`/`gate-fail`） |
| F-02 完全权限 | **A：refuse 始终生效** | `discipline_gate` 的 L3 拒跑不再被 `full-access` 短路；全权只免审批卡交互，不免插件主动发起的命令执行 |
| F-05 预算触发 | **A：只认显式状态行** | `extractDeclaredLevel` 仅匹配 `L=…` 键值形态；正文提及（如"L1 交换机"）不再触发裁剪 |

## 二、发现清单处置（F-01…F-10）

| # | 严重度 | 处置 | 证据 |
|---|---|---|---|
| F-01 | 高危 | 文本 GATE 退场（纪律文本/横幅/steer 三处同步改写）；宿主自动收口落地；turn/end 判定改为 `ok-tool/ok-auto/gate-fail/missing`（`ok` 仅历史行兼容） | 单测（gate-tool 46 例含全权拒跑）；真机 S1：`auto-closeout PASS`＋`gate:"ok-auto"`＋断言表 ✔；真机 S2B：`gate-steer mode=auto-fail` → 终局 `gate:"missing"`＋`assertion-unresolved`，无假完成 |
| F-02 | 高危 | refuse 分支去掉 fullAccess 短路；测试改为"全权下仍拒跑、命令不得执行" | `tests/gate-tool.test.mjs` 4b 重写（MUST NOT RUN 守卫） |
| F-03 | 中危 | **如实声明边界**：分回合跳过仍存在（endKind/toolCalls 门槛为防误报设计）；断言任务在每回合收尾都会被自动复核，绕过面已显著收窄 | 本文档 + README 边界注 |
| F-04 | 中危 | 白名单同步至 24/24；新增 `tests/tally-whitelist.test.mjs`（引擎写入 kind 必须 ∈ 白名单，防再脱节）；`execctx-probe` 调试探针移除 | 新机检 24 pass；engine/tally 双源扫描 |
| F-05 | 中危 | 触发收窄（见上）；`pwsh` 常驻白名单保持（收口/验证必需）——README 主张 4 明确"仅为 token 收敛，非安全边界" | `tests/budget.test.mjs` 更新（独立标记不再触发＋误触发样本消除） |
| F-06 | 中危 | 补 5 例：`helm uninstall`/`docker container prune`/`journalctl --vacuum`/`base64 -d | sh`（新域"解码执行"，noExempt）/；`review4-claims-check.mjs` 修复（`miss`→`misses`）并重写为 `tests/review4-claims.test.mjs` 纳入测试循环 | 新测试 17 例；`> db.sqlite` 与 node 写清空=如实声明的语义层边界（B3 外置方向处理，不硬凑） |
| F-07 | 低危 | **如实声明边界**：推导仅覆盖"路径可枚举"任务；断言为空时收口强制仍生效（无断言→必须真调 gate）——F-01 修复后此边界的危害面已闭合大半 | README＋本文档 |
| F-08 | 低危 | 指纹匹配加**词边界检查**：前缀同族目标（`target-2026-backup`/`target2`）不误封；包装态仍命中 | `tests/bypass-guard.test.mjs` 新增 f08 四例 |
| F-09 | 工程 | `devDependencies` 声明 `@deepseek-ai/cordis`；`e1v4-analyze.mjs` 去硬编码（`SHISANUO_REPO` 可覆盖）；统一入口 `npm test`（`scripts/run-all-tests.mjs`）；新增 GitHub Actions CI（Node 22/24） | 新脚本＋workflow；README 同步 |
| F-10 | 工程 | 支持"有效性未证"结论不变；README 维持"机制验证≠产品有效"三分法 | 既有文档 |

## 三、测试与证据现状

- **13/13 套单测全绿**（新增 `tally-whitelist`、`review4-claims`；原 `review4-claims-check` 删除）。
- 真机 S1（自动收口 PASS 分支）与 S2B（auto-fail 打回＋诚实阻塞收口）均为 headless 实跑，日志在 `logs/exec-log.jsonl`（本机）。
- **证据边界（如实）**：宿主层实验的原始日志/探针不入库，第三方不可独立复现（审计 §3.2 认定）——单测与全部检查脚本可独立复现；分析脚本已去硬编码。

## 四、明确未采纳与后续

- **未采纳**：审计 §5「改为权限面（路径级 capability/diff 快照）」——维持已定 **B3 换芯外置**路线（拦截层交给 `dsh-permission-rules` 承载＋我方生成器/映射层），权限面建议记为 B4 候选待观察。
- **未硬凑**：`> file` 重定向覆写、node 写清空、`mv` 移走类样本=语义层问题，保留为声明边界，不做更多形态枚举（避免症状枚举）。
- **后续批**：B3b（生成器 `rules.json→.dsh/rules.yaml`＋`patternMode: regex` 配置行＋全量语义回归）。

## 五、续审处置：代价与风险四件（2026-10-13）

| # | 审查点 | 核实结论 | 处置 |
|---|---|---|---|
| 1 | `discipline_gate`/`cmd_exit0` 断言自建执行通道，强度=枚举清单覆盖面 | 属实（护栏=危险域清单＋被拒命令指纹 10 分钟；全权模式下 refuse 仍生效；生成文件对应的上游规则与清单等价，但**仅存在于上游 `.dsh/rules.yaml` 的用户自定义规则不覆盖此通道**） | 文档化（README「代价与风险」）；不修——真值验证必须执行命令，替代路径（改走原生工具管线）已评估不可行 |
| 2 | 收口强制以 `steer`＋用户信封注入，插件靠前缀自识排除 | 属实（信封 `source=user` 为宿主接口约束；文本带显式前缀标注来源） | 代码：前缀收敛为单一常量（发送×2 与排除×1 共用，消除漂移）；README 文档化 |
| 3 | 命令历史默认明文落盘（200 字符截断） | 属实（默认 `<repo>/logs`；此前无脱敏） | 代码：写入前深脱敏（sk-/gh*/Bearer/token=…/URL 凭据；非穷尽）＋新增测试套件；README 文档化（含 `SHISANUO_LOG_DIR` 与截断口径） |
| 4 | 未发行／开发态（无 `dsh.bundle`）／绑定 cordis `4.0.5-alpha.1` | 属实 | README 文档化（并入「代价与风险」） |

一句话结论（同步 README）：**不作为安全边界使用**——拦截面=枚举覆盖、验证面=真退出码，两者都治「过程」，不承诺「安全」。

## 六、续审之二：口径更正与判据权威加固（2026-10-13）

**口径更正（采信）**：收口强制并非独有——Claude Code `Stop` hook 提供成熟同类（返回 block 使回合继续；`continueOnBlock`/`impossible`/`stophookactive`；连续 8 次熔断＋环境变量上限；`prompt`/`agent` 型判断），Codex/Qoder 亦有同型 force-continuation hook。据此更正公开表述：`implementation-batches §9` 与 `positioning` 中「无同类净增量」论断收窄为——**行业标配存在；本仓净增量=语义细节**（`claimedExit` 三态、资源真值断言、1 次 steer 上限与收口证据形态）。

**如实补充**：既有实验记录中的 3 次打回全部为用法错误（语法/退出码语义），**有机「谎报」样本至今未命中**——「抓谎报」靶心的有效性未证（与既有「有效性未证」口径一致）；构建性样本（替换型假完成重放）由断言层打回，可证机制在场，不证命中率。

**判据权威加固（本次代码变更，回应「判据握在被验证者手里」）**：

- `discipline_task replace`：由「可整组替换（含 auto，需 reason）」改为**仅替换工具自登记断言；用户原文推导断言（auto）恒保留**——模型不可移除/改写用户判据；更正路径=用户重新下达指令触发重推导，或如实报告阻塞（宿主记 `assertion-unresolved`）。
- reason 门退役（其防护对象=replace 打穿 auto，已由边界层直接关闭）；`clear` 含 auto 时持续拒绝；审计字段 `replacedAuto→preservedAuto`。
- 仍属已声明边界：模型自登记断言、`cmd_exit0` 与目标的相关性无机器校验（`echo ok; exit 0` 类可通过）——一致性≠有效性。

**其余审查点定位**：gate/断言 exec 通道（边界与证据见 §五，本次不新增机制）；steer 注入形态（前缀常量＋公开文档）；循环防护=1 次 steer/回合（低于社区 8 次熔断上限），语义出口=如实阻塞报告（记 `unverified`/`assertion-unresolved`）；遥测新增 `SHISANUO_LOG_DISABLE=1` 关闭开关（不留痕环境）；工程形态（发行批路线不变）。

## 七、续审之三：洞 A/B 拆分与判据锚点（2026-10-13）

**洞 A（判据可被改写）**：既定向量已关——`replace` 仅作用工具自登记断言、用户原文推导断言（auto）恒保留（上一批，测试镜像在案）；本批补收官键：**pinned 断言（判据锚点）**——`SHISANUO_ASSERTIONS` 会话外注入，不进入任务记录，`clear`/`replace` 物理不可触；收口链（turn-stopping 自动复核／遗留落账／gate 断言复核）统一按「pinned>auto>tool」三级求值。残余如实：无 pinned 且推导为空的会话，判据仍由模型自填（摩擦≠权限隔离）——已在 README 声明。

**洞 B（验证命令由模型给，且直进 shell）**：①有效性（无关真值）：pinned/auto 即相关性锚；无锚场景 `echo ok` 可通过=声明边界（一致性≠有效性，README 在案）。②安全面（exec 不经审批、护栏=枚举清单）：维持既定产品取舍并文档化；能力分级/受限 cwd 记候选（未排期）。

**可迁移判据（采用并落地）**：判据可不可信，看模型能否「改写它且不留痕」——好判据=模型只能满足或**可见地**破坏；坏判据=可静默改写。落地映射：pinned／仓库测试／CI 检查=锚在模型外（首选）；用户原文推导（auto）=会话内锚（模型不可改写，推导依赖启发式）；`discipline_task`（tool）=锚在模型侧（仅作补充）。
