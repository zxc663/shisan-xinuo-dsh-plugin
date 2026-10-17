# 交接文档：「DSH自定义」（dsh-custom）P0 收口移交 · 2026-10-17

> 性质：交接文档（决策：停手并把项目移交用户另开的 DSH 会话；依据：用户当日指令，登记见主仓 `memory/agent-log.md`）。接手方＝用户另开的 DSH 会话。
> 前代理已完成 P0 主体、实测宿主半工作、把插件临时挂进桌面 App；**卡点＝浏览器半（设置页签）未显现＋渲染视图降级**。全部上下文如下，全部路径为绝对路径。

---

## 0. 交接摘要（TL;DR）

- **是什么**：为 DeepSeek Harness（DSH）做的「系统提示词管理」插件：查看实际装配的官方系统提示词、深度自定义（complete 接管）、纪律文本 system 层前置；含「防静默改写」护栏（语义 b：允许模型改存储，但必须经提示/确认并留痕；P0 先交付保守子集＝拦截＋提示＋留痕）。
- **做到哪**：P0 上半（宿主半）**已实测在桌面 App 工作**（启动行/存储落盘/API 200）；单测 43/43 绿。
- **卡在哪**：①插件设置区的「DSH自定义」页签在桌面 App 未出现（浏览器半）；②宿主内 `renderPrompt` 动态导入失败（装配渲染视图降级为原文）。③护栏负向控制（真模型写存储被拒）尚未实测。
- **现场**：插件正挂在用户桌面档（patch insert＋junction），App 运行中——**可供接手方直接迭代实测**；撤除三步见 §6。
- **用户期望**：接手方自行诊断并继续（P0 收口→P1→P2 按设计冻结推进）；有不懂/分歧**先问用户**，不猜着做。

---

## 1. 项目与需求口径（唯一契约＝设计冻结档）

- 设计冻结：`D:\DeepSeek\dsh-plugin-dev\docs\design-specs\dsh-custom-prompt-design-20261017.md`
  - §1 定位（两大能力：管理/深改官方提示词；纪律文本 system 层前置）
  - §2 机制（纪律前置＝外部段 order −2000；深改＝`complete:true`；视图＝公开 `assemble()`＋`renderPrompt()`；热更＝仅真实发送触发的组装生效，改完不推送）
  - §3 页面三区（区一实际提示词只读双视图；区二 complete 深改；区三纪律前置＋AGENTS 共存**信息提示**）
  - §4 护栏（语义 b；改动必提示、必留痕；P0 保守子集；外部编辑＝哈希检测＋留痕）
  - §5 分期验收（P0 判据：视图与宿主 assemble() 实取一致（抽查≥3 会话/2 档位）；改写存储被 guard 拒绝（负向控制）；无 dict 变更时零行为差异）
  - §8 拍板记录（语义 b／P0 立项／默认值：总开关开、complete 关／迁移条款）
- 调研报告（一手，机制证据）：`docs\design-specs\dsh-custom-prompt-research-20261017.md`
- 配置入口惯例：`docs\design-specs\config-entry-research-20261017.md`（＋`config-entry-design-20261017.md`）
- 会话档案（本机、含临时挂载登记）：`D:\DeepSeek\dsh-plugin-dev\memory\agent-log.md`（状态段）

## 2. 代码与验证现状

**项目仓库**：`D:\DeepSeek\dsh-custom`（独立 git，branch `main`，本地仓无远端；MIT）
- `ad548d6` 脚手架（31 测）→ `7b641c6` 数据面＋浏览器半（43 测）。工作树干净。

**文件地图（host 半）`src\index.ts`（tsc → `lib\`）**：
- 存储：`ensureStorage`（`$DSH_HOME/dsh-custom/`：`discipline.md`/`override.md`/`scope.json`/`meta.json`/`backups/`/`audit.jsonl`）；`snapshot`；`hashOfFile`；`detectExternalChanges`（哈希对照→audit `external-change`）
- 护栏：`guardDecision(tool,args,root)` 纯函数（写类工具或写入动词组成命 shell ＋ 目标命中存储 → deny；只读触碰仅留痕）；`apply()` 里 `ctx.on('tools/pre-execute')` 返回 `{kind:'deny', reason}`；命中计数进 status
- 装配读取：`readAssembly(svc)`（`svc.assemble()` → `buildAssemblyView`；归属 `classifySectionName`：`dsh-custom:*`=ours／已验证官方名（`harness:identity`,`deployment:persona`）=official／其余=other）
- HTTP：`makeApi` → `GET /api/dsh-custom/assembly`、`GET /api/dsh-custom/status`；装载时 `ctx.inject(['webServer'])` 注册 `{kind:'prefix', path:'/api/dsh-custom', handler}`
- 服务接入：`ctx.inject(['systemPrompt'], …)` 留住服务句柄

**文件地图（浏览器半）`client.js`**：`window.__ModuleLoader__.load({id:'dsh-custom', factory})`；`exports.inject=['slots']`；`apply(ctx)` 里 `ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({name:'settings.plugins.tab', id:'dsh-custom', order:60, label:()=>'DSH自定义'}, Tab))`；Tab＝React.createElement 直写（只 `require('react')`），fetch 同源 `new URL('api/dsh-custom/', document.baseURI)`，双视图＋归属徽标＋状态页脚

**清单**：`package.json`＝`dsh.bundle.patch`＋`dsh.client:{platform:'web'}`＋`exports{'.':'./lib/index.js','./client':'./client.js','./lib/*':'./lib/*','./package.json':…}`；`cordis.patch.yml`（bundle 形态，名字 `dsh-custom/lib/index.js`——注意桌面档现挂的是裸名 `dsh-custom`，见 §4）

**验证命令**（接手先跑）：
```powershell
cd D:\DeepSeek\dsh-custom
npm run build; if ($?) { npm test }   # 期望 43/43 绿
```

**已在真实桌面宿主实测通过（2026-10-17，证据在 §5 证据目录）**：
- `D:\ai本地模型\dsh\dsh-custom\audit.jsonl` 启动三行：`boot(created:6)`／`sysprompt-attached`／`api-mounted`
- 存储完整落盘；`GET /api/dsh-custom/status` 200（文件哈希/mtime/护栏计数）
- `GET /api/dsh-custom/assembly` 200，实取 **7 段**：`harness:identity`[official]／`deployment:persona-prefix`／`mcp-resource-servers`／`ui:deliverable-file-references`／`harness:source`／`app:web-surface`／`deployment:persona-suffix`；tools=1、contexts=2
- **`rendererAvailable=false`**：宿主内动态 import `@deepseek-ai/dsh-system-prompt` 失败（现源码用 `new Function('s','return import(s)')` 裸 specifier——在宿主 ESM 钩子下未解析；参考解法：走 `ctx.loader.internal.resolveSync`（见 §3 asar 版用法）或解析到绝对路径再 import）

## 3. 卡点与诊断线索（交接主因）

### 3.1 浏览器半页签未出现
- 现象：桌面 App → 侧栏「插件」页＝官方卡片列表，页面**无页签条**（`ui-settings-plugins` 的 section 在有 tab 贡献时应渲染 tab 条，见其 `lib\client.js` `PluginsSettingsSection`/`useTabs`）；我们的「DSH自定义」页签没出现。
- **重要：直探 URL 的方法对本 App 无效**——`http://127.0.0.1:19387/plugins/<name>/client.js` 对**官方包也是 404**（连 `@deepseek-ai/dsh-client-ui-settings-general` 都 404）。
- 版本差异（已一手抽取对比）：App 内置 harness 在 `resources\app.asar` 内（`dsh\node_modules\@deepseek-ai\…`），其 `dsh-client-modules\lib\index.js`＝**41,704 B**，与 CLI/profiles 版（21,120 B）**不同**：
  - App 版：`resolveMeta(loaderName, baseUrl)`；`locatePkgJson`＝先 `ctx.loader.internal.resolveSync`（含 ESM 钩子），再 `nearestPackage`（向上找最近 package.json，按名字断言）——**file:// 与裸包名两种条目都应可定位**；表格按**包名**键；按 **chunk 批响应**伺服 `/plugins/<packageName>/…`；启动清单经 `webserver/index-inject` 注入 index HTML（普通 GET `/` → 401，需 App 窗口上下文）。
  - CLI 版（profiles）：`createRequire(ctx.baseUrl).resolve('<name>/package.json')`——**只认可解析包名**（这是当初 file:// 失败、改 junction＋裸名的原因）。
- 抽取对照件：`D:\tmp\dsh-custom-smoke\asar-client-modules.js`（抽取命令见 §8）。
- 待查嫌疑（接手方按序排查）：
  1. 我们包的行到底进没进 App 的客户端表（需要 App 侧日志或 devtools；App 进程日志位置**未找到**——`%APPDATA%\DeepSeek Harness` 不存在，userData 位置待查）。
  2. 客户端 bundle 是否加载后**运行时报错**（如 App 客户端 ctx 的 `slots` 服务形态差异；console 报错需 devtools/日志）。
  3. 启动清单（index inject）是否包含我们行（graph compose 错误是否被吞——App 版有 `onError` 通道）。
  4. 对照实验建议：给一个**已知可用的第三方 web 客户端半**（如 `@studyzy/dsh-lazy-tools` 或 `dsh-permission-rules`）建最小对照（先勿污染桌面档：可先 junction 到一个测试档 profile 或临时切桌面档验证后撤除），确证 App 对第三方页签的整体行为后再定位我们包差异。

### 3.2 渲染降级（rendererAvailable=false）
- 见 §2 末。修好后「装配全文（渲染）」才可用；未修前 UI 自动降级展示原文（已有兜底）。

### 3.3 未做的验收
- 护栏负向控制：真会话让模型尝试 `Set-Content 'D:\ai本地模型\dsh\dsh-custom\discipline.md' …` → 期望 deny＋`audit.jsonl` 落 `guard-deny`＋status 计数＋1（可用默认免费模型 longcat-2.5-preview-free；用户偏好免费档）。
- 视图一致性抽查（≥3 会话/2 档位）；「关掉即零差异」对照。

## 4. 环境与现场状态（**务必读**）

- **临时挂载＝在效**（登记于主仓 `memory\agent-log.md` 状态段；当前留驻供接手方实测——留驻为该登记条目的决策项）：
  - 桌面档 patch 末尾追加（`D:\ai本地模型\dsh\profiles\desktop\cordis.patch.yml`）：
    ```yaml
    - insert:
        - id: dsh-custom
          name: 'dsh-custom'
    ```
  - 解析链：junction `D:\ai本地模型\dsh\profiles\node_modules\dsh-custom` → `D:\DeepSeek\dsh-custom`（`cmd /c mklink /J`；改 src 后需 `npm run build` 再重启 App）
  - 备份：`cordis.patch.yml.bak-20261017-dshcustom-add`（插入前形态）
- App：`C:\Users\zxc66\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe`（0.2.0-rc.2 桌面版；**当前运行中**）
  - 重启协议：杀全部 `DeepSeek Harness` 进程→启动 exe→等 ~50s
  - App 本地服务端口：动态（现为 `127.0.0.1:19387`）——用 `netstat -ano | findstr LISTENING` 按 App PID 查
  - 存储根（App 侧）：`D:\ai本地模型\dsh\dsh-custom\`（`$DSH_HOME` 用户级环境变量＝`D:\ai本地模型\dsh`）
- 本机 DSH 环境：profiles＝`ab/desktop/headless/web`（共享 `profiles\node_modules`）；CLI＝`node D:\ai本地模型\dsh-cli-0.2.0-rc.2\node_modules\@deepseek-ai\dsh\lib\bin.js`（`dsh <profile>`、`--patch` 叠加、`dsh plugin --profile <name> add/remove`；**desktop 档拒绝 CLI 管理**："managed exclusively by the Electron application"）
- GUI 验证工具（用户常规验证通道）：`D:\DeepSeek\dsh-plugin-dev\scripts\gui-verify\{capture-window.ps1, send-input.ps1}`；协议文档 `docs\gui-verification-protocol-20261013.md`
  - **必须** `powershell -NoProfile -ExecutionPolicy Bypass -File …`（默认策略禁脚本）
  - 铁律：每步先截图核对再动作；坐标＝截图像素＋窗口原点（capture 输出给出 `rect=左,上`）；单动作输入
- 环境坑（今日实测）：PowerShell `$PID` 只读不可作循环变量；`Get-CimInstance Win32_Process` 按 CommandLine 过滤进程；`Start-Process`＋重定向长驻子进程可挂住工具管道（CLI 长驻测试改用 `cmd /c start` 或分段）；`npx.ps1` 被策略拦→用 `npx.cmd`；`@electron/asar extract-file` 路径要**反斜杠**形态
- 我留下的临时物（可删）：`D:\ai本地模型\dsh-smoke-home\`（CLI 冒烟隔离 home）；证据目录 `D:\tmp\dsh-custom-smoke\`（截图 gui-01..04、asar 抽取件、日志）——**建议保留作证据**，删前告知用户

## 5. 撤除步骤（三步——做完才算收口）

1. **撤除动作**：编辑桌面档 `cordis.patch.yml` 删除上引 `- insert:` 段（或还原 `.bak-20261017-dshcustom-add`）；删 junction：`cmd /c rmdir "D:\ai本地模型\dsh\profiles\node_modules\dsh-custom"`（junction 用 rmdir，勿用 del）；重启 App。
2. **复验判据**：`D:\ai本地模型\dsh\dsh-custom\audit.jsonl` 无新 `boot` 行；App 运行正常；「插件」页无残留异常。
3. 主仓 `memory\agent-log.md` 状态段勾销该登记。**注**：存储目录本身可保留（用户数据形态）或询问用户处理。

## 6. 下一步建议（按序）

1. 跑基线：`npm run build && npm test`（43/43）。
2. 诊断 §3.1（先拿 App 日志/devtools/最小对照，再动我们的包）；修 §3.2 渲染导入。
3. 补 P0 验收（§3.3 三项），证据：截图＋`audit.jsonl`＋API 返回。
4. **P1 前**：向用户复核路线裁决（设计 §8.3：复用为先 A vs 自研全栈 B——近邻 `Awoodwhale/dsh-agent-persona` 作机制参照，概念借鉴**不复制代码**，避免 MIT/Apache 许可混同）。
5. P1（纪律前置 order −2000＋开关/作用域/AGENTS 信息提示）→ P2（complete 深改＋干跑校验＋回滚）按设计 §5 表推进。

## 7. 纪律要点（接手 Agent 必守）

- 每轮首产物＝**复述**（收到 X｜理解为 Y｜边界 Z）；不懂/分歧**先问用户**，不猜着做、不默默扩大范围。
- 判级：L1 直接做；L2 记录推进；**L3（密钥/删除/迁移/发布/架构/超预算）先停并问**。破坏性操作先列命令清单等确认。
- 不假实现：未完成/未验证显式标注；空 catch 零容忍（要留痕）；密钥绝不落盘/落对话。
- **一切临时挂载/环境改动**：当场登记「撤除条件／撤除动作／撤除后复验判据」三件，做完复验才算收口。
- 提交：单令牌 scope（禁 `+`）；改完跑验证命令；用户要中文文档。
- 桌面 App＝用户生产环境：窗口操作轻拿轻放（先截图后动作）；不要动用户会话/配置；改环境前问。
- 记录诚实：决策记录「决定｜依据｜影响」，禁代拟用户言论。

## 8. 附录：命令与路径清单

```powershell
# 验证（项目）
cd D:\DeepSeek\dsh-custom; npm run build; if ($?) { npm test }        # 43/43

# 重启 App
Get-Process | Where-Object { $_.ProcessName -match 'DeepSeek' } | Stop-Process -Force
Start-Process 'C:\Users\zxc66\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe'

# 查 App 端口
$ids = @((Get-Process | Where-Object { $_.ProcessName -match 'DeepSeek' }).Id)
netstat -ano | Select-String LISTENING | ForEach-Object { $l=$_.Line.Trim(); if ($ids -contains [int]$l.Split(' ')[-1]) { $l } }

# 测 API
Invoke-RestMethod 'http://127.0.0.1:<port>/api/dsh-custom/status'
Invoke-RestMethod 'http://127.0.0.1:<port>/api/dsh-custom/assembly'

# 截图/输入（先截图后动作）
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\DeepSeek\dsh-plugin-dev\scripts\gui-verify\capture-window.ps1" -Process 'DeepSeek Harness' -Out D:\tmp\shot.png
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\DeepSeek\dsh-plugin-dev\scripts\gui-verify\send-input.ps1" -Op click -X <屏X> -Y <屏Y>

# 抽取 App asar 内文件（反斜杠路径；输出落当前目录）
npx.cmd --yes @electron/asar extract-file "C:\Users\zxc66\AppData\Local\Programs\DeepSeek Harness\resources\app.asar" "dsh\node_modules\@deepseek-ai\dsh-client-modules\lib\index.js"
```

关键路径表：

| 项 | 路径 |
|---|---|
| 插件项目 | `D:\DeepSeek\dsh-custom` |
| 设计冻结／调研 | `D:\DeepSeek\dsh-plugin-dev\docs\design-specs\dsh-custom-prompt-{design,research}-20261017.md` |
| 会话档案（含挂载登记） | `D:\DeepSeek\dsh-plugin-dev\memory\agent-log.md` |
| 桌面档 patch（＋备份） | `D:\ai本地模型\dsh\profiles\desktop\cordis.patch.yml(.bak-20261017-dshcustom-add)` |
| junction | `D:\ai本地模型\dsh\profiles\node_modules\dsh-custom` → 插件项目 |
| 插件存储（App 侧） | `D:\ai本地模型\dsh\dsh-custom\` |
| 证据目录 | `D:\tmp\dsh-custom-smoke\` |
| GUI 工具 | `D:\DeepSeek\dsh-plugin-dev\scripts\gui-verify\` |

---

## 9. 交接提示词（供用户复制到接手会话）

```
你好，接手一个插件项目的 P0 收口任务。先做三件事：①通读交接文档 ②复述你的理解与首批动作 ③有不懂或分歧先问我，不要猜着做。

【任务】DSH「系统提示词管理」插件（项目名 dsh-custom，「DSH自定义」）——查看实际装配的官方系统提示词、深改提示词、纪律文本前置；现处 P0 收口：宿主半已在桌面 App 实测工作，卡点是「浏览器半（设置页签）不出现」和「渲染视图降级」，另有一项护栏负向控制验收未做。

【必读（绝对路径）】
1. 交接文档（全文）：D:\DeepSeek\dsh-plugin-dev\docs\handover-dsh-custom-20261017.md
2. 设计冻结：D:\DeepSeek\dsh-plugin-dev\docs\design-specs\dsh-custom-prompt-design-20261017.md
3. 调研（机制证据）：D:\DeepSeek\dsh-plugin-dev\docs\design-specs\dsh-custom-prompt-research-20261017.md
4. 项目 README/AGENTS：D:\DeepSeek\dsh-custom\README.md、AGENTS.md
5. 本机档案（挂载登记）：D:\DeepSeek\dsh-plugin-dev\memory\agent-log.md 状态段

【现状速览】
- 项目在 D:\DeepSeek\dsh-custom（git，main，本地）；验证命令 npm run build && npm test 期望 43/43 绿
- 插件正临时挂在你的桌面档（patch insert + junction，App 运行中）：宿主半三行齐（audit.jsonl：boot/sysprompt-attached/api-mounted）、API 200——端口自查（netstat 按 App PID）；存储 D:\ai本地模型\dsh\dsh-custom\
- 卡点1：桌面「插件」页无我们页签；注意 /plugins/... 直探 404 对官方包同样如此（探针法对本 App 无效），诊断线索见交接文档 §3.1
- 卡点2：宿主内 renderPrompt 动态导入失败（§3.2）
- 卡点3：护栏负向控制（真模型写存储被拒）未实测（§3.3）

【环境与红线】
- 桌面 App＝我的生产环境：窗口操作先截图再动作（工具与协议见交接文档 §4/§8）；改环境（挂载/卸载/重启）前告诉我
- 任何临时挂载/环境改动：登记「撤除条件/撤除动作/撤除后复验判据」三件，做完复验才算完（撤除步骤在交接文档 §6）
- 不假实现、空 catch 零容忍、密钥不落盘；每步给可复跑命令与证据（截图/日志/API 返回）
- 提交单令牌 scope；文档中文

【第一步】跑基线测试 → 读交接文档 §3 给诊断计划（先问我对不清楚的地方）→ 我确认后动手。
```

（完）
