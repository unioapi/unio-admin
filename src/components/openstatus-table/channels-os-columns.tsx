/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { listChannelModels } from "@/lib/api/channelModels";
import { listChannelPrices, pickCurrentChannelPrice } from "@/lib/api/channelPrices";
import type { ChannelOpsRow } from "@/lib/api/channelsOps";
import {
  ChannelLastTestCell,
  channelLastTestAutoSizeLabel,
} from "@/components/channels/ChannelLastTest";
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

export const CHANNEL_OS_COLUMN_LABELS: Record<string, string> = {
  name: "渠道",
  status: "状态",
  protocol_adapter: "协议/Adapter",
  credential: "凭证",
  rate_limit: "限流",
  bound_models: "模型",
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
  const models = modelsQuery.data ?? [];
  const prices = pricesQuery.data ?? [];
  const loading = modelsQuery.isPending || pricesQuery.isPending;

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
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
      <HoverCardContent align="start" className="w-80">
        {loading ? (
          <p className="text-muted-foreground text-xs">加载绑定模型…</p>
        ) : modelsQuery.isError || pricesQuery.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : models.length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无绑定模型</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground text-xs font-medium">
              绑定模型（{models.length}）
            </div>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {models.map((m) => {
                const activePrice = pickCurrentChannelPrice(prices, m.model_id);
                return (
                  <li
                    key={m.id}
                    className="flex min-w-0 items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{m.model_external_id}</span>
                        {m.status !== "enabled" ? (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
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
                    {activePrice ? (
                      <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                        {trimDecimal(activePrice.uncached_input_cost)} /{" "}
                        {trimDecimal(activePrice.output_cost)}
                      </span>
                    ) : null}
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
        <div className="truncate font-mono text-muted-foreground text-xs">{adapterKey}</div>
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
  return <span className="tabular-nums text-xs">{formatLatencyMs(timeoutMs)}</span>;
}

export function channelOsColumns(): ColumnDef<ChannelOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="渠道" />,
      enableHiding: false,
      cell: ({ row }) => (
        <TruncateCell text={row.original.name} className="font-medium" />
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableHiding: false,
      meta: { label: "状态" },
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      ),
    },
    {
      id: "protocol_adapter",
      accessorFn: (r) => `${r.protocol}/${r.adapter_key}`,
      header: ({ column }) => <ColumnHeader column={column} title="协议/Adapter" />,
      enableSorting: false,
      meta: {
        autoSizeValue: (row: ChannelOpsRow) => {
          const showAdapter = row.adapter_key && row.adapter_key !== row.protocol;
          return showAdapter ? `${row.protocol} ${row.adapter_key}` : row.protocol;
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
      id: "rate_limit",
      header: ({ column }) => <ColumnHeader column={column} title="限流" />,
      enableSorting: false,
      meta: {
        autoSizeValue: (row: ChannelOpsRow) => {
          if (row.rpm_limit == null && row.tpm_limit == null && row.rpd_limit == null) {
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
      id: "timeout",
      accessorKey: "timeout_ms",
      header: ({ column }) => <ColumnHeader column={column} title="超时" />,
      enableSorting: false,
      cell: ({ row }) => <ChannelTimeoutCell timeoutMs={row.original.timeout_ms} />,
    },
    {
      id: "last_test",
      accessorFn: (r) => (r.last_test_ok === null ? -1 : r.last_test_ok ? 1 : 0),
      header: () => <span className="text-muted-foreground">检测</span>,
      enableSorting: false,
      meta: {
        autoSizeValue: (row: ChannelOpsRow) => channelLastTestAutoSizeLabel(row),
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
