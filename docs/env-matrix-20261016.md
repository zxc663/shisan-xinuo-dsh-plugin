# 三档环境矩阵（批1）· 2026-10-16

> 批1（v5 执行计划）产物：验收底座的三档定义、装置与现状。后续批的 GUI 走查与关键格实验以本矩阵为准（实战档优先、裸档回归、预览线档做兼容）。

## 定义与装置

| 档 | 用途 | 装置 | 状态 |
|---|---|---|---|
| 裸档 | 回归基线（最小组合） | 主 home：`D:\ai本地模型\dsh`（profiles: desktop/headless 等）；CLI `dsh-cli-0.2.0-rc.2` | ✅ 在用 |
| 预览线档 | 新版本兼容（对外兼容宣称的前提） | CLI `dsh-cli-0.2.1-alpha.4`（隔离安装）；home `D:\ai本地模型\dsh-prev-home`；档案 `prev1`（headless 模板） | ✅ 已建＋冒烟过 |
| 实战档 | 代表集插件环境（富目录） | home `D:\ai本地模型\dsh-rich-home`；档案 `rich1`：本插件＋permission-rules@0.7.15＋tool-search@0.1.7＋hooks 桥＋tool-cordis（大目录源）；outcome-loop 暂除（见发现4） | ✅ 已建＋冒烟过 |

## 构建配方（可重跑）

- 预览线 CLI：`mkdir <dir>; npm init -y; npm i @deepseek-ai/dsh@0.2.1-alpha.4`（实测 609 包 / 约 2 分钟）。
- 预览线 home/档案：`$env:DSH_HOME=<home>; node <cli>/lib/bin.js prev1 --from-default-profile headless --dump-config`（合成 378 行 / exit 0）。
- 我方插件探针载荷：`npm run build` → 挂载层 `D:/tmp/prev-ours-overlay.yml`（file:// lib）或本地包 `D:/tmp/prev-ours-pkg`（bundle 清单＋lib/content）。
- 运行弹药（免费档）：`--patch D:/tmp/dshgo-base-overlay.yml --patch D:/tmp/dshgo-step5-overlay.yml` ＋ 环境变量 `OPENCODE_GO_API_KEY`（从主 home 凭据读取，不落盘）。

## 现状证据（预览线）

- `D:\ai本地模型\dsh-prev-home\dump-prev1.txt`（基线合成）、`dump-prev1-ours.txt`（叠挂载层）、`dump-prev1-added.txt`（bundle 安装后）。
- `run-prevok.txt`（首跑：凭据缺失被按预期拦下）、`run-prevok2.txt`（exit 0，回复 `PREVOK`）。
- 详见《预览线兼容矩阵》（`docs/preview-line-compat-20261016.md`）。

## 实战档（rich1）组成与冒烟（2026-10-16）

- 默认集：本插件（本地 bundle 安装）＋`dsh-permission-rules@0.7.15`＋`dsh-tool-search@0.1.7`＋hooks 桥（挂载层＋最小配置）＋`@deepseek-ai/dsh-tool-cordis`（挂载层，大目录源）。
- 标准链：`--patch dshgo-base-overlay.yml --patch dshgo-step5-overlay.yml --patch rich-extra-overlay.yml`（＋运行环境变量取主 home 凭据）。
- 最终冒烟：exit 0，回复 `RICHOK`；遥测：`tools-inventory=35`、**`tools-wire=7 件/3,374 chars`**（大目录下披露件生效，与 A/B 基准一致；对照裸档 28 件/22,668 chars）、`skill-catalog-cost=5,608 chars`。

### 实战档发现（接缝面，全部实测）

1. **官方伴随包也过不了 fail-closed 版本门**（hooks 桥 0.0.1-rc.5、tool-cordis 0.0.1-rc.1 vs 宿主 0.2.0-rc.2）→ 走豁免通道 `allow-version … --accept-risk` 按包按版本放行（流程已实测）。
2. **无 `dsh.bundle` 的包不进 profile 层**（hooks/cordis/storage 三件）→ 安装后需挂载层显式挂行（模板：`rich-extra-overlay.yml` / `rich-storage.yml`）。
3. **hooks 桥 `configPath` 必填**（进程级、加载时解析一次）；缺配置=条目不激活（CLI 报 ValidationError，非静默）。
4. **outcome-loop beta.8 与绑定线代际不兼容**：其自述仅验至 `0.1.0-rc.8/rc.7`；在 `0.2.0-rc.2` 上 boot **宿主侧崩溃**（`Cannot read properties of undefined (reading 'length')`，而非其文档承诺的干净版本拒绝）；按配方补 storage 三件（`storage`/`storage-json`/`storage-domain@0.2.0-rc.2`）后仍崩；从组合中移除后全绿。→ **必查项 #1（0.2.x 线装载）裁定：未过**；默认集暂不含 OL（tgz 留 `D:\tmp\dsh-outcome-loop-0.1.0-beta.8.tgz`，配方留 `rich-storage.yml`），待其 0.2.x 适配后复评。

## 批1 GUI 实机证据（裸档）

- `D:\tmp\goprobe-run\batch1-gui-health.png`：桌面档健康（模型档=免费档 Step5；会话列表含本批三跑）。

