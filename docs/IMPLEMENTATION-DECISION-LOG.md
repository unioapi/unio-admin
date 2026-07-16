# Admin IA 整改 — 实施期自主决策日志

> **用途**：实施 §4 / §6 过程中，凡 **未在 [`ADMIN-IA-PLAN.md`](./ADMIN-IA-PLAN.md) 写死**、由 agent **自行决断** 的选择，**逐条记录于此**，供负责人事后逐项确认。  
> **规则**：不允许因这些项中断整改；先按推荐方案落地，你再在本文件标注确认/修改意见。

---

## 使用说明

| 字段 | 说明 |
|------|------|
| **ID** | 递增序号 `D-001` … |
| **日期** | 决策发生日 |
| **批次** | 如 `CH-B`、`T-2` |
| **问题** | 当时无法向你确认的点 |
| **推荐方案（已采用）** | agent 实际做了什么 |
| **理由** | 为何选此方案 |
| **影响范围** | 文件/模块/API |
| **你的确认** | 留空供你填：`✅` / `❌ 需改` + 备注 |

---

## 决策记录

| ID | 日期 | 批次 | 问题 | 推荐方案（已采用） | 理由 | 影响范围 | 你的确认 |
|----|------|------|------|-------------------|------|----------|----------|
| D-001 | 2026-06-23 | 启动 | P0 还是 P0+P1？ | **B：P0+P1 全做** | 用户确认 | 全 §4 批次 | |
| D-002 | 2026-06-23 | 启动 | Git 分支 | **`mina`** | 用户指定 | unio-admin / unio-gateway | |
| D-003 | 2026-06-23 | 启动 | 环境与沙盒 | 用户停服务；agent 用项目 **`.env`**；**真机**执行，非沙盒 | 用户确认 | 本地 dev | |
| D-004 | 2026-06-23 | 启动 | Admin API 兼容 | **可自由改** DTO/路径，无外部消费者 | 用户确认 | unio-gateway adminapi | |
| D-005 | 2026-06-23 | 启动 | UI 语言与主题 | **全中文**；**明/暗模式均须通过** §6 | 用户确认 | unio-admin 全局 | |
| D-006 | 2026-06-23 | 启动 | 响应式 / 窄屏 | **需要**达标（含 §6 768 抽测及移动端可读） | 用户答「需要」 | 全局 CSS/布局 | |
| D-007 | 2026-06-23 | 启动 | 实施顺序 | **默认**：IA-0→D→CH→PR→MD→RT→CU→QX→SYS→§6 | 用户确认 | §4 | |
| D-008 | 2026-06-23 | 启动 | commit/push 频率 | 分支 `mina`；**每完成 logical 批次 commit**；push/PR **全部完成后**再议（未指定则仅本地 commit） | 用户仅给分支名 | git | |
| D-009 | 2026-06-23 | 规划 | 指标去冗余 P0/P1/P2 是否采纳？ | **全部采纳** → 写入 §1.8 + 各 §3.x 同步修订 | 用户确认「全部采纳」 | ADMIN-IA-PLAN §1.8、§3.1/3.3/3.4/3.5/3.7/3.8 | |
| D-010 | 2026-06-23 | D-A | 计划写 `error_code='gateway_timeout'`，但代码库无此码 | 超时口径改为 **`error_code IN ('upstream_timeout','context_deadline_exceeded') OR error_code ILIKE '%timeout%'`**；统一封装 SQL helper | 真实写入路径用 `upstream_timeout`/`adapter_error`，无 `gateway_timeout` | 所有 ops 聚合 SQL | |
| D-011 | 2026-06-23 | D-A | P95 TTFT 计划用 `response_started_at`，但 gateway 从不写该列（`MarkRequestSucceededParams`/`MarkAttemptSucceededParams` 均无该 setter） | **首版 TTFT 优雅降级**（SQL/服务/前端保留字段，无数据时显示「—」）；**不在本次整改改动 gateway 热路径**补写，backfill 延后单独立项 | 改动流式热路径风险高，违背「一次成功」与「不做破坏性操作」红线；TTFT 为非核心指标 | ops SQL（保留 ttft 列）+ 前端「—」 | |
| D-011a | 2026-06-24 | D-A 后续 | D-011 之后实际补写了 gateway 热路径（`MarkRequestResponseStarted`/`MarkAttemptResponseStarted` + settlement 传 `response_started_at`），TTFT 已转正——但同批改动让 `MarkRequestSucceeded` 误写 `response_completed_at`，违反 `ck_request_records_delivery_completed_at`（仅 `delivery_status='completed'` 才允许非空），导致每次结算撞约束失败、请求卡 `running`、补偿任务全部 `dead` | **修复**：`MarkRequestSucceeded` 不再写 `response_completed_at`（归交付状态机），仅保留 `response_started_at`；重置并重放 36 个 dead 补偿任务恢复结算；E2E 验证流式新请求 TTFT 正确落库、inline 结算闭环 | `response_completed_at` 受交付状态机约束（结算阶段交付未完成），属错误写入点；TTFT(`response_started_at`) 无约束、可安全保留 | sql/queries/request_records.sql、requestlog service/store、gateway/lifecycle/settlement.go、对应 sqlc 生成与测试 | |
| D-011b | 2026-06-24 | §6 T-0 | `go test ./...` 在开发者已 export `DATABASE_URL` / 本地库已同步目录时出现两处假失败：`config.TestMergeDotEnvFile`（环境已有 DATABASE_URL）、`modelcatalog.sync_db_test`（回滚事务内可见 220+ 历史目录条目 → removed=221） | 修测试隔离：dotenv 用例先 `t.Setenv("DATABASE_URL","")`+`Unsetenv` 注册恢复再清除；catalog 用例在回滚事务内先 `DELETE` 三张目录表再 seed | 二者均为测试卫生问题、非产品缺陷；隔离后对 ambient 环境鲁棒，`go test ./...` 干净绿 | config/dotenv_test.go、modelcatalog/sync_db_test.go | |
| D-012 | 2026-06-23 | D-A | 线路归因无快照 | 按 §3.1 就近绑定：`COALESCE(api_keys.route_id, projects.default_route_id, 内置经济)` JOIN | 计划已定就近绑定 | 线路相关 ops SQL | |
| D-013 | 2026-06-24 | D-A | 概览端点形态：扩展 /overview 还是新增 /radar？ | **新增** `/dashboard/radar` + `/dashboard/breakdown` + `/dashboard/timeseries/performance`；保留旧 `/overview`+`/timeseries` 兼容；新 OverviewPage 用新端点；健康/成本趋势复用既有 requests/tokens/cost 时序，仅新增 performance 时序 | D-004 允许破坏；新增更清晰，减少回归面；最小化新增时序查询 | dashboard.go、router.go、dashboard 服务 | |
| D-014 | 2026-06-24 | CH/PR/RT-A | 渠道/服务商/线路 TPS 与 token 无 per-attempt usage | 性能/成功率/延迟按 **attempt 粒度**（request_attempts.channel_id/provider_id）；TPS/token 按 **最终成功渠道归因**（request_records.final_channel_id JOIN usage_records）；线路按就近绑定归因 | usage_records 仅挂 request_record（非 attempt）；最终渠道归因是最合理近似 | channels_ops/providers_ops/routes_ops.sql | |
| D-015 | 2026-06-24 | MD-A | 模型毛利率（USD）多表归因复杂度 | 成本按 `cost_snapshots.model_id` 直接归因；收入按 `ledger_entries(debit) JOIN request_records.requested_model_id` 归因；仅 USD；毛利率 = (收入−成本)/收入（big.Rat 精确） | ledger 有 request_record_id，可精确按模型归因 | models_ops.sql、modelops、opsutil | |
| D-016 | 2026-06-24 | RT/CU-B | 抽屉/行内复用既有 CRUD 对话框需完整领域对象 | 由 ops 行 **构造最小领域对象**（Route/ApiKey/User/Provider/Model）喂给既有对话框；缺失非关键字段填默认值 | 避免每行额外 GET；对话框仅用到 id + 编辑字段 | RouteDetailSheet、ApiKeysPage、各抽屉 | |
| D-017 | 2026-06-24 | RT/MD-A | 「可服务/可售/异常」精确判定（需候选池+健康+价格联算）成本高 | 主表/抽屉派生**近似**：模型可售 = 启用 ∧ 有可用渠道(enabled 绑定+enabled 渠道+enabled 价格)；线路可服务 = 启用 ∧ 非异常(无可用渠道次数>0 或 样本≥20 且成功率<0.9)；精确「样本保护+池有效性」判定延后 P1 | 完整 §3.4.8/§3.5.8 判定 SQL 过重，近似已覆盖主要运营信号 | models_ops/routes_ops 服务派生 | |
| D-018 | 2026-06-24 | QX-B | 请求中心三页（requests/usage/ledger）已有功能页 | **保留既有功能页**，本次仅补**深链贯通**：`/ledger?tab=exceptions`（侧栏+概览行动项）读 URL；`/requests?request_id=`/`?q=` 自动打开证据详情（RequestDetailDialog 增受控模式）；请求 15 列/证据 Sheet 升级、用量 6 卡分析 **延后 P1 polish** | 既有页可用；深链贯通是跨模块一致性的关键；在一次性预算内优先保证导航闭环 | LedgerPage、RequestsPage、RequestDetailDialog | |
| D-019 | 2026-06-24 | SYS-B | §3.11 计划 7 Tab 配置台（运行状态/任务/阈值/计费/同步/审计/诊断）多数无后端 | **保留既有 3 个功能 Tab**（结算补偿任务/同步任务/渠道健康）并补 `?tab=` 深链（`tab=jobs`→补偿任务，概览结算行动项生效）；阈值/计费/审计/诊断配置台 **延后 P1**（需新后端 settings/diagnostics 端点） | 阈值/诊断等无现成后端；既有 3 Tab 覆盖核心运维只读视图；优先保证侧栏+深链可达 | SystemPage | |

---

## 变更索引

| 日期 | 内容 |
|------|------|
| 2026-06-24 | D-011a TTFT 转正 + 结算约束 bug 修复并恢复 36 条卡死请求；D-011b 修两处测试隔离假失败 |
| 2026-06-23 | D-009 指标去冗余全部采纳（§1.8） |
| 2026-06-23 | D-001~D-008 启动确认（P0+P1、分支 mina、真机 .env、API 可破、中英文主题、响应式、实施顺序） |
| 2026-06-23 | 创建日志；与 ADMIN-IA-PLAN 顶部「不允许中断」约定联动 |

---

## 模板（复制追加）

```markdown
### D-XXX · YYYY-MM-DD · {批次}

- **问题**：
- **推荐方案（已采用）**：
- **理由**：
- **影响范围**：
- **你的确认**：
```
