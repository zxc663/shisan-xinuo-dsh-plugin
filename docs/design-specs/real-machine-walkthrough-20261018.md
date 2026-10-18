# 实机走查报告（页面 9 区＋运行时行为）· 2026-10-18

> 性质：roadmap「实机走查（最优先，验收主对象）」的执行记录——挂载两插件后于桌面 DeepSeek Harness 真机逐项走查，每项留截图或执行账单（exec-log）。模型=免费档 LongCat 2.5 Preview Free；会话=标准模式。
> 证据目录：截图 `D:/tmp/wt-20261018-a/`（编号 01–31）；执行账单 `D:/DeepSeek/dsh-plugin-dev/logs/exec-log.jsonl`（UTC 时间戳）。

## 0. 装置

- 桌面档 `cordis.patch.yml`：`shisanxinuo-core` dev-mount（工作树源）恢复挂载（备份 `.bak-20261018-e1v5-walkthrough`；撤除登记见文件内注释——本轮跑毕按登记撤除）；`dsh-custom` 维持留驻。
- App 重启后 boot 行核验：`arm=C`＋`self-check sections=5, gateTool/taskTool/catalog/concludeOnPass=true, fingerprint=7bb2bc7aba7922ed`＋`rules valid domains=11`。

## 1. 页面 9 区走查（dsh-custom「DSH自定义」）

入口=设置（头像菜单→设置）→ 左侧「DSH 自定义」。实际导航渲染为 **8 个分区**（概览/提示词中心/接管官方/作用域/快照/审计/治理/设置）——草图 9 项中的「备份管理」已并入「快照」区；此差异为文档口径项，登记不予改写实现。

| 区 | 结果 | 证据 | 观察 |
|---|---|---|---|
| ① 概览 | ✅ 渲染 | `03-dshcustom-zone1.png` | 渲染全文/分区源码双视图；装配指纹（生成时间/作用域=全局未附着/渲染=在线-容错模式）；卷内即核心纪律 v8 全文 |
| ② 提示词中心 | ✅ 渲染 | `04-zone2-prompt.png` | 常驻核心（总开关开；dsh-custom 镜副本空=不注入，装配由 core 段承担）＋我的提示词（开关开、空=不注入）＋渐进加载层（指纹=全部分节与出厂一致） |
| ③ 接管官方 | ✅ 渲染 | `05-zone3-override.png` | complete 整段替换装态=已关闭；红字互斥警告在位 |
| ④ 作用域 | ✅ 渲染 | `07-zone5-snapshot.png`（含） | 规则列表空态正常；越具体越优先说明在位 |
| ⑤ 快照 | ✅ 渲染 | `08-zone6-audit.png`（含） | 快照列表（10-17 多档）＋回滚按钮 |
| ⑥ 审计 | ✅ 渲染 | `09/11-*.png` | 护栏计数（拦截 0/只读触碰 0）、audit.jsonl 共 115 条（近 80 条展示）、renderer-resolve/容错渲染记录在位 |
| ⑦ 治理 | ✅ 诚实占位 | `12-*.png` | 「只读占位：运行时日志 API 未暴露前不显示数据（不伪造）」——按设计 |
| ⑧ 设置 | ✅ 渲染 | `12b-settings.png` | 纪律注入开关、装配序、护栏语义、存储位置、AGENTS.md 检测（2463 字节）显示在位 |

## 2. F1 判级强制＋追加判级（真机）

- **补判级**：真机会话发「创建文件」任务并指示不输出状态行 → turn-stopping 触发 `discipline-steer {needLevel:true, needChecklist:true, append:false, hostLevel:2}`（22:18:50Z）＋F10 分节注入 `layered-inject l2f-full-workflow.md (trigger=discipline-gap)`；模型收到 steer 后**补出状态行**（`Context: state=单次 L=L2-F…`）＋补登记断言，收口 gate-ok。
- **追加判级**：同会话追加「继续，把 ok.txt 追加第三行 done。」→ `append-followup` 识别＋`task-open trigger=user-message+append` → 回合收束 `discipline-steer {append:true, needLevel:true}`；模型按追加版文案**评估升降档**（「维持原判级不升档」）后收口。
- 证据：`17/18/20/21-*.png`（含 steer 文案上屏）＋exec-log 两处 steer 行＋`gate-ok turn=1/2`。

## 3. F8 压缩信号端到端（真机）

- 会话内执行宿主 `/compact` → UI「已压缩 27 条历史记录（约 5480 tokens）」→ exec-log `compaction-detected`（修复前该值=0，见 §5）→ 下一回合 turn-stopping `compaction-signal via=inject-notice`＋`layered-inject compression-reload.md (trigger=compaction)`。
- 模型收到 notice 后执行**重载序**：重读纪律/任务状态（`discipline_task status`）/工作区真值（重读夹具）/「复述：任务本质＝…当前步骤＝…回滚基线＝…」并附**断层声明**（「此后无一二手记忆，基于真实重读与留档」）——与 compression-reload 协议逐条对应。
- 证据：`22/23/24/25-*.png`＋exec-log `compaction-detected/compaction-signal/layered-inject` 三行＋模型重载复述原文。

## 4. F3 越区写与写审计（真机；含缺陷发现）

- 会话（工作区 `D:\tmp`）指示把文件写到工作区外 `D:\DeepSeek\dsh-plugin-dev\wt-write-audit-probe.txt`：宿主沙箱先行拒写（界面原文 `Error: [sandbox: file access denied under workspace-write mode]`）→ 模型申请 danger-full-access 提权卡 → 走查选择「拒绝」→ 文件不存在（Test-Path=False）保持。
- **发现缺陷并处置（详见 §5）**：首次走查 `write-audit` 遥测**零落账**（workspaceCwd 恒空）→ 修复后复验：`workspace-cwd {cwd:"D:\\tmp", via:"runtime-context"}`＋`write-audit {tool:write, inWorkspace:false, enforcement:"host-sandbox(对账)"}` 落账（`29-*.png` 会话；exec-log 行）。
- 结论：**执法主体=宿主 sandbox（实证拒写＋提权卡）；插件对账遥测修复后成立**。

## 5. 走查发现的缺陷（3 处，已修复＋复验＋单测）

| # | 症状（实机） | 根因（实机取证） | 修复 | 复验 |
|---|---|---|---|---|
| 1 | `write-audit` 从未落账；`workspace-cwd` 全库 0 行 | 宿主 0.2.0-rc.2 **不出** `working-directory/change` 会话事件（整条会话日志无该事件；cwd 真实来源=runtime-context 快照消息） | 新增 `extractRuntimeContextCwd`（runtime-context 解析；change 事件保留次源）＋单测 7 例 | 真机 `workspace-cwd via=runtime-context`＋`write-audit inWorkspace=false` 落账 |
| 2 | `compaction-detected.shadowedTokens` 恒 0 | `compaction/end` 事件 data 无该字段（真机实证仅 compactionId/sourceCommandId/turn）；字段在 `compaction/summary`（shadowedSeqs 27 项、shadowedTokenCount=5480） | `extractCompactionShadowedTokens`（summary 捕获→end 取用）＋单测 7 例 | 真机 `compaction-detected shadowedTokens=6313` |
| 3 | `ask_user_question` 提问文案含删除动词 → 误弹 L3「数据删除」审批卡（E1-v5 台账 10-17 23:00:07Z 实录） | 询问类工具参数=**展示提问文本**（无执行副作用），被 pre-execute 词面判据误报 | `isInquiryTool` 豁免（执行面工具判定不变；`discipline_gate` 命令仍受 L3 护栏）＋单测 6 例 | 真机陷阱会话：`pre-execute tool=ask_user_question l3:null`、零 `l3-intercept`、问题卡正常（`40-l3fix-trap.png`） |

三修复均走「失败用例先行」（套件先红后绿）＋全量 34/34 绿；tally 白名单同步（`workspace-cwd.via`）。

## 6. 未覆盖/边界（诚实）

- 治理面板数据面仍为占位（运行时 log API 未暴露）；备份管理并入快照区（与草图 9 项差异登记）。
- F7「收口证据并入输出」按 P1 探针裁定不做（无宿主渲染通道）；本走查以 tool/result 原生渲染可见性为准。
- 走查为单日快照；宿主更新（10-17）后的行为面以上述证据为准，跨版本回归留待日常验证。
