# shisan-xinuo-discipline（开发代号 dsh-plugin-dev）

**基于 DeepSeek Harness（DSH）的白盒工作流治理插件**——把依赖模型自觉的工程纪律转化为宿主运行时可执行、可测量、可修改的流程控制。源码单文件引擎（`src/shisan-xinuo-core.ts`）+ 数据层规则包（`content/`），一切行为面可用真实运行证据复查。

> 状态：**v1.0 工程验收版（内部）——未发行**。全部主张按下方状态标签分层，未过对照实验的不宣称有效性。

## 能力矩阵（主张=状态标签制，证据可复查）

| # | 主张 | 状态 | 证据 |
|---|---|---|---|
| 1 | L3 危险操作在工具执行管线内被程序性拦截（命中→审批询问，宿主侧不可绕过该检查） | **已实现有测试**（正则覆盖 6 域+9 豁免+嵌套 shell 形态） | 单测 8正10负+23例+58误拦样本；真实宿主拦截实录 |
| 2 | 收口验证依据真实退出码而非模型自述（discipline_gate 工具：宿主真跑 cmd，声明与实测不符=打回） | **已实现有测试**（含 E1 中两次打回无效验证的实录） | tests/gate-tool 44 例；E1-v1 报告 §1 |
| 3 | 规则包可替换：改 `content/rules.json` 即改红线，不动引擎代码；无效配置 fail-closed 回退内置默认 | **已实现有测试**（真实宿主自定义域拦截实证） | tests/config-rules 24 例；CHANGELOG v0.3 |
| 4 | 工具预算器：按任务判级裁剪工具面（restrict 掩码），测量以每请求线缆真值为准 | **已实现有测试**（L1 面 -58.6%；同 agent 会话中途收窄实证） | tests/budget 21 例；CHANGELOG v0.4 |
| 5 | 行为遥测与对账：exec-log 全落账，tally `--report/--check` 出数+对账（白名单/不变量/快照，抓植入差错） | **已实现有测试** | tests/tally 16 例（5 类攻击样本全被抓） |
| 6 | 有效性（改善任务结果） | **未证**——E1-v1 机制验证轮 n=1 区分力不足，按预注册矩阵不判有效/无效 | docs/e1-v1-report §4 |
| 7 | 拦截覆盖完备性 | **已知边界**——枚举型正则有天花板：命令形态替换已闭合一例；「目标替代」（用 write 清空代替删除+对偷换目标做真验证）不可在正则层修，指向 v1.x T3 受控执行器/状态机 | docs/e1-v1-report §3 |
| 8 | T3 受控执行器/教训库/跨平台映射 | **规划**（v1.x） | docs/design-specs/dsh-toolification-roadmap |

**诚实条款**：本插件保证「过程可审计、收口有真值」，不保证「模型更聪明」；三命题分立——机制存在（✓v0.1-v0.5）≠机制有效（待补样本轮）≠产品有效（待发行后数据）。

## 安装（开发形态）

DSH profile 的 `cordis.patch.yml` 追加：

```yaml
- insert:
    - id: shisanxinuo-core
      # Windows 绝对路径须用 file:// URL（ESM loader 判定）
      name: 'file:///D:/path/to/dsh-plugin-dev/src/shisan-xinuo-core.ts'
```

正式 bundle 化（`dsh.bundle` manifest）=发行批工作，未做。

## 配置（契约详见 docs/config-contract.md）

- `content/rules.json`：L3 危险域+只读豁免（fail-closed：无效回退内置默认，防护不静默解除）
- `content/discipline.md`：注入的纪律文本
- `content/budget.json`：判级→工具掩码（fail-open：无效不裁剪；纪律五件工具永不裁）
- 环境钩子：`SHISANUO_RULES` / `SHISANUO_DISCIPLINE` / `SHISANUO_BUDGET` / `SHISANUO_BUDGET_LEVEL`
- 实验臂：`tmp/arm-A-observe.flag`（惰性）/ `tmp/arm-B-text.flag`（纯文本）/ 无旗标=全量 C

## 测试与测量

```bash
for f in tests/*.test.mjs test/*.test.mjs; do node "$f"; done   # 9 套单测（无需构建，Node ≥23 直跑 .ts）
node scripts/tally.mjs --report --freeze   # 出数+冻结快照
node scripts/tally.mjs --check             # 对账（exit 1=发现违规）
node scripts/e1-run.mjs                    # E1 三臂实验（免费模型）
```

## 目录

- `src/shisan-xinuo-core.ts` 引擎（单文件：拦截/收口真值/机判/预算/遥测）
- `content/` 规则包（Config 面）｜ `scripts/` tally/e1 ｜ `tests/` 9 套单测
- `docs/` 契约/实验预注册与报告/路线图/发行规划 ｜ `CHANGELOG.md` 版本记录（内部）

## 版本史（详见 CHANGELOG.md）

v0.1 机制雏形 → v0.2 真值闭环（gate 工具）→ v0.3 可修改性（Config 化）→ v0.4 上下文控制（预算器）→ v0.5 判定制度+E1-v1 → **v1.0 工程验收（内部）**。路线=docs/design-specs/release-and-versioning-plan-20261013.md。
