# 宿主兼容矩阵（0.2.1 线）· 2026-10-19

> 用途：两包（运行时治理引擎＋管理后台页面）对 DSH 宿主的**接触面与版本适配**台账；升级/排障先查此表。
> 实测线：0.2.1-rc.2（当前桌面）；历史：0.2.0-rc.1/rc.2。

## 1. 接触面清单

### 1.1 引擎包（shisan-xinuo-dsh-plugin）

| 面 | 用法 | 降级行为 | 证据 |
|---|---|---|---|
| cordis 服务注入 | `ctx.inject(['sessionTitle'/'sessionProjections'/'agentDefaultModel'])` | 服务缺失→回调不触发＝自动降级（headless 型宿主） | p47 测试＋桌面实机 |
| 钩子 | `ctx.on('agent/created'/'tools/pre-execute'/'session/event'/'agent/turn-stopping')` | 缺 hook＝相应强制面静默关闭 | exec-log 全量遥测 |
| 段注册 | `ctx.systemPrompt.section({name,order,text[,complete]})` | 服务不可用→assembly API 503（如实） | `sysprompt-attached` 审计 |
| 注入通道 | `agent.steer`／`agent.inject`（notice 信封 `source.form='notice'`） | 无 agent 句柄→pending 模式下回合送达 | F8/F13 实机 |
| 工具守卫 | `ctx.tools.guard`（单调指纹） | 宿主线 < 0.2.0-rc→跳过（日志声明） | 启动日志 |
| 插件直挂形态 | profile patch insert：`file:///…/src/shisan-xinuo-core.ts`（TS 直挂，node 类型剥离） | 路径必须 file:// URL（裸盘符被判协议） | 桌面/headless patch 实测 |

### 1.2 页面包（dsh-custom）

| 面 | 用法 | 降级行为 | 证据 |
|---|---|---|---|
| client 装载 | `window.__ModuleLoader__.load`（externals：react） | 宿主不提供→页面不挂载（服务端仍可用） | rc.2 实机 |
| 设置入口 | `settings.section` occupant（id `dsh-custom`，order 30） | — | 实机走查 |
| 渲染器解析 | `@deepseek-ai/dsh-system-prompt` 分层解析（host-argv→ctx-baseUrl→loader.internal.resolveSync→模块位置→裸说明符） | 全失败→降级原文＋审计 `renderer-resolve-fail` | 启动审计 |
| 装配数据面 | systemPrompt 服务只读视图 | 服务未就绪→503 | 页面实机 |
| UI token | `--dsw-alias-*`（label/border/bg-layer/bg-base/brand/state-*） | 缺 token→视觉降级（透明底） | 页面实机 |

## 2. 版本矩阵（实测）

| 宿主版本 | 状态 | 证据 |
|---|---|---|
| 0.2.0-rc.1 | 历史（P0 前） | 早期文档 |
| 0.2.0-rc.2 | 主力证据线 | P0/P1 走查、E1-v5（75 会话）、F1–F13 |
| **0.2.1-rc.2（当前桌面）** | 全链在跑 | 2026-10-19 实机：boot/装配/五页/审批链/快照＋手动备份/F10–F14 检测注入/直挂 .ts 装载；含桌面 profile 排障（欢迎认证 Cookies 损坏与「禁用三方插件」副作用恢复，见 agent-log） |
| 0.2.1（正式版，未出） | 观察位 | 升级后复跑 §3 清单 |

## 3. 升级观察清单（升级宿主后必查）

1. boot 五连：rules／discipline／governance／section-fingerprint／self-check 齐＋指纹字节数突变；
2. 装配：`sysprompt-attached` 四段（-2000/-1990/-1980/0）在场；
3. 页面：设置入口「DSH 自定义」＋五页渲染＋assembly 无 503；
4. 渲染器：`renderer-resolve` 审计（策略应优先 host-argv）；失败→查 junction realpath 归一线；
5. 直挂：引擎 `.ts` 若被 loader 拒载→回归 `file://` 形态核验；
6. 回归基线：`npm test` 前 39/39、后 13 文件；E2 试点双样本（C/D × T1）对拍。

## 4. 已知边角

- 宿主官方段名白名单（`VERIFIED_OFFICIAL_SECTIONS`）随版本扩充——新官方段归 `other`，不影响功能；
- 桌面 shell 特有：欢迎认证（Network cookies）断裂会全线拒启＝app 自身层，非插件；
- Windows profile patch 修改后，「禁用三方插件」类恢复动作会剥离挂载（须整档备份，先例见 agent-log 2026-10-19）。
