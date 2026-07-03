# 前端 + 接口代码审查（2026-07）

> 目的：在改造「请求记录」列表之前，对 unio-admin 前端与其调用的后端接口做一次体检。
> 本文档只做**问题登记与整改建议**，不含任何代码改动。请逐项在 `审核` 栏勾选：`[ ]` 待定 / `[x]` 认可整改 / `[-]` 不改（保持现状）。
>
> 严重度：`P0` 影响正确性/会报错 · `P1` 明显不合理/高收益重构 · `P2` 一致性/整洁度 · `P3` 小优化。
> 说明栏中 `位置` 均为 `文件:行` 参考，行号以审查当日为准，可能有±数行偏移。

---

## 整改进度（2026-07 全量改造）

> 每批次均通过 `npm run build`（前端）与 `go build ./... + go test`（后端）验证。

- **[x] Batch A 前端基座**：三个 server-table hook 合并为泛型 `useServerTable`（删除 `useOpsServerTable`/`useCustomerServerTable`/`useApiKeysServerTable`）；删除死函数 `formatCompactNumber`/`formatLatency`/`formatMilliseconds`/`formatDate`（D-3/D-4、G-1/2/3）。
- **[x] Batch B 请求/用量改造**：修复排序列 id 与后端白名单不符导致的 400（`user`→`user_id`，禁排序列关闭）；两页接入时间区间过滤；用量行接入「请求详情」弹窗与深链（F-1、F-6 部分、H）。
- **[x] Batch C 标签与阈值**：概览 breakdown 计数列按维度显示「尝试/请求」；`rateIntent` 复用 `SUCCESS_RATE_SLO/WARN`；`formatCompact` 负数按量级紧凑（C-1/2/3、A-3/A-5）。
- **[x] Batch F.1 后端口径（状态口径，无迁移）**：渠道/服务商/模型渠道页/看板 breakdown 的**成功率与健康度分母改为「成功+失败」**（排除 canceled 客户端取消与 running 未终态，与熔断器口径一致）；`recent_error`/错误明细/超时计数限定 `status='failed'`；`last_failure_at` 排除 canceled；系统健康分桶改为合格分母；前端移除「尝试数」展示并改写成功率浮层口径（A-1、B-1、B-6 主体、B-7、B-9、C-4）。**决策记录**：分母口径采用 succeeded/(succeeded+failed)（用户拍板）。
- **[x] Batch F.2 上游归因（迁移，已完成）**：迁移 `000061` 新增 `request_attempts.fault_party` **STORED 生成列**（由 status/error_code/upstream_status_code 派生 upstream/client/platform；新增 STORED 列自动回填历史，且无需改网关热路径）；渠道/服务商/模型渠道页/看板 breakdown 的成功率与健康度分母改为「succeeded + 上游故障失败」（排除平台错误、上游 4xx bad_request）；`recent_error`/`last_failure_at`/系统健康分桶均按 `fault_party='upstream'`；请求详情每条 attempt 展示「上游故障/客户端/平台」归因徽标（B-2/B-3/B-5/B-6）。sqlc + go build + go test 通过。
- **[~] Batch D 前端去重（大部完成）**：
  - **[x] D-1/D-9**：抽出 `components/common/detail-section.tsx`（`SectionFrame`/`SectionEmpty`/`ErrorBox`/`TableSkeleton`/`ChartSkeleton`/`MiniStat`），四个 `*DetailContent.tsx` 不再各自重定义（去重约 240 行）。
  - **[x] D-5**：`fmtTs` 收敛为 `lib/format.formatChartTs`，8 处复制删除。
  - **[x] D-8**：`CreateApiKeyDialog` + `ApiKeyEditDialog` 合并为单个 `ApiKeyFormDialog`（isEdit 分支 + 新建明文态），删两旧文件。
  - **[x] D-10**：抽出 `components/common/StatusBadge.tsx`，替换 9 处启用/停用内联徽标。
  - **[x] D-6**：抽出 `detail-tables/shared-columns.tsx` 的 `requestIdLinkColumn`，四处「请求」链接列复制删除。
  - **[x] D-2**：抽出 `components/common/PerformanceCharts.tsx`（归一化 PerfPoint + 量级/延迟双图 + 三卡），四个 `*DetailContent.tsx` 的 `PerformanceSection` 改为归一化数据后调用（去重约 500 行图表样板）。
  - **[-] D-7**：成功率单元格评估为刻意不同的三种可视化（%+悬浮 tip / 时间线条 / 纯百分比），不合并，保持现状。
- **[x] Batch E 组织**：
  - **[x] E-2**：`ServerDataTable` 统一从 `@/components/openstatus-table` 导入，去掉 `data-table` 交叉 re-export。
  - **[x] E-1**：`ops-tables`→`table-cells` 重命名（`git mv`，11 处 import 已更新）；两个整列模块（`ledger-columns`/`dashboard-errors-columns`）归位到 `detail-tables`，`table-cells` 现只余 2 个共用单元格。tsc 全绿。
  - **[~] E-3**：抽出 `components/dashboard/chart-common.tsx`（`CHART_COLORS`/`fmtBucket`/`StatStrip`/`statIntentClass`/`usePreviousRange`/`SloReferenceLine`/`TipRow`/`ChartState`），`DashboardPage` 1337→1182 行、复用 helper 落地。四个大图组件（`StabilityChart`/`PerformanceChart`/`ProfitChart`/`UsageChart`，~750 行）**未继续外移**：纯手工誊写这段图表 JSX 有引入编译期查不出的「静默视觉回归」（配色/dataKey/label 串写错）风险，剩余外移建议用编辑器剪切粘贴一次性完成，避免逐行重写。
- **[x] Batch G 接口一致性**：
  - **[x] F-2**：`route_id` 后端改非空 `int64`，与前端 `number` 对齐。
  - **[x] F-3/F-4**：删除 12 个死后端接口（GET /providers/{id}、DELETE /channels/{id}、PUT /routes/{id}/channels、catalog-refresh/reminder、GET /users、/users/{id}/ops/keys、/users/{id}/api-keys、/api-keys/{id}、per-key capability PUT/DELETE、/dashboard/overview）——路由 + handler + 相关测试均已移除，vet + test 通过（服务层遗留死方法/DTO 为无害未用代码，可后续清扫）。
  - **[-] F-5**：null 语义/整型宽度（P3），暂保持现状。
- **[x] A-2**：请求级成功率分母排除 canceled（routes/models/customer/radar/timeseries SQL + `error_rate` + 前端 `metrics.requestTerminal`/成功率浮层同步）。
- **[x] A-4**：`profitIntent` 改按毛利率阈值着色（正毛利但毛利率 < 10% → warning）。

> 全部批次已收口。唯一保留项：**E-3** 的四个大图表组件（~750 行）暂留在 `DashboardPage`（共享 helper 已抽出），因手工誊写有静默视觉回归风险，建议用编辑器剪切粘贴完成外移。当前前后端构建 + 测试全绿。

**口径类（A-1 / A-2 / A-4）已在代码落地，不再「等拍板」**：
- **A-2 请求级成功率**：分母 = `succeeded + failed`，**不含 canceled**（`dashboard_radar.sql`、`routes/models/customer_ops.sql`；前端 `metrics.requestTerminal` + `RequestSuccessTip` 同步）。
- **A-4 利润着色**：`profitIntent(margin, revenue)` 按**毛利率**着色，`< 10%` 正毛利 → warning（`PROFIT_THIN_RATE`）；各概览卡已传入 `revenue_usd`。
- **A-1 取消归因**：迁移 `000061` 的 `fault_party` 生成列区分 **client / upstream / platform**；尝试级分母 = `succeeded + 上游故障 failed`，**客户端 cancel 不计入渠道成功率**（回应批注「取消要区分用户还是上游」）。**仍待定**：A-3 阈值入库（系统配置表持久化 SLO/warning 阈值）。

---

## 目录

- A. 计算公式 / 指标口径
- B. 归因与归类错误（我方 / 渠道 / 上游 / 客户端）
- C. 误导性标签（尝试 vs 请求 等）
- D. 组件复用与冗余代码
- E. 代码组织 / 模块划分
- F. 前后端接口一致性（死接口 / 字段漂移 / 排序 400）
- G. 展示工具函数冗余（format.ts）
- H. 「请求记录」改造前置清单
- 附：整改优先级总表

---

## A. 计算公式 / 指标口径

| ID  | 严重 | 问题                                                                                                                                                                                                  | 位置                                                                                                                                                                                                    | 建议                                                                                                     | 审核                                                                                                      |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A-1 | P0   | **渠道/服务商「成功率」分母是全部 attempt（**`COUNT(*)`**）**，包含 `running`（未终态）与 `canceled`（客户端取消）。运行中的尝试、结算卡住的尝试都会拉低成功率。                                      | 后端 `sql/queries/channels_ops.sql:17-18`；`providers_ops.sql:117-118`；前端镜像同口径 `components/channels/ChannelDetailContent.tsx:215-224`、`components/providers/ProviderDetailContent.tsx:216-225` | 分母改为终态尝试 `status IN ('succeeded','failed','canceled')`，与请求级雷达口径对齐；`running` 不计入。 | [x] Batch F.2：`fault_party` + 分母 `succeeded OR fault_party='upstream'`；client cancel 不归渠道                                                                     |
| A-2 | P0   | **请求级成功率 vs 尝试级成功率两套口径并存且都叫「成功率」**。请求级（路由/模型/客户/雷达）= `succeeded/(succeeded+failed+canceled)`；渠道/服务商级 = `succeeded/全部attempt`。同一看板混用，易误读。 | 请求级 `sql/queries/routes_ops.sql:140-141`、`models_ops.sql:54-55`、`customer_ops.sql:11-12`；前端 `components/dashboard/metrics.ts:20-22`                                                             | 口径至少统一「分母是否含未终态/取消」的策略；标签强制区分（见 C-1）。                                    | [x] 请求级分母改 `succeeded+failed`（不含 canceled）；标签见 C-1 |
| A-3 | P1   | `rateIntent()` 内硬编码 `0.95 / 0.8` 阈值，与同文件常量 `SUCCESS_RATE_SLO=0.95` 重复且未复用；阈值散落。                                                                                              | `components/dashboard/metrics.ts:12-18`                                                                                                                                                                 | `rateIntent` 引用 `SUCCESS_RATE_SLO`，并把 warning 阈值也提为常量。                                      | [ 这种判断健不健康的,颜色的, , 或者需要阈值 必须要走系统配置, 然后在数据库持久化, 可以创建一个系统配置表] |
| A-4 | P2   | `profitIntent()` 仅按毛利**绝对值符号**判定红/绿：$0.01 毛利（近乎打平）也显示绿色「success」。                                                                                                       | `components/dashboard/metrics.ts:72-76`；用于 `components/providers/ProviderOverviewStats.tsx`                                                                                                          | 结合毛利率阈值（如 <某%为 warning）判定，或明确文案为「盈亏方向」而非「健康」。                          | [x] `PROFIT_THIN_RATE=0.1`，正毛利但毛利率 <10% → warning |
| A-5 | P2   | `formatCompact()` 对 `n<1000` 直接 `String(n)`，负数不会走紧凑格式（如毛利为负的 `-5000000` 原样输出）。当前多用于计数（非负），但用于金额差值时不安全。                                              | `lib/format.ts:47-54`                                                                                                                                                                                   | 用 `Math.abs(n)` 判断量级，或限定该函数只用于非负计数。                                                  | [ ]                                                                                                       |
| A-6 | P3   | `trimDecimal` 依赖正则 `/\.?0+$/`，对纯整数字符串（无小数点）正确；但对形如 `"1e-7"` 的科学计数不处理。后端为十进制字符串，当前安全，登记备查。                                                       | `lib/format.ts:4-7`                                                                                                                                                                                     | 保持现状；若上游可能出现科学计数需加防护。                                                               | [ ]                                                                                                       |

---

## B. 归因与归类错误（核心：把「我方/客户端问题」算成了「渠道/上游问题」）

> 背景：运行时熔断器 `IsChannelFaultError` 明确**排除**了「客户端取消」和「上游 4xx bad_request」不算渠道故障（`internal/service/gateway/lifecycle/breaker.go:253-278`）。但**管理端统计 SQL 与健康度并没有遵循同一套归因**，导致后台看板对渠道/上游的「甩锅」。

| ID   | 严重   | 问题                                                                                                                                                                                             | 位置                                                                                                                                                                       | 建议                                                                                | 审核 |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| B-1  | P0     | `canceled`**（客户端取消）计入渠道失败**：尝试成功率分母含它，且渠道「错误」列表、`last_failure_at` 也把 canceled 当失败。                                                                       | `sql/queries/channels_ops.sql:216,249,259`；`providers_ops.sql:234,244`                                                                                                    | canceled 从渠道成功率分母与「失败」时间戳中剔除；与熔断器口径一致。                 | [ ]  |
| B-2  | P0     | **平台/配置错误绑到渠道 attempt 上**：如 `adapter_not_registered` 走 `MarkAttemptFailed`，熔断器不计为渠道故障，但管理端统计计入 `attempt_total`/非成功。                                        | `internal/service/gateway/lifecycle/attempt_runner.go:220-221,271-272`；对比 `breaker.go:264-267`                                                                          | 平台故障码不绑定渠道 attempt（或标记为 `skipped`/`canceled`、零健康度影响）。       | [ ]  |
| B-3  | P1     | **上游 4xx（**`bad_request`**，多为客户端入参问题）计入渠道成功率**，熔断器却排除它。                                                                                                            | 4xx→`UpstreamErrorBadRequest`：`internal/core/adapter/openai/chatcompletions/errors.go:146-160`；仍 `MarkAttemptFailed`：`attempt_runner.go:243`；`breaker.go:257,276-277` | `bad_request` 从渠道健康分母剔除，或归到「客户端」类。                              | [ ]  |
| B-4  | P1     | **结算失败导致 attempt 泄漏为** `running`：上游成功但平台结算失败时，只把 request 标 failed，attempt 常留 `running`→拉低渠道成功率（平台错误算到渠道头上）。                                     | `internal/service/gateway/lifecycle/attempt_runner.go:316-317`；`settlement.go:600-648`                                                                                    | 所有退出路径都终结 attempt（`failed`+平台错误码），或统计层排除 `running`。         | [ ]  |
| B-5  | P1     | **缺少「归因方」维度**：`request_attempts`/`request_records` 只存扁平 `error_code`/`status`，无 `fault_party`（client/upstream/platform）。所有 failed/canceled 混在一起，SQL 无法按责任方过滤。 | `migrations/000010_create_request_attempts.up.sql:42-48`；分类仅靠前缀 `failure/code.go:76-85`                                                                             | 落库 `fault_party`，或在 SQL 用 `error_code`+`upstream_status_code`+`status` 派生。 | [ ]  |
| B-6  | P1     | **渠道健康度（healthy/degraded/down）直接用「原始 attempt 成功率」判定**（≥95/≥80 阈值），因此上面 B-1~B-4 的错误归因会直接污染健康度，与熔断器判定不一致。                                      | `internal/service/admin/opsutil/opsutil.go:90-103`；`query/channelhealth.go:72-84`；前端 `components/channels/health.ts:21-27`                                             | 健康度按「上游故障 attempt / 合格 attempt」计算，与 `IsChannelFaultError` 对齐。    | [ ]  |
| B-7  | P2     | `recent_error_code`**（最近错误）不过滤状态**，只要 `error_code IS NOT NULL` 即取，客户端取消 `client_canceled` 会显示成渠道「最近错误」。                                                       | `sql/queries/channels_ops.sql:76-82,150-154`；前端 `components/channels/ChannelOverviewSection.tsx:46-50`                                                                  | 限定 `status='failed'` 且排除 client/platform 码。                                  | [ ]  |
| B-8  | P2     | 「行动项/坏渠道」卡片在 bucket=unhealthy 时提示「检查上游与凭据」，但 bucket 可能由客户端取消驱动，误导排障方向。                                                                                | `internal/service/admin/dashboard/radar.go:532-539`                                                                                                                        | 行动项绑定「上游故障率」而非原始成功率。                                            | [ ]  |
| B-9  | P3     | `timeout_total` 只按 `error_code ILIKE '%timeout%'` 计，不加 `status='failed'` 约束。                                                                                                            | `sql/queries/channels_ops.sql:19,132`                                                                                                                                      | 限定失败态。                                                                        | [ ]  |
| B-10 | ✅参考 | 「Top 错误」面板已正确 `WHERE status='failed'`（排除 canceled），是**正确范式**，建议其它错误列表/`recent_error_code` 复用。                                                                     | `sql/queries/dashboard_radar.sql:116-123`；`components/ops-tables/dashboard-errors-columns.tsx:4-10`                                                                       | 作为统一归因的参照实现。                                                            | [ ]  |

---

## C. 误导性标签（尝试 vs 请求）

| ID  | 严重 | 问题                                                                                          | 位置                                                                                                         | 建议                                                   | 审核 |
| --- | ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ---- |
| C-1 | P1   | 同一看板「成功率」标签，请求级与尝试级**分母不同却同名**，未加粒度后缀。                      | `pages/DashboardPage.tsx:191-192`（请求）vs `components/dashboard/breakdown-table/columns.tsx:68-74`（尝试） | 统一后缀：「请求成功率」/「尝试成功率」。              | [ ]  |
| C-2 | P2   | 概览 breakdown 的服务商/渠道页签「请求」列，底层其实是 **attempt 计数**（非请求数）。         | `components/dashboard/breakdown-table/columns.tsx:131-137`；后端 `dashboard_radar.sql:201,296`               | 服务商/渠道页签列名改「尝试」；模型/路由保留「请求」。 | [ ]  |
| C-3 | P3   | 渠道详情用「尝试数」，dashboard 渠道页签用「请求」，指同一 attempt 量但措辞不一致。           | `components/channels/ChannelOverviewStats.tsx:37` vs `breakdown-table/constants.ts:75`                       | 全站 attempt 粒度统一叫「尝试」。                      | [ ]  |
| C-4 | P3   | `AttemptSuccessTip` 文案称「非成功=其他终态」，但分母含 `running`（非终态），文案与实现不符。 | `components/dashboard/AttemptSuccessTip.tsx:139`                                                             | 随 A-1 修 SQL 后文案自然成立，或先改文案。             | [ ]  |

---

## D. 组件复用与冗余代码

| ID   | 严重 | 问题                                                                                                                                                        | 位置                                                                                                                                                                                  | 建议                                                                                                       | 审核 |
| ---- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| D-1  | P1   | **四个详情页各自本地重定义** `SectionFrame`**/**`SectionEmpty`**/**`ErrorBox`**/**`TableSkeleton`**（各~60 行，几乎一致）**。                               | `ChannelDetailContent.tsx:65-123`、`RouteDetailContent.tsx:62-120`、`ProviderDetailContent.tsx:49-116`、`ModelDetailContent.tsx:49-110`                                               | 抽到 `components/common/detail-section.tsx` 共用。                                                         | [ ]  |
| D-2  | P1   | `PerformanceSection`**（性能图表块）在四个详情页重复~160 行**，是全库最大重复。                                                                             | `ChannelDetailContent.tsx:200-361`、`ProviderDetailContent.tsx:207-355`、`ModelDetailContent.tsx:199-347`、`RouteDetailContent.tsx:178-333`                                           | 抽成参数化 `PerformanceSection`（差异只有 query fn / 指标字段）。                                          | [ ]  |
| D-3  | P1   | **三个 server-table hook 85~90% 重复**。                                                                                                                    | `hooks/useOpsServerTable.ts`、`hooks/useCustomerServerTable.ts`、`hooks/useApiKeysServerTable.ts`                                                                                     | 合并为一个泛型 `useServerTable<T>({ queryKey, fetch, defaultSort, filters?, enabled?, extraQueryKey? })`。 | [ ]  |
| D-4  | P1   | **列表页仍有手写 server-table 状态**（分页/搜索/chips/轮询），未走 hook，与 D-3 同源。                                                                      | `pages/RequestsPage.tsx:44-106`、`pages/UsagePage.tsx`、`pages/LedgerPage.tsx`                                                                                                        | 改造请求记录时顺带并入统一 hook。                                                                          | [ ]  |
| D-5  | P2   | `fmtTs`（4 行）在 **8 处复制粘贴**，未进 `lib/format`。                                                                                                     | `detail-tables/{channel,provider,model,route}-detail-columns.tsx` + 四个 `*DetailContent.tsx`                                                                                         | 提到 `lib/format` 单一实现。                                                                               | [ ]  |
| D-6  | P2   | 渠道/服务商「错误列」列定义 ~90% 重复；`request_id` 截断链接按钮 4 处复制；「指标三连（attempt/成功率/延迟）」多处复制。                                    | `detail-tables/channel-detail-columns.tsx:44-111,98-109,137-163`、`provider-detail-columns.tsx:114-177`、`model-detail-columns.tsx:59-87,143-154`、`route-detail-columns.tsx:170-181` | 抽 `opsErrorColumns()`、`requestIdLinkColumn()`、`metricTripletColumns()` 列构造器。                       | [ ]  |
| D-7  | P2   | **成功率单元格三套实现**：`AttemptSuccessRateCell`（hover+tip）、`ChannelSuccessRateCell`（时间线条）、纯 `formatPercent`。同为「成功率单元格」，职责重叠。 | `components/ops-tables/AttemptSuccessRateCell.tsx`、`components/common/ChannelSuccessRateCell.tsx`、`route-detail-columns.tsx:114-120`                                                | 统一策略；至少收敛成一个可配置组件。                                                                       | [ ]  |
| D-8  | P2   | `CreateApiKeyDialog` 与 `ApiKeyEditDialog` 表单 ~70% 重复（校验/字段块/routes 查询）。其它实体（模型/渠道/服务商/线路）都是**单弹窗** `isEdit` **分支**。   | `components/customer/CreateApiKeyDialog.tsx` vs `ApiKeyEditDialog.tsx`；范式 `ModelFormDialog.tsx:193`                                                                                | 合并为单个 `ApiKeyFormDialog` 走 `isEdit`。                                                                | [ ]  |
| D-9  | P2   | `ChartSkeleton`、`MiniStat` 在多个详情页重复/内联（Channel 内联等价 markup，Model/Provider 各自定义）。                                                     | 四个 `*DetailContent.tsx`                                                                                                                                                             | 随 D-1/D-2 一并抽公共件。                                                                                  | [ ]  |
| D-10 | P3   | `facetedFilter` 定义在 3 个 os-columns 里复制；enabled/disabled Badge 全站内联 15+ 处无共用组件。                                                           | `routes-os-columns.tsx:14-18`、`providers-os-columns.tsx:27-31`、`models-os-columns.tsx:29-33` 等                                                                                     | 抽 `StatusBadge`（enabled/disabled）与 facet 帮助函数。                                                    | [ ]  |

---

## E. 代码组织 / 模块划分

| ID  | 严重 | 问题                                                                                                                                                                                                                                | 位置                                                                 | 建议                                                                                                                          | 审核 |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- |
| E-1 | P1   | **四个表格相关目录职责含糊、命名误导**：`data-table`（原语）、`openstatus-table`（服务端列表壳+列表列定义）、`ops-tables`（其实只有 2 个共用单元格 + 2 个整列模块）、`detail-tables`（详情列定义，但混进了 catalog/dashboard 列）。 | `components/{data-table,openstatus-table,ops-tables,detail-tables}`  | 保留原语/壳分层；重命名 `ops-tables`→`table-cells`；列定义按 `columns/{list,detail,dashboard}` 归置；不建议合并成一个大目录。 | [x] `ops-tables`→`table-cells`；整列模块归位 `detail-tables`；`table-cells` 只余单元格 |
| E-2 | P1   | `ServerDataTable` **双导出路径**：`data-table/index.ts` 又从 `openstatus-table` re-export；列表页从 `openstatus-table` 导入、详情页从 `data-table` 导入，同一组件两套心智模型且形成层次环。                                         | `data-table/index.ts:5-6`、`openstatus-table/index.ts:1-2`           | 定一个公共导入路径，去掉交叉 re-export。                                                                                      | [ ]  |
| E-3 | P1   | `DashboardPage.tsx` **1337 行**，内联定义了 ~~20 个组件（~~`StabilityChart`~~/~~`PerformanceChart`~~/~~`ProfitChart`~~/~~`UsageChart` ~~各 150~~200 行）。                                                                          | `pages/DashboardPage.tsx`                                            | 图表拆到 `components/dashboard/charts/`；页面只做编排。                                                                       | [~] 共享 helper 抽到 `chart-common.tsx`（1337→1182）；四个大图组件外移建议编辑器剪切粘贴，避免手工誊写静默回归 |
| E-4 | P2   | 列定义存在**两套 API 约定**：列表列用裸 `ColumnDef`+`ColumnHeader`，详情列用 `resizableColumn()`。同类指标被定义两遍。                                                                                                              | `openstatus-table/*-os-columns.tsx` vs `detail-tables/*-columns.tsx` | 统一列构造约定（随 E-1/D-6）。                                                                                                | [ ]  |
| E-5 | P2   | `detail-tables/` 是杂物袋：`model-catalog-columns.tsx`（catalog 页）、`dashboard-columns.tsx`（看板雷达）并非「详情页」。                                                                                                           | `detail-tables/model-catalog-columns.tsx`、`dashboard-columns.tsx`   | 按用途移动到 catalog / dashboard 归属处。                                                                                     | [ ]  |

---

## F. 前后端接口一致性

> 路由层整体良好：前端 95 个 API 调用均有对应后端路由，无 404 级错配。以下是排序、死接口与字段漂移。

| ID  | 严重 | 问题                                                                                                                                                         | 位置                                                                                                                                                                                                                                                                               | 建议                                                                                                                                | 审核                                         |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| F-1 | P0   | **排序列 id 与后端白名单不符 → 点击排序会 400**。请求/用量页列 `id:"user"`，后端只认 `user_id`；`request_id`、`input/output/source` 等列可排序但后端不允许。 | 前端 `requests-os-columns.tsx:65-67`、`usage-os-columns.tsx:68-70`；后端 `requests.go:122-128`、`usage.go:58-62`                                                                                                                                                                   | 列 id 与后端 sort 字段对齐（或加映射层）；不支持排序的列 `enableSorting:false`。                                                    | [ ]                                          |
| F-2 | P1   | `route_id` **类型漂移**：前端 `ApiKey.route_id`/`ApiKeyOpsRow.route_id` 为必填 `number`，后端 DTO 为 `*int64`（可空）。                                      | 前端 `apiKeys.ts:14`、`customerOps.ts:63`；后端 `api_keys.go:80`、`customer_ops.go:88`                                                                                                                                                                                             | 统一：若业务恒有值，后端改非空并注释；否则前端改 `number                                                                            | null`。                                      |
| F-3 | P2   | **12 个后端路由前端从未调用**（死/预留接口）。                                                                                                               | 例：`GET /providers/{id}`、`DELETE /channels/{id}`、`PUT /routes/{id}/channels`、`POST /models/{id}/catalog-refresh`、`/catalog-reminder`、`GET /users`、`/users/{id}/ops/keys`、`/api-keys/{id}`、逐条 capability 增删、`GET /dashboard/overview`（`router.go` 对应行见审查报告） | 逐个确认：产品需要→补前端；确认废弃→后端删除或标注 deprecated。`/dashboard/overview` 已被 radar/breakdown 取代，建议标 deprecated。 | [ ]                                          |
| F-4 | P2   | `catalog-refresh` / `catalog-reminder` 后端已实现但前端未接线（模型返回了 `catalog` 状态却无提醒/刷新入口）。                                                | `router.go:248-249`                                                                                                                                                                                                                                                                | 若产品要「目录更新提醒」则补前端；否则删。                                                                                          | [ ]                                          |
| F-5 | P3   | 若干字段 null 语义不一致：`last_test_error`（前端 `string                                                                                                    | null`，后端空串）、路由 ops 的` rpm/tpm/rpd_limit`（`number                                                                                                                                                                                                                        | null`vs`*int32`，CRUD 侧又是` *int64`）、`description`（ops 非空、CRUD` string`）。                                                 | `channelsOps.ts:61`、`routesOps.ts:29-31,27` |
| F-6 | P3   | **过度取数**：请求列表/详情 DTO 拉取大量字段但 UI 只用约 30%（详见 H）。                                                                                     | `requests.ts`、`usage.ts` 与对应列                                                                                                                                                                                                                                                 | 结合请求记录改造，按需裁字段或补列。                                                                                                | [ ]                                          |

---

## G. 展示工具函数冗余（`lib/format.ts`）

| ID  | 严重 | 问题                                                                                                                                                                           | 位置                    | 建议                                                                              | 审核 |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------- | ---- |
| G-1 | P2   | **延迟格式化 4 个并存**：`formatLatencyMs` / `formatLatencySec` / `formatLatency` / `formatMilliseconds`。其中 `formatLatency` 逻辑绕（两次调用 + `!` 非空断言），像历史遗留。 | `lib/format.ts:87-158`  | 收敛为 `formatLatencyMs`(+可选秒)；删 `formatLatency`/评估 `formatMilliseconds`。 | [ ]  |
| G-2 | P2   | **紧凑计数 2 个**：`formatCompact`（Intl compact）与 `formatCompactNumber`（手写 k/M）。                                                                                       | `lib/format.ts:47-66`   | 保留一个（建议 `formatCompact`），另一个改为其别名或删除。                        | [ ]  |
| G-3 | P3   | `formatDate` 注释「保留兼容」，属遗留兼容层。                                                                                                                                  | `lib/format.ts:146-148` | 排查引用后删除。                                                                  | [ ]  |

---

## H. 「请求记录」改造前置清单（下一步专用）

> 结论：请求/用量的 **DTO 字段与后端 struct 基本对齐**（无字段级错配），主要问题是排序、过滤未接线、列展示与取数不匹配、无跨页跳转。改造时一并处理。

1. **排序修复（同 F-1）**：`requests-os-columns` / `usage-os-columns` 的列 id 对齐后端白名单，禁排序列显式关闭。
2. **过滤未接线**：`listRequests` 支持 `apiKeyId/from/to`、`listUsage` 支持 `from/to`，但页面均未提供时间范围/按 Key 过滤 UI。 位置：`requests.ts:89-92,107-110`、`usage.ts:31-34`；`RequestsPage.tsx:64-71`、`UsagePage.tsx:37`。
3. **列展示 vs 取数**：列表只展示约 30% 字段（`request_id/model/status/stream/user/created_at`），却整行拉取 `error_code/error_message/final_channel_id/delivery_status/...`。要么补列，要么裁取数。
4. **用量→请求详情无跳转**：`usage-os-columns` 的 `request_id` 仅文本，建议链接到 `/requests?request_id=`。
5. **手写 server-table 状态**：`RequestsPage`/`UsagePage` 未走统一 hook（同 D-3/D-4），改造时并入。
6. **模型/路由详情里的「请求」页签**用的是各自 ops DTO（`ModelOpsRequest`/`RouteOpsRequest`），与 M6 `/requests` 接口不同形状（`error_code` 仅模型 ops 有）；改造请求记录时注意两套数据源，避免口径再分叉。
7. **归因列**：请求记录是「错误归因」最该落地的地方——建议结合 B-5，在请求/尝试列表暴露 `fault_party`（客户端/上游/平台），避免用户在渠道页看到被误算的失败。

---

## 附：整改优先级总表

### P0（正确性 / 会报错，建议优先）

- A-1 渠道/服务商成功率分母含 running/canceled
- A-2 两套成功率口径同名
- B-1 canceled 计入渠道失败
- B-2 平台错误绑定渠道 attempt
- F-1 排序列 id 与后端不符导致 400

### P1（明显不合理 / 高收益重构）

- A-3 阈值硬编码
- B-3 上游 4xx 计入渠道 / B-4 结算失败致 attempt 泄漏 running / B-5 缺归因维度 / B-6 健康度用错误口径
- C-1 成功率标签未分粒度
- D-1 详情页公共件重复 / D-2 PerformanceSection 重复 / D-3 三 hook 合一 / D-4 列表页手写状态
- E-1 表格四目录治理 / E-2 双导出路径 / E-3 DashboardPage 拆分
- F-2 route_id 类型漂移

### P2 / P3

- A-4/A-5、B-7/B-8/B-9、C-2/C-3/C-4、D-5~~D-10、E-4/E-5、F-3~~F-6、G-1~G-3

---

### 审查产出建议

- 先在本表勾选「认可 / 不改」，我据此拆成可执行的小改动批次（建议顺序：F-1 & 请求记录改造 → B 类归因 → A 类口径 → D/E 重构）。
- B 类归因涉及**产品判断**（canceled/4xx 是否计入渠道口径、是否加 `fault_party` 落库），需你先拍板口径，再动代码与迁移。
