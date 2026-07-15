import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { listChannelModels } from "@/lib/api/channelModels";
import { listChannelCostMultipliers } from "@/lib/api/channelCostMultipliers";
import {
  listChannelRechargeFactors,
  pickCurrentChannelRechargeFactor,
} from "@/lib/api/channelRechargeFactors";
import { listChannelPrices } from "@/lib/api/channelPrices";
import { listModelPrices } from "@/lib/api/modelPrices";
import type { ChannelOpsRow } from "@/lib/api/channelsOps";
import { getChannelOpsRoutes } from "@/lib/api/channelsOps";
import { resolveChannelIOCost } from "@/lib/billing/resolveChannelCost";
import {
  ChannelLastTestCell,
  channelLastTestAutoSizeLabel,
} from "@/components/channels/ChannelLastTest";
import { ChannelCircuitBreakerBadge } from "@/components/channels/ChannelCircuitBreakerBadge";
import { RateLimitSummaryCell } from "@/components/rate-limit/RateLimitSummaryCell";
import { ChannelRowActions } from "@/components/channels/ChannelRowActions";
import { SecretCopyCell } from "@/components/common/SecretCopyCell";
import {
  formatDateTime,
  formatInt,
  formatLatencyMs,
  trimDecimal,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";
import { formatRouteRatioInput } from "@/components/routes/route-pricing";
import type { FacetOption } from "./types";

/** 渠道状态筛选项（与 channels_status_check 一致：含归档）。 */
export const CHANNEL_STATUS_OPTIONS: FacetOption[] = [
  { value: "enabled", label: "启用" },
  { value: "disabled", label: "停用" },
  { value: "archived", label: "已归档" },
];

export const CHANNEL_OS_COLUMN_LABELS: Record<string, string> = {
  name: "渠道",
  status: "状态",
  credential_valid: "凭据状态",
  protocol_adapter: "协议/Adapter",
  credential: "凭证",
  multipliers: "倍率",
  rate_limit: "限流",
  bound_models: "模型",
  bound_routes: "线路",
  timeout: "超时",
  last_test: "检测",
  created_at: "创建时间",
  action: "操作",
};

function BoundModelsCell({
  channelId,
  boundModels,
}: {
  channelId: number;
  boundModels: number;
}) {
  const [open, setOpen] = useState(false);
  const modelsQuery = useQuery({
    queryKey: ["channel-models", channelId],
    queryFn: () => listChannelModels(channelId),
    enabled: open,
  });
  const pricesQuery = useQuery({
    queryKey: ["channel-prices", channelId],
    queryFn: () => listChannelPrices(channelId),
    enabled: open,
  });
  const multipliersQuery = useQuery({
    queryKey: ["channel-cost-multipliers", channelId],
    queryFn: () => listChannelCostMultipliers(channelId),
    enabled: open,
  });
  const factorsQuery = useQuery({
    queryKey: ["channel-recharge-factors", channelId],
    queryFn: () => listChannelRechargeFactors(channelId),
    enabled: open,
  });

  const models = modelsQuery.data ?? [];
  const prices = pricesQuery.data ?? [];
  const multipliers = multipliersQuery.data ?? [];
  const recharge = pickCurrentChannelRechargeFactor(factorsQuery.data ?? []);

  const modelPriceQueries = useQueries({
    queries: models.map((m) => ({
      queryKey: ["model-prices", m.model_id],
      queryFn: () => listModelPrices(m.model_id),
      enabled: open && models.length > 0,
    })),
  });

  const loading =
    modelsQuery.isPending ||
    pricesQuery.isPending ||
    multipliersQuery.isPending ||
    factorsQuery.isPending ||
    (models.length > 0 && modelPriceQueries.some((q) => q.isPending));
  const failed =
    modelsQuery.isError ||
    pricesQuery.isError ||
    multipliersQuery.isError ||
    factorsQuery.isError ||
    modelPriceQueries.some((q) => q.isError);

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={120}
      closeDelay={80}
    >
      <HoverCardTrigger asChild>
        <span
          className={cn(
            "tabular-nums",
            "cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
          )}
        >
          {formatInt(boundModels)}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-96">
        {loading ? (
          <p className="text-muted-foreground text-xs">加载绑定模型…</p>
        ) : failed ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : models.length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无绑定模型</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground text-xs font-medium">
              绑定模型（{models.length}）
            </div>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {models.map((m, i) => {
                const cost = resolveChannelIOCost({
                  modelId: m.model_id,
                  absolutePrices: prices,
                  multipliers,
                  rechargeFactor: recharge?.factor ?? null,
                  modelPrices: modelPriceQueries[i]?.data ?? [],
                });
                return (
                  <li
                    key={m.id}
                    className="flex min-w-0 items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                          {m.model_external_id}
                        </span>
                        {m.status !== "enabled" ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px]"
                          >
                            停用
                          </Badge>
                        ) : null}
                      </div>
                      {m.upstream_model !== m.model_external_id ? (
                        <span className="truncate font-mono text-muted-foreground text-xs">
                          → {m.upstream_model}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 tabular-nums text-xs">
                      {cost ? (
                        <>
                          {trimDecimal(cost.input)} / {trimDecimal(cost.output)}
                          {cost.source === "override" ? (
                            <Badge
                              variant="outline"
                              className="h-5 px-1.5 text-[10px] font-normal"
                            >
                              覆盖
                            </Badge>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function BoundRoutesCell({
  channelId,
  boundRoutes,
}: {
  channelId: number;
  boundRoutes: number;
}) {
  const [open, setOpen] = useState(false);
  const routesQuery = useQuery({
    queryKey: ["channel-ops-routes", channelId],
    queryFn: () => getChannelOpsRoutes(channelId),
    enabled: open,
  });
  const routes = routesQuery.data ?? [];
  const loading = routesQuery.isPending;

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={120}
      closeDelay={80}
    >
      <HoverCardTrigger asChild>
        <span
          className={cn(
            "tabular-nums",
            "cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
          )}
        >
          {formatInt(boundRoutes)}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80">
        {loading ? (
          <p className="text-muted-foreground text-xs">加载绑定线路…</p>
        ) : routesQuery.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : routes.length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无绑定线路</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground text-xs font-medium">
              绑定线路（{routes.length}）
            </div>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {routes.map((rt) => (
                <li
                  key={rt.id}
                  className="flex min-w-0 items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate font-medium">{rt.name}</span>
                    {rt.status !== "enabled" ? (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        停用
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                    ×{formatRouteRatioInput(rt.price_ratio) || "1"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function ChannelProtocolAdapterCell({
  protocol,
  adapterKey,
}: {
  protocol: string;
  adapterKey: string;
}) {
  const showAdapter = adapterKey && adapterKey !== protocol;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{protocol || "—"}</div>
      {showAdapter ? (
        <div className="truncate font-mono text-muted-foreground text-xs">
          {adapterKey}
        </div>
      ) : null}
    </div>
  );
}

function ChannelRateLimitCell({
  rpm,
  tpm,
  rpd,
}: {
  rpm: number | null;
  tpm: number | null;
  rpd: number | null;
}) {
  return (
    <RateLimitSummaryCell
      rpm={rpm}
      tpm={tpm}
      rpd={rpd}
      scopeLabel="渠道级限流"
    />
  );
}

function ChannelTimeoutCell({ timeoutMs }: { timeoutMs: number | null }) {
  if (timeoutMs == null) {
    return <span className="text-muted-foreground text-xs">默认</span>;
  }
  return (
    <span className="tabular-nums text-xs">{formatLatencyMs(timeoutMs)}</span>
  );
}

function formatMultiplier(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return trimDecimal(value);
}

function ChannelMultipliersCell({
  channelId,
  costMultiplier,
  costMultiplierOverrides,
  rechargeFactor,
}: {
  channelId: number;
  costMultiplier: string | null;
  costMultiplierOverrides: number;
  rechargeFactor: string | null;
}) {
  const [open, setOpen] = useState(false);
  const multipliersQuery = useQuery({
    queryKey: ["channel-cost-multipliers", channelId],
    queryFn: () => listChannelCostMultipliers(channelId),
    enabled: open,
  });
  const factorsQuery = useQuery({
    queryKey: ["channel-recharge-factors", channelId],
    queryFn: () => listChannelRechargeFactors(channelId),
    enabled: open,
  });

  const costLabel = formatMultiplier(costMultiplier);
  const rechargeLabel = formatMultiplier(rechargeFactor);
  const summary = `${costLabel} / ${rechargeLabel}`;

  const now = Date.now();
  const activeOverrides = (multipliersQuery.data ?? []).filter((m) => {
    if (m.model_id == null || m.status !== "enabled") return false;
    if (new Date(m.effective_from).getTime() > now) return false;
    if (m.effective_to && new Date(m.effective_to).getTime() <= now)
      return false;
    return true;
  });
  const currentRecharge = pickCurrentChannelRechargeFactor(
    factorsQuery.data ?? [],
  );

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={120}
      closeDelay={80}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "tabular-nums text-xs hover:underline",
            costMultiplier == null && rechargeFactor == null
              ? "text-muted-foreground"
              : undefined,
          )}
        >
          {summary}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">渠道倍率</div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            上游名义成本 = 模型基准价 × 价格倍率；真实成本 = 名义成本 ×
            充值倍率。
          </p>
        </div>
        <dl className="space-y-2 text-xs">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground shrink-0">价格倍率（默认）</dt>
            <dd className="tabular-nums font-medium">
              {costMultiplier != null ? trimDecimal(costMultiplier) : "未配置"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground shrink-0">逐模型覆盖</dt>
            <dd className="tabular-nums font-medium">
              {costMultiplierOverrides > 0
                ? `${formatInt(costMultiplierOverrides)} 条`
                : "无"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground shrink-0">充值倍率</dt>
            <dd className="tabular-nums font-medium">
              {rechargeFactor != null
                ? trimDecimal(rechargeFactor)
                : "未配置（结算按 1.0）"}
            </dd>
          </div>
        </dl>
        {open && costMultiplierOverrides > 0 ? (
          <div className="border-t pt-2">
            <div className="text-muted-foreground mb-1.5 text-[11px]">
              覆盖明细
            </div>
            {multipliersQuery.isLoading ? (
              <div className="text-muted-foreground text-xs">加载中…</div>
            ) : activeOverrides.length === 0 ? (
              <div className="text-muted-foreground text-xs">暂无生效覆盖</div>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {activeOverrides.map((m) => (
                  <li
                    key={m.id}
                    className="flex min-w-0 items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {m.model_display_name ||
                        m.model_external_id ||
                        `模型 ${m.model_id}`}
                    </span>
                    <span className="tabular-nums shrink-0 font-medium">
                      {trimDecimal(m.multiplier)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {open && currentRecharge && factorsQuery.isFetched ? (
          <div className="text-muted-foreground border-t pt-2 text-[11px]">
            充值倍率自 {formatDateTime(currentRecharge.effective_from)} 生效
            {currentRecharge.effective_to
              ? `，至 ${formatDateTime(currentRecharge.effective_to)}`
              : ""}
          </div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}

export function channelOsColumns(): ColumnDef<ChannelOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="渠道" />,
      enableHiding: false,
      meta: {
        autoSizeValue: (row: ChannelOpsRow) => {
          const provider = row.provider_name ? ` ${row.provider_name}` : "";
          const badge =
            row.circuit_breaker?.state === "open"
              ? "熔断 0:00 "
              : row.circuit_breaker?.state === "half_open"
                ? "半开 "
                : "";
          return `${badge}${row.name}${provider}`;
        },
      },
      cell: ({ row }) => (
        <div className="flex min-w-0 items-start gap-1.5">
          {row.original.circuit_breaker ? (
            <ChannelCircuitBreakerBadge breaker={row.original.circuit_breaker} />
          ) : null}
          <TruncateCell
            text={row.original.name}
            subtext={row.original.provider_name || undefined}
            className="font-medium"
          />
        </div>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableHiding: false,
      meta: { label: "状态" },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "credential_valid",
      accessorKey: "credential_valid",
      header: ({ column }) => <ColumnHeader column={column} title="凭据状态" />,
      meta: {
        label: "凭据状态",
        autoSizeValue: (row: ChannelOpsRow) =>
          row.credential_valid === false ? "凭据失效" : "有效",
      },
      cell: ({ row }) =>
        row.original.credential_valid === false ? (
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
            凭据失效
          </Badge>
        ) : (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            有效
          </Badge>
        ),
    },
    {
      id: "protocol_adapter",
      accessorFn: (r) => `${r.protocol}/${r.adapter_key}`,
      header: ({ column }) => (
        <ColumnHeader column={column} title="协议/Adapter" />
      ),
      enableSorting: false,
      meta: {
        autoSizeValue: (row: ChannelOpsRow) => {
          const showAdapter =
            row.adapter_key && row.adapter_key !== row.protocol;
          return showAdapter
            ? `${row.protocol} ${row.adapter_key}`
            : row.protocol;
        },
      },
      cell: ({ row }) => (
        <ChannelProtocolAdapterCell
          protocol={row.original.protocol}
          adapterKey={row.original.adapter_key}
        />
      ),
    },
    {
      id: "credential",
      accessorKey: "credential",
      header: ({ column }) => <ColumnHeader column={column} title="凭证" />,
      enableSorting: false,
      cell: ({ row }) => (
        <SecretCopyCell
          value={row.original.credential}
          tooltipTitle="完整 API 密钥"
          copyAriaLabel="复制 API 密钥"
          copyMessages={{
            success: "已复制 API 密钥",
            empty: "无可复制内容",
            failed: "复制失败，请手动选择复制",
          }}
        />
      ),
    },
    {
      id: "multipliers",
      header: ({ column }) => <ColumnHeader column={column} title="渠道倍率" />,
      enableSorting: false,
      meta: {
        label: "渠道倍率",
        autoSizeValue: (row: ChannelOpsRow) =>
          `${formatMultiplier(row.cost_multiplier)} / ${formatMultiplier(row.recharge_factor)}`,
      },
      cell: ({ row }) => (
        <ChannelMultipliersCell
          channelId={row.original.id}
          costMultiplier={row.original.cost_multiplier}
          costMultiplierOverrides={row.original.cost_multiplier_overrides}
          rechargeFactor={row.original.recharge_factor}
        />
      ),
    },
    {
      id: "rate_limit",
      header: ({ column }) => <ColumnHeader column={column} title="限流" />,
      enableSorting: false,
      meta: {
        autoSizeValue: (row: ChannelOpsRow) => {
          if (
            row.rpm_limit == null &&
            row.tpm_limit == null &&
            row.rpd_limit == null
          ) {
            return "默认";
          }
          if (row.rpm_limit === 0) return "不限";
          return formatInt(row.rpm_limit ?? 0);
        },
      },
      cell: ({ row }) => (
        <ChannelRateLimitCell
          rpm={row.original.rpm_limit}
          tpm={row.original.tpm_limit}
          rpd={row.original.rpd_limit}
        />
      ),
    },
    {
      id: "bound_models",
      accessorKey: "bound_models",
      header: ({ column }) => <ColumnHeader column={column} title="模型" />,
      cell: ({ row }) => (
        <BoundModelsCell
          channelId={row.original.id}
          boundModels={row.original.bound_models}
        />
      ),
    },
    {
      id: "bound_routes",
      accessorKey: "bound_routes",
      header: ({ column }) => <ColumnHeader column={column} title="线路" />,
      cell: ({ row }) => (
        <BoundRoutesCell
          channelId={row.original.id}
          boundRoutes={row.original.bound_routes}
        />
      ),
    },
    {
      id: "timeout",
      accessorKey: "timeout_ms",
      header: ({ column }) => <ColumnHeader column={column} title="超时" />,
      enableSorting: false,
      cell: ({ row }) => (
        <ChannelTimeoutCell timeoutMs={row.original.timeout_ms} />
      ),
    },
    {
      id: "last_test",
      accessorFn: (r) =>
        r.last_test_ok === null ? -1 : r.last_test_ok ? 1 : 0,
      header: () => <span className="text-muted-foreground">检测</span>,
      enableSorting: false,
      meta: {
        autoSizeValue: (row: ChannelOpsRow) =>
          channelLastTestAutoSizeLabel(row),
      },
      cell: ({ row }) => (
        <ChannelLastTestCell
          info={{
            last_tested_at: row.original.last_tested_at,
            last_test_ok: row.original.last_test_ok,
            last_test_latency_ms: row.original.last_test_latency_ms,
            last_test_error: row.original.last_test_error,
          }}
        />
      ),
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="创建时间" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <ChannelRowActions channelId={row.original.id} />,
    },
  ];
}
