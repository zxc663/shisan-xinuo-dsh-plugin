# CHANGELOG（内部工程版本记录——非发行公告）

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
