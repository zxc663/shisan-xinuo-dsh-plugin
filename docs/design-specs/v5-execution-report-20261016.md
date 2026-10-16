# 收口执行报告（v5 · 2026-10-16）

> 上位口径：外部工具优先（D4 已裁）｜**信任可传递**（对外结论须"别人能自己重跑"或注明不可复跑原因）｜每批 GUI 实机走查｜对外动作逐项呈批。
> 状态：**执行面已收口**——批1–4 全清；批5/6/7/8 除"待裁四项"外全部落地并实测；未验证清单仅 1 项。本档随裁决滚动更新。

## 1. 逐批状态

| 批 | 内容 | 状态 | 关键证据 |
|---|---|---|---|
| 1 | 任务总表＋测试基建＋三档环境矩阵 | ✅ | 负向控制改坏必红；裸/实战/预览三档建成（`env-matrix-20261016.md`） |
| 2 | 层3/D 四臂实验（门禁批）＋GUI 抽检 | ✅ | 四臂各 20/20、steer=0；H1 支持/H2 代价量化/H3 成立；结果档＋证据入库；**补测真缓存**（见 §2） |
| 3 | 方向 A＋跳过治理 | ✅ | 段指纹/启动自检/判级仅观测/未知工具保守 L2/notice＋三问（通道探针实证） |
| 4 | 方向 B（工具裁剪退役） | ✅ | 运行时裁剪层退役（−241 行）；rich 实测 `tools-wire` 7 件/3,374 chars；170 例回归 0 不一致；发现-解锁-调用闭环 |
| 5 | 方向 C＋小件 | ◐ | gate 降级✅／D2 修复＋**GUI 实机通过**✅／闭环宿主终结缺口修复＋conclude 实机 4/4✅／outcome-loop 限时盒复测✅／**pinned 绕过洞修复**（实机复现→修复→验证）✅；**仅剩：宿主默认判据（待裁）** |
| 6 | 组装形态工程 | ◐ | **安装三形态 3/3 实测✅**（file://／目录 bundle／tgz）＋「安装/peer 结论档」✅；**切包未做**（须改 `package.json`，与"悬置不动"相抵） |
| 7 | 层6 小批 | ◐ | C6 索引机检✅（缺口 27→0）／C7 证据入库✅／B6 上游共享合规向量登记✅／B8 对照 0 不一致✅；**B5 外部锚**缺 tag/release 与对外递交；**层标签口径**待确认 |
| 8 | 发行就绪（准备） | ◐ | 「已知边界与接受风险」节✅／**干净克隆 pack＋装载实测通过✅**／外部锚物料✅；**C8 已修**（`prepack`，2026-10-16 删 `lib/` 复验＋干净克隆复验）；tag/Release 仍冻结待呈批 |
| 9 | 收口报告 | ✅（本档） | 逐批勾稽如上；待裁项见 §4 |

## 2. 三个可计算指标（真值）

- **H1（常量横幅 vs 动态横幅）**：系统段字节 −98.3%（239,340→4,082）；**真缓存命中 91.7%→97.3%（+5.6pt）、未缓存输入 −66%**。
- **H2（tool-search 披露）**：墙钟 +47.5%（564s→832s）；**未缓存输入 +248%、总 token +105%、命中 94.6%→90.9%**；收口无损（20/20、steer=0）。
- **收口基线**：`gate-steer=77`（计划所称基线）；`auto-closeout=12`（占比 5%）——**目标 ≥80% 需"宿主默认判据"，其口径待裁**。
- **D2**：旧形态 5 条 asked→rejected ⇒ 修复后全权档下危险命令**直接放行**（`l3-detected decision=allow-full-access`）、无假「用户拒绝」、文件真删。

## 3. 交付物索引

- 结果/预注册：`layer3-quantification-prereg-20261016.md`、`layer3-quantification-results-20261016.md`（含 §2b 真用量）。
- 装置与兼容：`env-matrix-20261016.md`、`preview-line-compat-20261016.md`（双线@当前 core 复验）。
- 复用决策：`reuse-decision-toolface-20261016.md`（披露让位上游）、`reuse-decision-permission-rules.md`、`reuse-decision-outcome-loop.md`（代际不兼容排除）。
- 对外面：`README.md`（v5 对齐）、`验证库/已知边界与接受风险.md`、`验证库/外部语料-上游合规向量.md`、`docs/external-anchor/`（PR 包/试用指引/反馈模板）、`docs/design-specs/install-and-peer-conclusion-20261016.md`。
- 机检门禁：`scripts/{check-voice,claims-check,tally,check-docs-index,check-md-links}.mjs` 与 28 套 `tests/`；证据 `docs/evidence/layer3-20261016/`。

## 4. 四项已裁与落定（2026-10-16）

| # | 裁决 | 落定动作 | 状态 |
|---|---|---|---|
| 1 | 本地 `package.json` WIP **丢弃** | `git restore package.json`（`dsh.bundle` 回提交态、版本回 `1.0.0-rc.1`）；WIP 副本留 `D:/tmp/probe/package.json.wip-20261016` | 已执行 |
| 2 | 宿主判据＝**严格为主＋物理副作用子集** | 新增窄版默认判据（`observeEffect`／`deriveEffectAssertions`）＋独立记账 `effect-closeout`＋开关 `SHISANUO_EFFECT_ASSERT`；新增 `tests/effect-assert.test.mjs`（31 例），`npm test` 29 套 | 已实现；**指标变化待样本轮实测（未验证）** |
| 3 | 「层标签」＝**矩阵 8/8 ＋ findings 一行口径** | 能力矩阵状态标签全覆盖（不新增逐条打标）；`findings-20261016.md` 顶部加口径声明 | 已执行 |
| 4 | **不对外发布** | tag／Release／SHA256SUMS／外部收录 PR 全部搁置；`docs/external-anchor/` 物料留存不发 | 已执行（物料冻结） |

**与裁决 2 相关的记账纪律**：目标级 `auto-closeout`（有已登记断言才跑）与动作级 `effect-closeout`（仅物理副作用）**分列上报**——批5 的「auto-closeout ≥80%／steer ↓≥50%」目标须指明对哪一列成立；两列相加即是把"动作落地"冒充"目标达成"。

## 5. 复跑（信任可传递）

```bash
npm test                          # 29 套：单测＋公开文本机检＋docs 索引机检＋md 死链机检
node scripts/claims-check.mjs     # 机制级主张（外部可重跑）
node scripts/regression-permission-rules.mjs   # 170 例我方↔上游语义对照，期望 0 不一致
node scripts/check-docs-index.mjs && node scripts/check-md-links.mjs
```

真机/宿主内证据（需宿主与额度，不可外部复跑，已如实标注）：`logs/exec-log.jsonl`、会话日志；四臂聚合已入库 `docs/evidence/layer3-20261016/`。

## 6. 未验证（1 项）

- **三问质询的真实熔断端到端**：notice 通道与三问文案已由探针注入证实；cap 触发的 `skip-notice` 未落到（headless 会话未走到 caps、GUI 触发尝试输入未落框）。cap 判定函数 `shouldSteerNow` 有单测。
