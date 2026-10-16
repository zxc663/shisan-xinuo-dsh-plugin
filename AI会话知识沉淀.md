# AI 会话知识沉淀（项目：shisan-xinuo-dsh-plugin）

> 目标读者：下一个 AI 会话。**读取方式**：先看下方索引，再按关键词检索正文，不全文加载。
> 写法：每条 `触发场景｜判断｜行动`，保留精确术语、路径、命令与可检索关键词；不做生活化类比。
> 最后更新：2026-10-16

## 索引（最近 20 条）

| 日期 | 主题 | 关键词 |
|---|---|---|
| 2026-10-16 | 宿主事件接缝 | `tools/pre-execute`、事件投影无 `arguments`、现场探针 |
| 2026-10-16 | 沙箱 ACL 与 shell 通道 | `SetNamedSecurityInfoW` Win32 5、`WRITE_OWNER`、`S-1-4-…` 能力 ACE |
| 2026-10-16 | 会话日志外来事件 | `ignorable` 标记、`repair-session-logs.mjs`、`session/end-seed` |
| 2026-10-16 | GO 反代模型面真值 | 免费清单、`x-opencode-endpoint-id`、对照组 |
| 2026-10-16 | 判据面（窄版默认判据） | `effect-closeout`、动作落地≠目标达成、`SHISANUO_EFFECT_ASSERT` |
| 2026-10-16 | 熔断触发与批次装置 | `skip-notice`、`gate-steer-capped`、恒假判据选型、断点续跑 |
| 2026-10-16 | 记账分列（ok-effect） | 回合级 verdict、tally 白名单、写入面/对账面同步 |

---

## 2026-10-16 ｜ 主题：宿主事件接缝（哪个缝能拿到什么）

1. **要读工具调用参数｜会话事件投影里没有参数｜改用 `ctx.on('tools/pre-execute', …)`**：`tool/call` 事件投影给插件的字段实测只有 `type|turn|content|endKind|name`；`arguments` 只出现在**持久化进会话日志的 `data`** 里；参数最完整的缝是 pre-execute 钩子（且为**对象**形态）。
2. **新接缝先打一次性现场探针｜`console.log(keys / typeof)` 之后才写解析代码**：本轮 effect 层单测 35/35 全绿但真机 **0 触发**，探针一打即定位（见 `踩坑经验库.md` 同名条目）。
3. **参数形态按三形态写用例｜对象／JSON 串／裸命令串**：真机事件里是 JSON 串，单测按对象写会漏真机。
4. **回合末收口层的插入点｜`turn-stopping` 处理器的早退之后、`assertionsOpen` 分支之前｜并在早退条件里保持"已闭环/未验证/已 steer 过"三条豁免**：否则会重复记账或对已闭环回合再收口。

## 2026-10-16 ｜ 主题：DSH 沙箱 ACL 与 shell 通道

1. **桌面档 shell 全命令失败报 `SetNamedSecurityInfoW failed (Win32 5): grantWrite(<工作区根>)`｜判"权限不足"而非"登记问题"｜给签名用户补 `icacls <根> /grant "*<用户SID>:(OI)(CI)F"`**：沙箱要在**一次**调用里写三件——路径派生的**能力 ACE**、Everyone 的 `FILE_DELETE_CHILD` **拒绝**、目录的 **Low 完整性标签**；标签在 SACL 内，故除 `WRITE_DAC` 外还要 **`WRITE_OWNER`**。而 `D:\` 根 ACL 是 `Authenticated Users:(M)` 继承 ⇒ 程序创建的工作区根只有 Modify ⇒ 响亮失败。
2. **看到 `S-1-4-…:(OI)(CI)(W,D,DC)` 显式 ACE｜判"沙箱自己的能力 ACE"｜**不要删**：它按规范化工作区路径派生（每工作区一个 SID），与 `D:\tmp` 上的同型 ACE 不同 SID 即为例证；删掉等于拆掉沙箱写入授权。真要修的是"签名用户缺完全控制"这一条。
3. **验证权限类修复｜用对照实验｜无授权目录做"同值改所有者"应 `Access is denied`，已授权目录应通过**（同值改所有者需要 `WRITE_OWNER`，且不改动任何实际值）。
4. **资源管理器创建的目录通常带签名用户完全控制 ACE，程序创建的（`D:\` 下居多）常常没有**｜新工作区上手先查这一条；DSH 自带诊断脚本 `diagnose-windows-sandbox-acl` 做的是同一件事（含祖先目录、备份与逐项复核）。可重跑版本见 `docs/gui-verification-protocol-20261013.md §5.4`。

## 2026-10-16 ｜ 主题：会话日志外来事件（第三方插件写日志的连带后果）

1. **会话 resume 报 `contains event type "<x>" … unknown to this harness and not marked ignorable`｜说明有第三方插件往会话日志写了**未标记**的自定义事件｜撤挂载 ＋ 上游 `scripts/repair-session-logs.mjs repair --home <DSH_HOME>` 补 `ignorable: true`**：宿主读路径对"未知类型＋无标记"的行**拒载整条日志**（不是显示层问题，删挂载也不会自愈）。
2. **该宿主构建 `Session.append()` 无法为新事件类型打标记（宿主 asar 内文档原话）⇒ 插件探测到宿主不支持后会停用会话审计，故每个受影响会话恰好只留 1 行**——"18 会话 × 1 行"这个数目自洽性本身就是根因的旁证。
3. **验收"会话真的被加载"｜看会话日志 mtime 前进并追加宿主原生行 `session/end-seed`｜不要只看界面不报错**。
4. **dev-mount／临时 insert 落地即登记三件：撤除条件／撤除动作／撤除后复验判据**｜本轮 18 会话拒载就是"注释里写了撤除条件、却从未执行"。

## 2026-10-16 ｜ 主题：GO 反代（OpenCode GO）模型面的真值口径

1. **判断某模型是否"免费"｜以官方文档的免费清单为准｜文档里带 `-free` 的只有 `longcat-2.5-preview-free` 与 `cat-jam-free`**：`cat-jam-free` 的开放区**不含中国**（含港澳）⇒ 本机 403 RegionError；`step-5-preview` 被列为**有价**；文档里**没有** `deepseek-v4.1-flash-free`。
2. **"网关能调通" ≠ "免费"｜看路由指纹｜`longcat-2.5-preview-free` 返回头 `x-opencode-endpoint-id=longcat-go-promo`（promo），而 `step-5-preview-free` 是 `openrouter-stepfun`（无 promo 标记）**⇒ 后者的计费归属**未证实**（用户已知情并指示使用；默认档可一键回退到 longcat）。
3. **负向结论必须有对照组｜同形请求：`longcat-2.5-preview-free` 200 vs `deepseek-v4.1-flash-free` 400 `Model is unavailable`**——否则"该 ID 第三方不可用"只是单点观测。另：`/v1/models` 列表可能不收录能用/免费的预览模型，故**列表缺项不能单独否证**。
4. **反代调用形状**：`POST https://opencode.ai/zen/go/v1/chat/completions` ＋ `Authorization: Bearer <GO key>` ＋ `x-opencode-session: <会话>` ＋ `User-Agent`；在 PowerShell 里**用 stdin 传体**（`… -d "@-"`）避免引号被转义成 400（另：PowerShell 7 的异常对象在 catch 时可能已被释放，取响应体改用 `curl.exe`）。

## 2026-10-16 ｜ 主题：判据面（窄版宿主默认判据）

1. **要给"没有任何已登记断言"的回合兜底｜只从宿主亲见的物理副作用派生｜写类→`exists:<路径>`、删除类→`not_exists:<路径>`；命令类只认删除且必须过误阻守卫，**不**派生 `cmd_exit0`**：与"禁跑一条无关命令凑 exit 0"同一口径。
2. **语义边界必须写死在档里｜"动作落地"≠"目标达成"｜独立记账 `kind=effect-closeout`，不与目标级 `auto-closeout` 混计**：复核指标时两列分开报，相加即等于把动作落地冒充目标达成（见 `验证库/已知边界与接受风险.md` 第 5 条）。
3. **优先级｜已登记断言（pinned／用户原文派生／tool 自登记）恒在 `effect` 之上｜有任一登记断言时不触发该层**；开关 `SHISANUO_EFFECT_ASSERT=0` 关闭（默认开）。
4. **采集面边界（如实）｜副作用在 pre-execute 侧采集、按"本回合出现过的工具名"对账取用（有界缓冲 16、用后即走）｜多 agent 同进程且工具名相同时存在误取可能**，已在档里标注为已知边界。

## 2026-10-16 ｜ 主题：熔断触发与批次装置（skip-notice／样本轮）

1. **要实机触发「熔断跳过」链｜`SHISANUO_STEER_CAP=1` ＋ 一条结构性不可满足的 pinned 断言 ＋ 任务含工具调用｜链路＝首次失败 `gate-steer` → 重试失败 → `gate-steer-capped` → `skip-notice` 落账＋`noticeMessage`（`form=notice`＋三问文案）注入**：`shouldSteerNow(used,cap)` 对 `cap<=0` 恒不熔断（非法配置保守放行），故不能拿 0 当"立即熔断"。
2. **恒假判据选型｜选「模型无从下手」的形态｜命令类恒假（`cmd_exit0:cmd /c exit 9`）＞ 不可达盘符路径 ＞ 可造路径**：路径类（如 `exists:Q:/…`）会诱发模型"修断言"行为（实测：模型尝试 `subst` 造盘、装 ACL 诊断 skill 查沙箱）——测试轮被拉长且引入无关动作。命令类恒假无此诱因，全程无无效探索。
3. **批次轮次有效性｜按 pre-execute（工具调用）证据判定｜`exit=0` 只表示进程正常结束**：弱模型「发言即止」会让整批"全绿"但零产出（实测十轮空口声称完成）；提示词显式加"必须实际调用工具"可修复。
4. **被中断的长批量｜先确认子进程是否成为孤儿仍在跑｜批次装置默认带断点续跑**：命令的父进程被杀 ≠ 子进程退出；两个进程并发续写同一会话会被宿主写锁拒（`session … is already owned by an active write handle`，exit=1 不污染会话）——写锁是宿主侧的自证保护，但 turn 计数会重复，需人工核对。

## 2026-10-16 ｜ 主题：记账分列（ok-effect）与写入面/对账面同步

1. **「独立记账」要贯穿到回合级 verdict｜不能只有 kind 分列**：`effect-closeout`（动作级）与 `auto-closeout`（目标级）的 kind 本就分列，但回合级 verdict 曾合并为 `ok-auto` ⇒ 「auto-closeout 占比」会混入动作落地。**加固＝新增 `ok-effect` verdict**（effect 分支置 `effectClosed` 标记），tally 六态计数扩为七态。
2. **写入面新增字段必须同批改对账面｜`tally` FIELD_WHITELIST ＋ CAPS**：A4 给 `gate-tool` 加 `summary`（≤500 截断）时未同步白名单 ⇒ 62 处 live 违规。**注意机检覆盖缺口**：`tally-whitelist` 单测只查 kind 级（源码 `log({kind})` ↔ 白名单键），**字段级**漂移只有对 live 日志跑 `--check` 才暴露——新增字段时两处都要动。
3. **live 日志的历史遗留违规与现行违规要分开处置**：历史 kind（budget 类等）属"退役层留痕"，维持"清历史 vs 白名单兼容"未决项；**现行写入面的缺口（字段缺失）应当场补**。

## 2026-10-16 ｜ 主题：跨平台口径与 CI 验收

1. **路径类判据要平台分口径｜Windows 盘符与 POSIX `/…` 是两套绝对路径**：`firstAbsolutePath` 曾只认盘符 ⇒ Linux 宿主上 effect 层静默失效（CI 套件红两天）。平台分支写法＝`process.platform === 'win32'` 决定接受集；**本地预验**可用 `Object.defineProperty(process, 'platform', { value: 'linux' })`**先于模块导入**做 stub（`tmp/posix-sim.mjs` 10/10 过）。
2. **文档链接不得用本机绝对路径**：机检规则＝盘符绝对路径一律判"不可移植"（`scripts/check-md-links.mjs`）；`logs/`、`tmp/` 等不入库目标也别做链接，改纯文本留档说明。
3. **推送验收＝哈希 ＋ CI 结论双核**：`git ls-remote` 只证"推上去了"，`gh run list` 才证"过了"——只核前者会出现"入档全绿、远端实红"。

## 本次变更索引（权威档，避免重复）

- 完整变更/修复清单与证据：`CHANGELOG.md` 的「批5 续（2026-10-16）」与「熔断验证＋样本轮（2026-10-16）」节。
- 会话拒载事故的处置规程与铁律：`docs/gui-verification-protocol-20261013.md §5.3`。
- 桌面档 shell 被 ACL 阻断的成因与修法：同档 `§5.4`。
- 四项裁决的落定与影响面：`docs/design-specs/v5-execution-report-20261016.md §4`。
- 判据面的接受风险与不可混计口径：`验证库/已知边界与接受风险.md`。
- 熔断端到端与 effect 样本轮结果：`docs/design-specs/effect-layer-sample-round-20261016.md`（含装置命令与边界）。
- 证据留档：`docs/evidence/desktop-resume-error-20261016/`（红字前后截图；官方页面原件不入库，结论在此）。
