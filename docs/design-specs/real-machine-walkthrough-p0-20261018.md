# P0 实机走查报告（会话级接线＋4 页管理后台＋concludeOnPass 复验）· 2026-10-18

> 性质：handover-20261018 v3 §5-9/§5-10（「P0 实机走查未做＝最优先」「concludeOnPass 翻转实机影响未复验」）的执行记录。装置与判据沿用 `memory/design/dsh-custom-p0-verification.md`（V1–V6）。模型=LongCat 2.5 Preview Free（dsh-go 免费档，GO 分账口径）。会话=新建测试会话 `session-4af03cec-652b-40a1-b37e-efab7c089385`（工作区 `C:\Users\zxc66\Desktop\Winform`），未触碰用户既有会话。
> 证据：截图 `D:/tmp/wt-20261018-p0/00–23`；执行账单 `dsh-plugin-dev/memory/logs/exec-log.jsonl`（UTC）；dsh-custom 审计 `D:\ai本地模型\dsh\dsh-custom\audit.jsonl`；API=`http://127.0.0.1:15768/api/dsh-custom`（本机免鉴权）。

## 0. 装置

- 桌面档 `cordis.patch.yml` 日常态（**未做任何改动**）：`shisanxinuo-core` dev-mount（工作树 src）＋`dsh-custom` insert（junction → 仓）——均为 2026-10-18 用户「桌面日常启用」登记的常驻态；新建备份 `.bak-20261018-p0`（未动原文件）。
- App 启动：首次 PowerShell Start-Process（5 进程起、有窗）；后按验证清单用 `launch-dsh.bat` 重启（清 ELECTRON_RUN_AS_NODE/NODE_OPTIONS＋GPU 参数＋日志捕获 port/token）。两次 boot 均核验。
- boot 行核验（06:41:45Z，秒级新鲜）：`arm=C`＋self-check `sections=5, gateTool/taskTool/catalog=true, concludeOnPass=false`（**翻转后的新默认已被桌面加载＝基线 1bef408 生效**）＋fingerprint `b805b0759d32bb5e`（与 14:09 boot 一致＝dev-mount 一直跑工作树码）＋rules domains=11。
- dsh-custom 审计三行：`boot` → `sysprompt-attached dsh-custom:discipline -2000` → `sysprompt-attached dsh-custom:user-prompt -1990` → `api-mounted /api/dsh-custom`。

## 1. V1＋V2 四段进装配与段序（API 直证）——✅

- `PUT /sessions/<SID>/override {"segments":{"discipline":"P0-VERIFY-纪律-E7Q4Z"}}` → `GET /assembly?session=<SID>`：
  - `sections[0] = dsh-custom:discipline`，chars=18，逐字=marker；
  - 段序＝dsh-custom:discipline(0) → dsh-custom:user-prompt(1, 空) → dsh-custom:layered(2, 空) → 官方面（harness:identity 等 24 段）＋ `shisanxinuo:core-discipline`（8339 字，运行时插件注入）——**会话级覆盖真实进入该会话装配，排最前，会话遮蔽全局**。
- 判据全中（清单 §1/§2）；失败表现（只有官方段）未出现。

## 2. V3 system complete 段两态——✅

| 态 | 操作 | 装配判据 | 结果 |
|---|---|---|---|
| a 非空 | PUT system=`P0-VERIFY-系统-K9M2X` | `dsh-custom:override` 独占（total=1），官方段全部消失 | ✅ 逐字符合 |
| b 清空 | PUT system=`""` | override ABSENT，27 段恢复，前三=三 dsh-custom 段 | ✅（P1 残留路径未复现） |

- audit 落账：`session-override-saved`×2 ＋ `session-system-applied` ＋ `session-system-cleared`。

## 3. V4 热生效与回落——✅

- 外部覆写 `sessions/<SID>/discipline.md`＝`P0-VERIFY-热生效-H8T1R` → 1 秒后装配即显示新文本（19 chars，无需重启）。
- PUT discipline=`""` → 装配 discipline chars=0（回落全局，全局空=该段不再贡献文本）。

## 4. V5 回滚两档——✅

- `rollback previous` → `restored=[discipline]`，装配回到 H8T1R（上一版恢复）。
- `rollback official` → `cleared=[discipline]`，四段清场回官方基线（页面「本会话覆盖=未设置覆盖（跟随全局）」互证，截图 21）。

## 5. concludeOnPass 翻转实机复验（真机回合全程）——✅

过程（意外收获三条治理链实证）：任务下发 → 模型按常驻核心先读档（HANDOVER/STATE/验证清单——**纪律注入驱动开工行为**）→ 越区写探测被 **l3-intercept** 拦截 → **L3 审批卡**（「数据删除」词面命中，等待审批，截图 05）→ 走查选**拒绝** → 轨迹落「user rejected tool pwsh」→ 模型改走 **ask_user_question** 两连澄清（意图/写 D: 策略；含自报 `Context: state=续接 L=L2-F clarify=待澄清`，截图 08-11）→ 作答后模型 `task-register` → `discipline_gate`（L2-F，带 assert）→ **`gate-tool pass` → `gate-ok`（06:59:35Z）**。

**关键判据**：gate pass 后回合**未**被 concludeTurn 终结——模型继续输出完整交付文本（意图/边界/Context 行/两线现状速览表，截图 12/13），输入框回位=回合自然结束。**翻转前该文本会被吞（用户只见工具行）；翻转后交付完整呈现——§5-10 的实机影响复验通过，新默认（关）保留。**

## 6. V6 页面 4 页管理后台走查——✅

| 页 | 判据 | 结果 | 证据 |
|---|---|---|---|
| 会话管理 | 左列表（工作区/会话短 id）＋右 5 段 tabs＋当前全文=真实装配 | ✅ 选 4af03cec：cwd 作用域支取、当前全文=harness 段＋v8 纪律全文（逐会话实取） | 16/20 |
| 系统提示词管理 | 五 tab（常驻核心/我的提示词/渐进加载层/系统原版/接管官方）＋编辑器＋保存 | ✅ 常驻核心空=不注入（与设计一致，装配由运行时插件段承担） | 19 |
| 快照与恢复 | 快照列表（14 个，含内容清单）＋逐条回滚按钮＋刷新 | ✅ | 18 |
| 统计数据 | 四卡（护栏 2/快照 14/活跃会话 3/会话外改动 0）＋审计时间线实时流水 | ✅ 时间线即时显示本次 V1–V5 的 applied/cleared/rollback 行——**stats 数据面真实工作（原治理占位缺口进一步收敛）** | 17 |
| 未实现项 | 导入导出/渐进加载层编辑/会话对话弹窗点击=如实提示 | ✅ 「未实现：导入/导出：落地时必须实现」 | 22 |

## 7. 缺陷与残留（诚实）

- **本轮零新增缺陷**；V1–V6 全过，无红字告警。
- 观察一条（非缺陷）：LongCat＋纪律段下模型倾向把简短任务重释为「接手续作」（读档后自行转向取证），目标文件未创建亦无残留——任务语义对齐成本与纪律强度正相关，记录备查。
- 已知残留不变：会话 id 归一撞车（backlog D5）；段级＋fiber 句柄双失时清空 system 仅 console.warn（宿主双重违约路径，未触发）。
- 会话收尾：测试会话经 rollback official 清场；测试会话本身保留（含取证对话，无敏感内容）。

## 8. 结论

P0「会话级覆盖已接线」从套件证据（537 例）升级为**运行时实机证据**：四段真进装配、段序正确、complete 两态正确、热生效、回滚两档可用；4 页管理后台全要件渲染、数据面真跑、未实现项如实提示；concludeOnPass 新默认实机成立。handover §5-9/§5-10 勾销，剩余大项仅=待裁定拍板＋发行解冻（显式决策）。
