# GUI 验证口径（常驻）· 2026-10-13

> 2026-10-13 口径：**真机验证走 GUI**；**验证会话固定免费模型**；GUI 自动化**常驻授权**。本档=该口径的落档与操作规程；口径变更或撤回时更新本档并留痕。

## 1. 三项常驻决定

| # | 决定 | 落点/现状 |
|---|---|---|
| 1 | **默认真机验证通道=桌面 GUI**（DeepSeek Harness 桌面 App）；headless 降为辅助（批量/离线对照，如离线双引擎回归） | 装置见 §2；首个完整用例=`b3b` 报告 §5b |
| 2 | **验证会话模型固定=免费档**（当前=zhipu-cloud/`glm-4.5-flash`；air 资源包耗尽后口径即 flash） | 桌面档 `agent-default-model` 已=flash；验证会话不得切付费模型 |
| 3 | **GUI 自动化常驻授权**（发送指令、审批卡「允许一次/拒绝」应答均含在内）——限定：仅验证用途、仅测试夹具/项目内文件、标准模式会话；**范围外**（非验证目的的破坏性/系统级/GUI 外操作）仍需单独确认；授权撤回即失效（重开条件） | 自动化工具=`scripts/gui-verify/`（本机兜底）；正式 computer-use 通道未启用（js_repl 关/cua_repl 停） |

## 2. 装置（桌面档 dev-mount，可逆）

1. 桌面档 `{DSH_HOME}/profiles/desktop/cordis.patch.yml` 增 patch 层 insert（模板见下）；改前先备份 `*.bak-YYYYmmdd-HHmmss`。
2. 重启 App 挂载；挂载旁证=应用进程新增本地监听端口（插件内置代理）＋exec-log 落 `arm=C`/`rules valid=true`。
3. 会话须**标准模式**（完全权限会话 L3 按设计退位、不出审批卡）；工作区任意（可用绝对 `rulesFile` 指向夹具规则文件）。
4. 撤除：删 insert → 重启 → 旁证端口消失。
5. **临时 insert 必须登记撤除项**（撤除条件／撤除动作／撤除后复验判据），三件写在同一处；撤除后按 §5.3 验收。历史事故（未撤除 → 会话拒载）见 §5.3。

```yaml
- insert:
    - id: permission-rules
      name: 'file:///<permtest 档已装包>/node_modules/dsh-permission-rules/lib/index.js'
      config:
        patternMode: regex
        builtin: { enabled: false }     # v0.7.15 glob 基线在 regex 模式编译失败致整条目失活
        # rulesFile: D:/path/.dsh/rules.yaml   # 省略=按会话 cwd 发现 .dsh/rules.yaml
```

## 3. 自动化工具（本机兜底：GDI 截屏＋SendInput）

- `scripts/gui-verify/capture-window.ps1`：DPI 感知窗口截屏（PrintWindow，遮挡可用）。
- `scripts/gui-verify/send-input.ps1`：坐标点击/移动、剪贴板粘贴（中文安全）、按键（`{ENTER}` 等）。
- 铁律：每个交互步**先截屏核对再行动**；元素定位以最新截图为准；异常即停并留证。

## 4. 两轮模板 ＋ 三路取证

- **轮 1（允许一次→真执行）**：发送危险域指令（目标=夹具）→ 卡面理由应=规则文案 → 点【允许一次】→ 期望=命令真执行、断言收口 PASS。
- **轮 2（拒绝→阻断）**：同域指令 → 点【拒绝】（模型重试则再拒）→ 期望=目标保留、收口强制 steer、如实报告。
- **三路取证**：①截图（卡面/结果）；②`logs/exec-log.jsonl`（`l3-intercept`/`upstream-block(ask)`/`auto-closeout`/`gate-steer`）；③会话日志 `approval/asked→decided`（dsh home `sessions/**/session.v*.jsonl.zstd`，解压：`python -c "import zstandard,io; …stream_reader…"`）。文件真相（`Test-Path`）兜底。

## 5. 边界与注意

- 完全权限会话：L3 退位（既定设计）——**验证必用标准模式**。
- 审批 seam 事件（`asked/decided`）是 GUI 面最强机证；headless 的 fail-closed **不等价**于 GUI 应答链（无真实应答者）。
- 本机兜底 ≠ computer-use 正式通道；正式通道可用后可平移（口径不变）。

### 5.1 切换权限档位（2026-10-16 实测通过；供后续走查照做）

**口径：用 `/permission` 命令切档，不要猜坐标。**

1. 点输入框（欢迎页 ≈ 屏幕 `(1000,732)`）→ `^a` 清空 → 粘贴 `**/permission**` → `{ENTER}`。
2. 选择器弹出，列表项（实测 bitmap 坐标，加窗口偏移 `(110,68)` 得屏幕）：**「完全权限」在 bitmap ≈(764,705) → 屏幕 (917,783)**（同屏另有「工作区内修改」等项；OCR 会把中文逐字拆开成 `． 完 全 权 限`，**按单字过滤**）。
3. 点该项 → 弹**风险确认框**：勾选框（bitmap ≈(677,671) → 屏幕 `(787,739)`，「我已了解风险，并愿意继续」）→ 点**「启用完全权限」**（bitmap ≈(1100,747) → 屏幕 `(1210,815)`）。
4. **成功判据（机器证据，别只看界面）**：`logs/exec-log.jsonl` 落 `{"kind":"sandbox-mode","mode":"danger-full-access","enforcement":"suspended"}`，且紧接着 `section-fingerprint … changed:"sandbox-mode"`（段指纹按设计重定基）。

**已踩的坑（别再踩）**：
- 顶栏的「**标准模式**」**不是**档位控件（点它无菜单）。
- 输入框区的 `@ 工作区内修改` 是**输入提示**（同类还有 `@ 1轮1步`），**不是**档位控件。
- WinRT OCR 会把中文**逐字拆开**（`工 作 区 内 修 改`）⇒ **按单字/归一化后匹配**，别用连续子串；`Words.Count` 在投影下可能报错（先转数组/反向索引）；`BoundingRect` 别用 `[int]` 强转（用 `.ToString()`）。

### 5.2 用环境变量驱动桌面档实验（2026-10-16 属实）

- **桌面 App 的插件宿主继承 `Start-Process` 传入的环境变量**——实测：`Start-Process '…\DeepSeek Harness.exe' -Environment @{ SHISANUO_STEER_CAP='1'; SHISANUO_ASSERTIONS='exists:…' }` 启动后，exec-log 落 `{"kind":"pinned","count":1,…}` ⇒ 在 GUI 里也能跑"环境门控"的实验（熔断上限、钉死断言等），不必另写脚本。
- **未完成**：借该能力在 GUI 触发「熔断跳过→notice＋三问质询」的尝试**未成功**（输入未能落到输入框；恢复会话页与欢迎页的 composer 坐标需先 OCR 取该行 rect）。该路径的 `skip-notice` 仍待补。
### 5.3 会话拒载事故与修复（2026-10-16）

**症状**：桌面 App 选中某会话即红字 `resume failed for session "session-9f9569ae-…": SessionQueryError … contains event type "permissionRules/decision" (seq 26) unknown to this harness and not marked ignorable; refusing to interpret the log … (gateway/internal)`。

**根因（三段，均有原文/实测）**：

1. §2 的 dev-mount 把 `permission-rules` 临时直挂进**桌面档**；该类插件会向会话日志追加审计行 `permissionRules/decision`。
2. 桌面宿主**无法为新事件类型打 `ignorable` 标记**——宿主 asar 内自带说明原文：“Readers accept an unknown stored event only when its envelope carries `ignorable: true`, and live `Session.append()` cannot set that marker”；插件侧对宿主能力有探测（`probeAuditResult`），探测到不支持后**自行停用会话日志审计** ⇒ 每个受影响会话恰好只留 **1 行**未标记审计行（18 会话 × 1 行 ＝ 扫描命中 18 行，数目自洽）。
3. 宿主读路径对“未知类型 ＋ 无 `ignorable` 标记”的行**拒载整条日志** ⇒ 该会话不可 resume（不是显示层问题，删 insert 也不会自动复原已写坏的历史）。

**修复（三步，可重跑）**：

```powershell
# ① 撤除临时直挂（先备份），只删 insert 中的 permission-rules 项，原地留历史注释
Copy-Item <DSH_HOME>\profiles\desktop\cordis.patch.yml <DSH_HOME>\profiles\desktop\cordis.patch.yml.bak-YYYYmmdd-<用途>
# ② 给历史日志补标记（上游自带脚本；逐文件 .bak-<epoch> 备份，只给目标行加 ignorable:true）
node <上游包>\scripts\repair-session-logs.mjs scan   --home <DSH_HOME>   # 只读体检（实测：130 档 / 18 受影响 / 18 行）
node <上游包>\scripts\repair-session-logs.mjs repair --home <DSH_HOME>   # 实修（18/18，复扫 0）
# ③ 重启 App 后按下方判据验收
```

**验收判据（三源，缺一不可）**：①`scan` 复跑 `0 affected`；②GUI 截图该会话正常渲染、无红字；③**机器证据**＝该会话日志 mtime 在重启后前进并追加宿主原生行 `session/end-seed`（实测 `12:51:33`）⇒ 证明“被真加载并续写”，而非界面假象。

**新增铁律 · 临时 insert 撤除清单**：任何 dev-mount / 临时 insert 落地时，**同一处**必须写全三件——①撤除条件（何时算测完）②撤除动作（删哪几行）③撤除后复验判据（重启 ＋ 取哪条机证）。事故复盘：本次①写在注释里、②从未执行；且红字在早期 OCR 截图中出现过，被误判为“与本次无关”而放过——**截图里出现的告警默认按缺陷回溯，不得凭关联性判断放过**。

**副作用记录**：修好重启后，App 在 `12:52:11` 把桌面档 `agent-default-model` 写成 `dsh-go / longcat-2.5-preview-free`（文件 mtime ＋ composer 显示双证；非本次手工改动，未查明写入方，疑为 App 侧模型选择持久化）。该值符合“免费档优先”口径，故保留。**注意：桌面档 patch 会被 App 侧改写，验证类改动前先备份、改后核对 diff。**
