# Config 契约（v0.3 · content/rules.json 与 content/discipline.md）

> 本档=release-plan v0.3 DoD「Config 契约先行」的落档。改规则=改 content 文件，不动引擎代码。

## 1. 可配置项清单（Config 面）

| 项 | 位置 | 类型 | 默认（随仓 content） | 说明 |
|---|---|---|---|---|
| `version` | rules.json 根 | 整数，必须=1 | 1 | 规则包结构版本；非 1=无效（回退） |
| `l3Domains[]` | rules.json | 非空数组 | 6 域 | 每条 `{domain, pattern, flags?, noExempt?}`；命中即拦 |
| `readonlyExempts[]` | rules.json | 数组（可省） | 9 条 | 每条 `{pattern, flags?}`；命中=放行（豁免） |
| 纪律文本 | content/discipline.md | 非空 UTF-8 文本 | 与引擎内嵌默认逐字镜像 | systemPrompt 注入正文 |

覆盖方式（开发/测试钩子）：环境变量 `SHISANUO_RULES` / `SHISANUO_DISCIPLINE` 指向替代文件路径。

## 2. 必配 vs 引擎固定

- **必配**：`version` 与 `l3Domains`（缺失/空=整体无效）。
- **引擎固定（不开放 Config）**：GATE/行为机判逻辑、gate 工具参数与三态判定、执行超时（30s）、遥测字段与截断帽、横幅格式、A/B 臂开关（文件旗标）。
- **彻底解除防护不在 Config 面**：把 `l3Domains` 置空=无效配置→回退内置默认（fail-closed）。要完全关闭拦截须改引擎代码（白盒可改，但必须是有意识的源码级动作）。

## 3. 结构校验（compileRules）

- `domain`/`pattern`：非空字符串；`flags`：仅 `imsu`（**禁 `g`**——有状态 lastIndex 会造成间歇性漏判）；`noExempt`：布尔。
- 坏条目**逐条跳过**并记入 reason（其余照常生效）；正则编译失败按坏条目处理。
- 有效域数为 0 → 整体无效。

## 4. 无效配置行为（fail-closed）

任何装载失败（文件缺失/JSON 解析失败/结构无效/空域表）→ 回退**引擎内置默认规则**（与随仓 content 初版逐字等价，由单测语料锁定），同时：
- exec-log 落 `{"kind":"rules","valid":false,"reason":"…"}` 行（可审计）；
- 宿主控制台打印告警；
- 会话照常可用——防护从不静默解除，降级必有痕迹。

## 5. 新旧版本兼容

- `version` 非 1：拒用（回退默认+reason 注明）——规则包不支持跨结构版本静默兼容，未来结构升级走 version=2 显式迁移。
- 引擎升级新增域时：content 旧文件不含新域=用户显式选择不启用该域（合法差异）；随仓 content 与内置默认的等价性由单测在 14 例语料上回归。

## 6. 行为变化可重复验证（DoD 核心项）

「改 rules.json → 测试观察行为变，非仅文件变」——tests/config-rules.test.mjs §3 固化了三条可复现证据：
1. 加域：自定义 `deploy-to-prod` 域 → 同一命令 `deploy-to-prod --go live` 从放行变为拦截；
2. 删域：自定义规则无数据删除域 → `rm -rf /x` 从拦截变为放行；
3. noExempt：豁免表对 `noExempt: true` 的域不生效。
真实宿主行为验证：`SHISANUO_RULES=<自定义包> dsh headless <含触发命令的任务>` → exec-log 出现 `l3-intercept` 行且 `domain=自定义域名`（见 CHANGELOG v0.3 证据节）。
