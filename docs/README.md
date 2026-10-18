# docs · 文档区（索引）

> 本区是三库结构中**推进库／验证库**的物理承载：推进事项入口见 [../推进库/](../推进库/)，可复跑证据与结论口径见 [../验证库/](../验证库/)；未验证想法在 [../想法库/](../想法库/)。

## 评估与路线

- `plugin-assessment-and-roadmap-20261013.md` — **插件实质效应评估与改造路线**（分块效应＋每条主张附最强反驳与处置＋C→B 选优＋DSH 挂点实现细节＋落地顺序与验收判据＋未定论清单）。
- `extension-design-20261014.md` — **DSH 扩展面盘点与设计提案**（能改工具/改结果/加界面的能力面实查；B1 工具卡→B3 UI 呈现的落地序；统一红线）。
- `ui-handoff-20261014.md` — **界面开发必备知识**（第一手资料路径／扩展机制摘录／本插件留给 UI 侧的稳定标识／挂载与探针方法／红线／呈现清单／未验证项）。

## 验证与证据

- `validity-report-20261013.md` — 完成信号有效性报告（H1–H5 判定、阶梯、出题层五版通道、全电池总判定、两次真机抽检）。
- `design-specs/completion-signal-validity-plan-20261013.md` — 预注册计划（含 R1–R20 修订记录；判据与阈值跑前冻结）。
- `evidence/` — 实验原始数据入库（外部可复查部分）；`evidence/layer3-20261016/README.md` 为层3/D 四臂实验证据（批2 门禁批）。
- `audit-response-20261013.md` — 第三方审计处置报告（含洞 A／洞 B 拆分与判据锚点）。

## 设计与决策

- `design-specs/` — 设计档（含对话弧研究、A/B 预注册、发行与版本规划等）。
- `design-specs/shisan-xinuo-runtime-roadmap-20261017.md` — **运行时治理总路线（现行）**：F1–F12 功能规划＋P0–P6 迭代阶段（吸收并替代旧 v2/v3 路线）。
- `design-specs/p1-host-probes-20261017.md` — P1 探针批结论：timed ask 原生／compaction 事件族／projection 缝无 renderer 面／sandbox 三档原生。
- `config-contract.md` — 配置与规则包契约。
- `b2-acceptance-binding-report-20261013.md` · `b3b-generator-and-semantic-regression-20261013.md` — 验收绑定与拦截换芯批次报告。
- `positioning-and-reuse-strategy-20261013.md` · `implementation-batches-20261013.md` · `product-recalibration-20261013.md` — 定位、执行域与产品校准。
- `reuse-decision-permission-rules.md` — 换芯决策表（含 `permtest` 实机发现）。
- `gui-verification-protocol-20261013.md` — GUI 验证口径（默认验证通道、三路取证、边界）。
- `e1-v1-report-20261013.md` · `e1-desktop-report-20261013.md` · `e1-v4-four-arm-report-20261013.md` — E1 三臂／桌面／四臂实验报告。
- `design-specs/e1-v4-desktop-four-arm-20261013.md` — E1 v4 四臂预注册（桌面档）。

## 研究 · 探针 · 复用（2026-10-15/16）

- `probe-host-api-20261015.md` — 宿主 API 五证实（guard/concludeTurn/defineTool/workflowEngine/goals）。
- `reuse-research-landing-options-20261015.md` — 复用调研落地选项。
- `reuse-decision-outcome-loop.md` — outcome-loop 复用决策（源码实查＋真机装载；代际不兼容裁定）。
- `reuse-decision-toolface-20261016.md` — 工具面复用决策（上游 tool-search 采纳；本插件运行时裁剪退役路线）。
- `go-free-models-probe-20261016.md` — GO 免费模型探针与实测结案（反代链路与门禁）。

## 收口执行（v5 · 2026-10-16）

- `external-anchor/awesome-pr-packet.md` · `external-anchor/trial-guide.md` · `external-anchor/feedback-template.md` — 外部锚物料（awesome PR 包／试用指引／反馈模板；内部准备，对外动作逐项批）。

- `env-matrix-20261016.md` — 三档环境矩阵（裸/实战/预览线；构建配方与接缝发现）。
- `preview-line-compat-20261016.md` — 预览线兼容矩阵（alpha.4 隔离档）。
- `findings-20261016.md` — 宿主线普查发现（A/B/C/D 编号、分层修法、砍除清单、诚实边界）。
- `design-specs/layer3-quantification-prereg-20261016.md` — 层3/D 量化实验预注册（四臂冻结判据）。
- `design-specs/layer3-quantification-results-20261016.md` — 层3/D 量化实验结果（H1 支持/H2 代价量化/H3 成立）。
- `design-specs/install-and-peer-conclusion-20261016.md` — 安装与 peer 结论（三形态实测、不声明 peer 的依据与代价、上游锁定）。
- `design-specs/v5-execution-report-20261016.md` — 收口执行报告 v5（逐批状态、三指标真值、交付物索引、待裁四项、复跑命令）。
- `design-specs/effect-layer-sample-round-20261016.md` — effect 层样本轮 A/B 对照（steer 1.0/轮→0、动作级 0→10/10、目标级分列 0/0；绝对路径边界与弱模型抖动事故如实记录）。
- `design-specs/e1-v5-supplement-prereg-20261016.md` — E1-v5 有效性补样本轮**预注册**（n≥5 四臂当前版重跑；判据/排除规则/门槛冻结；执行待窗口）。
- `design-specs/config-entry-research-20261017.md` — **配置入口惯例调研**（生态全景 1000 条目录/市场/23 分类；配置入口三 代际机制一手证据；竞品抽样；投稿规范对我们影响）。
- `design-specs/config-entry-design-20261017.md` — **配置入口设计（冻结）**（插件页卡片→设置页三卡片：执行账本 P0/规则包 P1/纪律文本 P2；文件=权威层、UI=叠加层；双轨兼容）。
- `design-specs/dsh-custom-prompt-research-20261017.md` — **「DSH自定义」系统提示词管理·调研**（装配链 API 全貌/`complete` 深改机制/0.2.1-rc.1 对照/生态近邻 `dsh-agent-persona` 深核与复用裁定）。
- `handover-dsh-custom-20261017.md` — **「DSH自定义」P0 交接文档**（现场/卡点与诊断线索/环境与撤除三步/纪律/交接提示词全文）。
- `design-specs/dsh-custom-prompt-design-20261017.md` — **「DSH自定义」设计冻结**（三区页面：官方提示词只读/complete 深改/纪律前置；总开关与作用域；分期 P0-P3；拍板项呈报）。

## 迭代推进轮（2026-10-18）

- `design-specs/e1-v5-supplement-prereg-20261016.md`（含 R5 重基线修订）· `design-specs/e1-v5-supplement-results-20261018.md` — **E1-v5 有效性补样本轮**：预注册与执行结果（75 有效会话；真值 72/75；治理层差分仅 C 臂成立；装置事故如实全录）。
- `design-specs/real-machine-walkthrough-20261018.md` — **实机走查报告**（页面 8 区渲染＋F1 判级强制/追加判级、F8 压缩重载信号、F3 越界写审计的真机证据；两处缺陷发现→修复→复验记录）。
- `design-specs/real-machine-walkthrough-p0-20261018.md` — **P0 实机走查报告**（会话级覆盖 V1–V5 API 直证＋4 页管理后台 V6＋concludeOnPass 翻转复验＋L3 拦截→审批→拒绝→澄清→收口全链活证据；零新增缺陷）。
- `evidence/e1v5-20261018/` — E1-v5 轮原始会话记录（`sessions-r1..r5.jsonl`，含作废标记；截图与本机装置留档见报告 §7 指针）。

## 其余（评估 · 证据 · 交接）

- `extension-design-20261014.md` · `handoff-experience-optimization-20261014.md` — 扩展面设计与体验优化交接。
- `validity-report-20261013.md` · `design-specs/dialogue-arc-research-20261013.md` · `design-specs/dsh-m3-ab-preregistration-20261012.md` · `design-specs/e1-prereg-v3-20261013.md` · `v1-acceptance-20261013.md` — 有效性/对话弧/M3/E1 预注册/V1 验收。
- `external-briefing-20261013.md` · `external-review-absorption-20261013.md` · `findings-from-real-trajectory-20261013.md` · `feedback-candidate-rule-371-20261013.md` — 对外简报、外审吸收、真实轨迹发现、候选规则。
- `todo-next-20261013.md` · `positioning-and-reuse-strategy-20261013.md` · `implementation-batches-20261013.md` · `product-recalibration-20261013.md` — 待办、定位、执行域、产品校准。
- `design-specs/dsh-toolification-roadmap-20261013.md` · `design-specs/experience-optimization-20261014.md` · `design-specs/release-and-versioning-plan-20261013.md` — 工具化路线、体验缺口、发行与版本规划。
