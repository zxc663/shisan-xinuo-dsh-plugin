# 插件配置入口惯例调研（DSH 生态）· 2026-10-17

> 性质：**一手调研报告**（材料来源=本机实装包/官方 asar/目录数据/gh API 直查；检索时为快照）。回答：「本插件的用户配置入口应放哪、怎么放、生态惯例是什么」。
> 背景：现状配置全靠文件与环境变量（`content/rules.json`、`content/discipline.md`、`cordis.patch.yml`、`SHISANUO_*`），无任何界面入口——这是登记在案的「双调研缺口 / D5 未设计」欠账，本档为补课。

## 1. 生态全景（一手实测）

| 面 | 事实（检索于 2026-10-17） |
|---|---|
| 官方宿主 | `deepseek-ai/deepseek-harness`——「Everything is a Plugin」；桌面/CLI/Web 三线 |
| 精选目录 | `awesome-dsh-plugin/awesome-dsh-plugin`：**1000 条**（`data/plugins/<owner>__<repo>.yml` 每条一档，README 由脚本生成）；**23 个分类**（`agi ui usage theme model identity session memory tools wsl browser vision voice docs skill workflow git notify dev security remote market fun`） |
| 插件市场 | `dsh-market/dsh-market`（npm `dshmarket`）：**设置 → 插件市场**，浏览/搜索/一键安装；自称 **4200+ 社区插件**；含主题 Tab、诊断页、备份恢复、更新 API；安装源限定精选目录 |
| 分发聚合 | `zhu1090093659/dsh-web`（创意工坊）、`anywhere-labs/dsh-desktop`、`dataelement/dsh-desktop` 等 |
| 我方位置 | 未投稿（对外动作冻结）；`dsh.bundle` 已声明（**目录投稿的必需字段**，见 §4） |

## 2. 插件配置入口的三个代际（机制一手证据）

### 代际 A：文件约定（我方现状所在）
上游 `dsh-permission-rules` 走 `rules.yaml`（可被会话 cwd 发现）——文件即入口，适合高级用户/自动化，但无发现性。

### 代际 B：client 半 + 注册式设置卡（官方与第三方主流，**我方宿主 0.2.0-rc.2 线可用**）
- **官方形态**（`dsh-client-ui-settings-agent-loop` 等一组）：插件=宿主半（可空 `apply`）＋**浏览器半**；侧栏「插件」→ 官方分组 → 卡片 → 设置页。机制：`ctx.configForms.get` 绑定配置命名空间 ＋ `ui-primitives` 的 `SettingsForm/SettingsValueField` 暂存表单 ＋ `ctx.configForms.whileServed` 把卡片注册进**插件页 `plugins.item` slot**。
- **第三方同型实装**：`@studyzy/dsh-lazy-tools`——`package.json` 声明 `exports["./client"]` ＋ `dsh.client.platform=web`；`lib/client.js` 经 `window.__ModuleLoader__.load({id, factory:(require)=>{…}})` 载入，**只依赖宿主提供的 externals**；「Staged form over the plugin's settings namespace … writes are staged until the user saves, matching every other settings page」。实测该包 peer 精确钉本机 DSH 0.2.0-rc.2 可装。
- **治理向竞品**：`dsh-permissions`（security）同型——`dsh.client.platform=web` ＋ `./client` 导出；其条目自述「**可视化草稿式编辑器**」。

### 代际 C：宿主从 Config schema 自动派生（更新宿主线口径）
`dsh-market` README 原文（关键引文）：「**On dsh 0.1.7 and newer there is no switch to flip: the host derives a plugin's settings from its own Config schema and no longer serves a plugin-registered settings namespace**」——插件只声明 Config schema，设置界面由宿主自动渲染（插件无需自带浏览器半）。

### 写回机制（各代际共用）
`@deepseek-ai/dsh-config-editor`：「将插件配置保存到当前 profile 的 patch 并立即应用……**在改动磁盘前验证完整候选值**……**保留替换值以外的 YAML 注释和 `!!js` 表达式**……应用失败时恢复之前的文档」。

### UX 五惯例（官方卡片 README 明示的交互契约）
①暂存输入、**只在保存时写入**；②被覆盖的值带「已覆盖」标签＋「恢复默认」；③离开页面丢弃草稿；④非法输入**阻止保存**并在字段下说明原因；⑤值按部署默认与用户覆盖分层展示。

## 3. 治理向竞品抽样（精选目录内命中 13 条中的 5 条）

| 插件 | 分类 | 形态要点 |
|---|---|---|
| `863683348/dsh-plugin-verify` | dev | 证据化声明核查（工作区文件+行号引用）、配置校验、提交就绪度探测——**与 `discipline_gate` 判据域最近邻** |
| `263311487-ux/dsh-verify` | browser | JSON 规格进→真实 Chromium 验收结论出（独立验收器思路） |
| `940842546/dsh-permissions` | security | four-tier 规则引擎 + **可视化草稿式编辑器**（client 半实装） |
| `23swccp/dsh-undo` | session | /undo 时间轴 + 会话头按钮 + 消息图标 + 影子 Git 快照（深度 UI 集成） |
| `030611/qiushi-dsh-evidence-audit` | security | 本地哈希链 receipt（工具结果/会话事件），不存正文——**与 exec-log 审计域同族** |

其余命中（未抽验）：`auditrail`、`dsh-plugin-audit`、`sentinel`×2、`compat-guardian`、`pr-guardian`、`shadow-auditor`、`dsh-sidebar-git-graph` 等。

## 4. 目录投稿规范要点（对我们的直接影响）

- 投稿=**一个 yml 文件**（`data/plugins/<owner>__<repo>.yml`）；`description.en` 必填、zh 可选；README 自动生成。
- **`dsh.bundle.patch` 为收录必需字段**——我方已声明 ✓；带浏览器 UI 才需 `dsh.client.platform=web`。
- 仓库创建满 1 天；npm 发布优先（免构建授权），否则 Release tarball + 可选 `tarball:` 字段。
- **peer 预发布陷阱**（原文）：不带显式预发布分支的 peer 范围会**静默排除** harness 的预发布构建——与本仓《安装/peer 结论档》「不声明 peerDependencies」的决策互相印证（不声明=不踩坑）。
- 分类会随生态长大拆分/改名（不因分类打回）；「收插件不收聚合包」；主题类自动进入市场主题 Tab。

## 5. 结论（对入口问题的回答）

1. **入口位置惯例**＝侧栏「插件」页 → 插件卡片（社区分组）→ 设置页；消费习惯是"点卡片"，不是翻 YAML。
2. **实现路径二选一（按宿主代际）**：B＝client 半（`configForms`＋`plugins.item` 卡）；C＝只声明 Config schema 由宿主派生。**UX 契约两者相同**（§2 五惯例）。
3. **我方差距清单**：无浏览器半；未用 `configForms`/schema 派生；配置全靠文件+env（无发现性、无校验反馈、无「恢复默认」）。
4. **我方已对齐项**：`dsh.bundle` 已声明；安装三形态已实测；peer 不声明决策与生态规范相容。
5. 具体设计（放哪几张卡、每张卡做什么、分期与验收）见配套设计档：`docs/design-specs/config-entry-design-20261017.md`。

## 6. 复跑（信任可传递）

```bash
gh api "search/repositories?q=dsh-plugin&sort=stars&per_page=30"          # 生态面
gh api "repos/awesome-dsh-plugin/awesome-dsh-plugin/contents/data/plugins" --jq ".[].name"  # 1000 条目录
gh api "repos/awesome-dsh-plugin/awesome-dsh-plugin/contents/contributing.md"             # 投稿规范
gh api "repos/940842546/dsh-permissions/contents/package.json"                            # 竞品 client 半声明
# 本机一手：@studyzy/dsh-lazy-tools tarball 内 lib/client.js；@deepseek-ai/dsh-client-ui-settings-* 与 dsh-config-editor README
```

## 7. 边界（如实）

- 抽样深度=目录级全量 + 5 个竞品条目/包级抽验；**未逐仓审计**其余 8 个命中。
- 星标/数量为检索快照；分类会变动。
- 本档不改变任何发布冻结决定（对外动作仍逐项批）。
