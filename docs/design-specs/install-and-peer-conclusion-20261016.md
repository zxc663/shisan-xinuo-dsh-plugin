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

## 五、复跑

```bash
git clone https://github.com/zxc663/shisan-xinuo-dsh-plugin && cd shisan-xinuo-dsh-plugin
npm install && npm run build
dsh plugin --profile t  add .                                        # 形态② 目录
npm pack && dsh plugin --profile t2 add ./shisan-xinuo-dsh-plugin-*.tgz   # 形态③ tgz
# 期望：两者都**无** "declares no dsh.bundle" 警告；dsh --profile <p> --dump-config 见 "- id: shisanxinuo-core"
```
