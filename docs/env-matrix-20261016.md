# 三档环境矩阵（批1）· 2026-10-16

> 批1（v5 执行计划）产物：验收底座的三档定义、装置与现状。后续批的 GUI 走查与关键格实验以本矩阵为准（实战档优先、裸档回归、预览线档做兼容）。

## 定义与装置

| 档 | 用途 | 装置 | 状态 |
|---|---|---|---|
| 裸档 | 回归基线（最小组合） | 主 home：`D:\ai本地模型\dsh`（profiles: desktop/headless 等）；CLI `dsh-cli-0.2.0-rc.2` | ✅ 在用 |
| 预览线档 | 新版本兼容（对外兼容宣称的前提） | CLI `dsh-cli-0.2.1-alpha.4`（隔离安装）；home `D:\ai本地模型\dsh-prev-home`；档案 `prev1`（headless 模板） | ✅ 已建＋冒烟过 |
| 实战档 | 代表集插件环境（富目录） | home `D:\ai本地模型\dsh-rich-home`（计划）：permission-rules＋tool-search＋hooks 桥＋outcome-loop＋1 MCP/大目录源 | ⬜ 构建中 |

## 构建配方（可重跑）

- 预览线 CLI：`mkdir <dir>; npm init -y; npm i @deepseek-ai/dsh@0.2.1-alpha.4`（实测 609 包 / 约 2 分钟）。
- 预览线 home/档案：`$env:DSH_HOME=<home>; node <cli>/lib/bin.js prev1 --from-default-profile headless --dump-config`（合成 378 行 / exit 0）。
- 我方插件探针载荷：`npm run build` → 挂载层 `D:/tmp/prev-ours-overlay.yml`（file:// lib）或本地包 `D:/tmp/prev-ours-pkg`（bundle 清单＋lib/content）。
- 运行弹药（免费档）：`--patch D:/tmp/dshgo-base-overlay.yml --patch D:/tmp/dshgo-step5-overlay.yml` ＋ 环境变量 `OPENCODE_GO_API_KEY`（从主 home 凭据读取，不落盘）。

## 现状证据（预览线）

- `D:\ai本地模型\dsh-prev-home\dump-prev1.txt`（基线合成）、`dump-prev1-ours.txt`（叠挂载层）、`dump-prev1-added.txt`（bundle 安装后）。
- `run-prevok.txt`（首跑：凭据缺失被按预期拦下）、`run-prevok2.txt`（exit 0，回复 `PREVOK`）。
- 详见《预览线兼容矩阵》（`docs/preview-line-compat-20261016.md`）。

