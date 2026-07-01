/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listChannelModels } from "@/lib/api/channelModels";
import { listChannelPrices, pickCurrentChannelPrice } from "@/lib/api/channelPrices";
import type { ChannelOpsRow } from "@/lib/api/channelsOps";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import { AttemptLatencyCell } from "@/components/ops-tables/AttemptLatencyCell";
import { AttemptSuccessRateCell } from "@/components/ops-tables/AttemptSuccessRateCell";
import { ChannelRowActions } from "@/components/channels/ChannelRowActions";
import {
  formatDateTime,
  formatInt,
  maskSecret,
  trimDecimal,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

export const CHANNEL_OS_COLUMN_LABELS: Record<string, string> = {
  name: "渠道",
  credential: "API 密钥",
  success_rate: "成功率",
  latency: "平均延迟",
  timeout: "超时",
  rate_limit: "限流",
  bound_models: "模型",
  recent_error: "最近错误",
  created_at: "创建时间",
  status: "状态",
  health: "健康",
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

function ChannelCredentialCell({ credential }: { credential: string }) {
  async function copy() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential);
      toast.success("已复制 API 密钥");
    } catch {
      toast.error("复制失败，请手动选择复制");
    }
  }

  if (!credential) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div
      className="flex min-w-0 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <HoverCard openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>
          <span
            className={cn(
              "min-w-0 truncate font-mono text-xs",
              "cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
            )}
          >
            {maskSecret(credential)}
          </span>
        </HoverCardTrigger>
        <HoverCardContent align="start" className="w-auto max-w-sm">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">完整 API 密钥</p>
          <code className="break-all font-mono text-xs">{credential}</code>
        </HoverCardContent>
      </HoverCard>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="复制 API 密钥"
        onClick={copy}
      >
        <CopyIcon />
      </Button>
    </div>
  );
}

// 限流语义：null=继承全局默认，0=不限，>0=具体上限。RPM 无单位；TPM/RPD 带单位(K/M/B)。
function formatRpmLimit(v: number | null): string {
  if (v == null) return "默认";
  if (v === 0) return "不限";
  return formatInt(v);
}

// 悬浮卡里给出完整描述与精确值（不缩写）。
function rateLimitDetail(v: number | null): string {
  if (v == null) return "继承全局默认";
  if (v === 0) return "不限";
  return formatInt(v);
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
  // 三维全继承时收敛为单个「默认」，避免整列被重复文案淹没。
  if (rpm == null && tpm == null && rpd == null) {
    return <span className="text-muted-foreground text-xs">默认</span>;
  }
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="cursor-default text-xs tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
          {formatRpmLimit(rpm)}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64">
        <p className="text-muted-foreground mb-1.5 text-xs font-medium">渠道级限流</p>
        <ul className="flex flex-col gap-1 text-xs">
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每分钟请求 RPM</span>
            <span className="tabular-nums">{rateLimitDetail(rpm)}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每分钟 Token TPM</span>
            <span className="tabular-nums">{rateLimitDetail(tpm)}</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">每日请求 RPD</span>
            <span className="tabular-nums">{rateLimitDetail(rpd)}</span>
          </li>
        </ul>
        <p className="text-muted-foreground mt-1.5 text-[11px]">
          留空继承全局默认，0 表示不限。
        </p>
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
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.name}
          className="font-medium"
          subtext={`${row.original.provider_name} · ${row.original.base_url}`}
        />
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableHiding: false,
      meta: { label: "状态", fixedWidth: true },
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    },
    {
      id: "health",
      accessorKey: "health",
      header: ({ column }) => <ColumnHeader column={column} title="健康" />,
      enableSorting: false,
      enableHiding: false,
      meta: { label: "健康", fixedWidth: true },
      cell: ({ row }) => (
        <Badge variant={HEALTH_VARIANT[row.original.health]}>
          {HEALTH_LABEL[row.original.health]}
        </Badge>
      ),
    },
    {
      id: "credential",
      accessorKey: "credential",
      header: ({ column }) => <ColumnHeader column={column} title="API 密钥" />,
      enableSorting: false,
      cell: ({ row }) => <ChannelCredentialCell credential={row.original.credential} />,
    },
    {
      id: "rate_limit",
      header: ({ column }) => <ColumnHeader column={column} title="限流" />,
      enableSorting: false,
      cell: ({ row }) => (
        <ChannelRateLimitCell
          rpm={row.original.rpm_limit}
          tpm={row.original.tpm_limit}
          rpd={row.original.rpd_limit}
        />
      ),
    },
    {
      id: "success_rate",
      accessorKey: "success_rate",
      header: ({ column }) => <ColumnHeader column={column} title="成功率" />,
      cell: ({ row }) => (
        <AttemptSuccessRateCell
          attemptTotal={row.original.attempt_total}
          attemptSucceeded={row.original.attempt_succeeded}
          successRate={row.original.success_rate}
        />
      ),
    },
    {
      id: "latency",
      accessorFn: (r) => r.latency.avg,
      header: ({ column }) => <ColumnHeader column={column} title="平均延迟" />,
      cell: ({ row }) => <AttemptLatencyCell latency={row.original.latency} />,
    },
    {
      id: "timeout",
      accessorKey: "timeout_total",
      header: ({ column }) => <ColumnHeader column={column} title="超时" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatInt(row.original.timeout_total)}</span>
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
      id: "recent_error",
      accessorKey: "recent_error_code",
      header: ({ column }) => <ColumnHeader column={column} title="最近错误" />,
      enableSorting: false,
      cell: ({ row }) => (
        <TruncateCell
          className="text-muted-foreground text-xs"
          text={row.original.recent_error_code || "—"}
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
