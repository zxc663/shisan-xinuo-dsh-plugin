# 换芯决策表：dsh-permission-rules（B1-A 实机实测）· 2026-10-13

> 依据：`permtest` 隔离档（headless 副本，独立不动原档）＋真机 headless 实验 run1–run7；证据＝运行输出（`D:\tmp\b1a\run*-out.txt`）＋`logs/exec-log.jsonl`＋文件系统真相。
> 结论：**M1（直用＋映射）可行，Q1–Q5 全部落定；另发现 3 个"整合必改项"**。

## Q1 顺序与叠加（实测）

- 组合树：bundle(`permission-rules`) 先声明、patch(`shisanxinuo-core`) 后；**实际瀑布顺序＝我方先手**（run1：我方 `pre-execute` 先记录，其 deny 在后）。
- 重叠命令（run2：`Remove-Item` 同时命中我方 L3 ask 与其 deny）＝**我方 ask 赢、其 deny 未到达**（链被我方中止）。
- ⇒ 整合建议：**翻转优先级**——我方命中后先 `await next()`，上游放行再抛 ask（用户手写 deny 应压过便利性 ask）；改动≈1 处（B3）。其 `allow` 无回执，翻转不受影响。

## Q2 DSL 承载力（关键分辨）

- **`paths` 只吃结构化路径字段**（read.file_path / write / edit、参数里的 files 等）；**不解析 pwsh 命令字符串**（run5 同路径：`read` 被拒，`pwsh Set-Content/Get-Content` 全通过）。
- ⇒ 翻译规则：**命令内路径/资源类控制必须落 `params.command`**（我方 9 域正则以 `patternMode: regex` 直接平移）；`paths` 作文件工具的补充维度。
- 建议排序：8 条豁免 → 顶层 `allow`；随后 9 域 → `ask`（`noExempt` 域不配豁免）。内置 baseline 建议**保留**（净增覆盖；本次被先手遮蔽未单测）。
- 全量语义对照（8正10负＋23 例＋16 次真宿主）留 B3 回归清单；本轮抽检已覆盖 deny/ask/allow/栈/路径两形态/绕过两类。

## Q3 安装面（实测）

- `dsh plugin --profile permtest add dsh-permission-rules`：21.2s 装成（pnpm 11.23）；`--dump-config` 双插件合成；**0.2.0-rc.2 实机 7 场全稳**——兼容=通过（其主测 0.2.1-alpha.1，engines 覆盖 0.2.x）。

## Q4 实测发现（决策关键）

1. **HMR＝真**（run7）：会话进行中改规则（deny→allow，编辑时刻 11:34:12 落在 sleep 窗口内），同会话下一发（03:34:4x）即时放行——**"按判级切规则源"机制可行**（第 f 项）。
2. **gate 旁路＝真**（run1）：被 deny 的命令经 `discipline_gate` 宿主直跑成功（realExit=0）。整合必改项#1：gate 增加"下游回执观测＋被拒指纹"（我方先手可拿到 `next()` 回执），指纹命中即拒跑；或 gate 改走工具管线。（run5 见证：gate 参数里含被拒路径时上游可拦——但命令本体不涉路径时仍穿透。）
3. **工具域性绕过**（run4→run5）：write 被 deny → 模型换 `pwsh Set-Content` 写同路径；放宽 tools 后 shell 路径仍穿透（见 Q2）——**规则必须"双写"（file 工具 paths＋shell params.command）**，否则模型换工具绕过。
4. **gate 被上游 deny 时**（run5）：模型回退文本 GATE（`exit=未验证`＋exempt）仍被接受收口——B2 断言绑定需覆盖该缺口。
5. 旁证：gate 单命令超时＝30s（run7 `pwsh && sleep30` 链超时报 error）——验证命令勿用长链。

## Q5 资产处置（建议）

- **退役**：core 内 L3 匹配器/语料（755 行中约七成）——由其承接。
- **保留＋接线**：判级信号（→预算/收口强度）｜`rules.json` 作为**唯一规则源**（生成器→其 YAML，"我们＝内容作者"）｜gate（含必改项#1）｜steer｜遥测/对账。
- 不做"双源合一"：交付"生成器＋一致性检查"（B3）。

## 整合必改项（B3 范围，共 3 项）

1. **gate 旁路封堵**（下游回执观测＋被拒指纹拒跑；或改走工具管线）。
2. **优先级翻转**（我方后置 ask）。
3. **生成器**：`rules.json→.dsh/rules.yaml`（豁免 allow 置顶＋9 域 ask/regex 平移）＋回归清单闭环。

## 回退与现场

- `permtest` 为隔离实验档：回退＝`dsh plugin --profile permtest remove dsh-permission-rules` 或直接删档；原 `headless`/`ab`/`desktop` 未动。
- 实验现场：`D:\tmp\b1a`（`rules.yaml` 与 `run2–run7-out.txt` 为证据；junk*/protected/ 为测试产物）。

## B3a 实施记录（2026-10-13 · 必改项 #1/#2 落地并实机验证）

- **形状实测（实施依据）**：下游裁决回执＝`deny/ask→{kind,reason}`；`allow/无匹配→{kind:'allow'}`（probe-deny/ask 两轮实跑）。
- **#1 旁路封堵（gate/断言直跑通道）**：新增「上游拒绝指纹」——下游拒绝即按归一化命令（小写+折叠空白，≥12 字符，10 分钟 TTL）记录；`gateJudge` 在 L3 判定外复核指纹，命中→`refused`（域=上游拒绝指纹(旁路封堵)）并落账 `bypass-blocked`；断言 `cmd_exit0` 同查。包含匹配覆盖包装态（`powershell -Command "…(echo MARKER…)…"`）。
- **#2 优先级翻转**：L3 命中路径改为**先 `await next()`**——下游拦截→原样返回并记指纹（`upstream-block`）；下游放行→再抛我方 ask（用户手写规则优先，我方兜底）。
- **实机验证**：
  - V1：deny 命中 → 模型按旧习惯拿 gate 重试同命令 → **`bypass-blocked`＋gate `refused`**（对照 B1 run1：当时 gate 真跑成功——**旁路已关闭**）；模型如实报告"收口验证被拒"。
  - V2：栈场景（Remove-Item 同命中双方）→ **上游 deny 先手**（模型看到上游 reason；`upstream-block` l3=数据删除）——对照 B1 run2 我方先手，**翻转生效**；文件保留、诚实收口。
- **测试**：新增 `tests/bypass-guard.test.mjs`（20 例：判定/归一/记录/包装态匹配/TTL/gate 集成）；全量 12 套全绿。
- **遗留（已由 B3b 收口，见下节）**：必改项 #3 生成器（`rules.json→.dsh/rules.yaml`＋`patternMode: regex` 配置行＋抽检）＋全量语义回归。

## B3b 实施记录（2026-10-13 · 必改项 #3 生成器＋全量语义回归收口 → B3 全清）

- **生成器**：`scripts/gen-permission-rules.mjs`——`content/rules.json → .dsh/rules.yaml`；输出 19 条=不可豁免域 ask(2)→豁免 allow(8)→其余域 ask(9)；ASCII 大小写折叠补足上游 regex 模式无 `i` 标志；镜像上游 ReDoS 结构护栏做生成期预检（fail loud）。内容面两条旧形态等价简改（rm 子句／node-python 选项组）＋豁免 flags `im→i`。单测 33 断言（`tests/gen-permission-rules.test.mjs`）。
- **配置行**：profile 覆盖 `patternMode: regex` ＋ **`builtin.enabled: false`**——实测发现 v0.7.15 内置基线为 glob 写法，regex 模式下编译失败致**整个条目静默失活**（首轮三跑零拦截实证）；转换版基线记后续候选。
- **全量语义回归**：`scripts/regression-permission-rules.mjs`（离线导入上游 `parseRulesDocument/compileRules/matchRules`）与我方判定逐条对照——**170 例 / 10 套件 / 阻断·域·注解三面 0 不一致**；语料单源=`tests/rule-corpus.mjs`（四套既有测试改引用）。
- **真机抽检**（permtest 隔离档）：A 臂（我方退观测）Remove-Item 仍被上游 ask→审批不可用 fail-closed 拦截（`approval/asked` reason=生成规则文案）；C 臂 `l3-intercept→upstream-block(upstreamKind=ask)`（B3a 翻转闭环）；豁免 `git clean -n` 真实放行。
- **结论**：M1（直用＋映射）落地；拦截层外置可用；core 正则层退役 diff 与内置基线转换=收尾候选。详见 `docs/b3b-generator-and-semantic-regression-20261013.md`。
