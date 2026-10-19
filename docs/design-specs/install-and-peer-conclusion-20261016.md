# 安装与 peer 结论（2026-10-16 · 收口执行 v5 批6）

> 目的：把「怎么装、装得上吗、为什么不声明 peer」三件事用**实测**钉住，供对外文档与外部复核引用。

## 一、三种安装形态（全部实测）

| 形态 | 怎么装 | 实测结果 | 证据 |
|---|---|---|---|
| ① `file://` 开发态 | 叠加层 `- insert: { id: shisanxinuo-core, name: 'file://…/src/shisan-xinuo-core.ts' }` | 启动即注册；`self-check` 全绿；收口链完整 | 本会话在裸档/实战档/预览档多处跑通（含 `gate-conclude marked`） |
| ② 目录 bundle | `dsh plugin --profile <p> add <含 dsh.bundle 的目录>` | 无警告安装（409 ms）；`--dump-config` 出现 `- id: shisanxinuo-core` | 干净树 `dsh plugin add <dir>` |
| ③ tgz | `npm run build && npm pack` → `dsh plugin --profile <p> add <tgz>` | 无警告；组合树含插件层；产物 78 KB（含 `lib/`＋`content/`＋`cordis.patch.yml`） | 干净克隆（`git archive HEAD`）打包＋装载 |

> 三形态的共同前提：`package.json` 声明 `dsh.bundle`（否则只装成普通依赖、不挂层——`dsh plugin add` 会显式警告）。

## 二、peer 口径（决策）

- **不声明 `peerDependencies`**：运行时零宿主硬依赖（`cordis` 仅 type-only import，装载期即被剥离）。
- **依据**：宿主 0.2.x 对 peer 声明做 **fail-closed** 检查——实测 `dsh-outcome-loop@0.1.0-beta.8` 因 peer 范围不匹配被**拒装**；无声明即无拒装面。
- **代价（如实）**：宿主版本漂移不会被 peer 检查拦下 ⇒ 兼容检测由**三档环境矩阵**（裸/实战/预览线）与**每批实机走查**承担，而非由包管理器承担。

## 三、上游锁定（装机面）

| 组件 | 锁定版本 | 角色 |
|---|---|---|
| `Letter2025/dsh-tool-search` | `0.1.7` | 工具面披露（按需暴露） |
| `dsh-permission-rules` | `v0.7.15` | 拦截引擎（换芯目标） |
| `dsh-outcome-loop` | `beta.8` | **代际不兼容，已排除**（待上游 0.2.x 适配） |
| `dsh-opencode-session` | `0.1.1` | 会话头注入（GO 反代链路） |

## 四、已知前置与边界

- **`prepack` 已加（2026-10-16）**：干净克隆若**未构建**就直接 `npm pack`，产物不含 `lib/`；已补 `prepack: npm run build`（删 `lib/` 后 `npm pack` 复验：构建自动触发、tarball 含 `lib/shisan-xinuo-core.js`；干净克隆复验见 CHANGELOG）。
- **本地工作树有一处未提交改动**删除了 `dsh.bundle`（**不影响提交态**；本地直接打包会产出非 bundle 包）。
- 兼容性口径：见 [`env-matrix-20261016.md`](../env-matrix-20261016.md) 与 [`preview-line-compat-20261016.md`](../preview-line-compat-20261016.md)（预览线@当前 core 复验通过）。

## 五、复验（2026-10-19，F14/兼容矩阵批）：双包 tgz 全链 ＋ 禁用态实测

- **打包**：`npm pack` 双包——engine `shisan-xinuo-dsh-plugin-1.0.0-rc.1.tgz`（158.6KB：lib＋content 全量＋patch）｜custom `dsh-custom-0.1.0.tgz`（61.2KB：lib＋client.js＋patch）；prepack 构建自动触发。
- **官方安装**（隔离家 `D:\ai本地模型\dsh\itest-home-20261019`，自 headless 模板初始化 `itest` 档）：
  - `dsh plugin --profile itest add <engine.tgz>` → pnpm 682ms 无警告；
  - `dsh plugin --profile itest add <custom.tgz>` → 502ms；profile `dependencies` 落 tgz 引用，`dsh.profile.bundles` 自动追加 `shisan-xinuo-dsh-plugin`＋`dsh-custom`；
  - `--dump-config`：两条目在场（`shisanxinuo-core → …/lib/shisan-xinuo-core.js`；`dsh-custom → dsh-custom/lib/index.js`）。
- **启动实测**：`dsh itest "<trivial 任务>"` → `[dsh-custom] P0 运行时已装载（存储=隔离家新建 10）`＋`[shisan-xinuo] arm=C`／rules source=**安装包内 content/**（valid、11 域）／护栏/工具全注册——安装态与开发态行为一致。
- **禁用态（装而不启用）实测**：`profiles/itest/cordis.patch.yml` 写
  `- id: shisanxinuo-core, disabled: true` ＋ `- id: dsh-custom, disabled: true` → dump-config 保留条目（patched-by 标注）→ 启动**零插件装载行** ✓；恢复＝删两行。三档禁用手段：①本 patch 禁用（实测）②桌面「插件」页开关（plugin-manager UI，同底层机制，未直测——避免动日常档）③插件自身治理开关（总闸/分域/注入，装且启用但静默，粒度最细）。
- 证据留档：隔离家全目录 `D:\ai本地模型\dsh\itest-home-20261019`（含 packs/装配树/两次启动记录）。

## 六、复跑

```bash
git clone https://github.com/zxc663/shisan-xinuo-dsh-plugin && cd shisan-xinuo-dsh-plugin
npm install && npm run build
dsh plugin --profile t  add .                                        # 形态② 目录
npm pack && dsh plugin --profile t2 add ./shisan-xinuo-dsh-plugin-*.tgz   # 形态③ tgz
# 期望：两者都**无** "declares no dsh.bundle" 警告；dsh --profile <p> --dump-config 见 "- id: shisanxinuo-core"
```
