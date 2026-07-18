import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { EyeIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  getBreakdown,
  type BreakdownDimension,
  type BreakdownRow,
  type RangeQuery,
} from "@/lib/api/dashboard";
import { ConfigurableDataTable } from "@/components/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCompact,
  formatInt,
  formatLatencyMs,
  formatPercent,
  formatTPS,
  formatUSD,
} from "@/lib/format";
import { useMetricThresholds } from "@/hooks/useMetricThresholds";
import { BREAKDOWN_TABS, breakdownColumnLabels } from "./constants";
import { createBreakdownColumns } from "./columns";
import { breakdownRowHref } from "./navigation";

function autoSizeValue(row: BreakdownRow, columnId: string) {
  switch (columnId) {
    case "name":
      return row.label;
    case "status":
      return row.status === "enabled" ? "启用" : row.status === "disabled" ? "停用" : row.status;
    case "health":
      return row.health_bucket;
    case "requests":
      return formatCompact(row.terminal);
    case "succeeded":
      return formatCompact(row.succeeded);
    case "failed":
      return formatCompact(row.failed ?? 0);
    case "success_rate":
      return formatPercent(row.success_rate);
    case "channels":
      return formatInt(row.channel_count ?? 0);
    case "tokens":
      return formatCompact(row.tokens);
    case "margin":
      return formatUSD(row.margin_usd);
    case "latency":
      return row.latency?.sample ? formatLatencyMs(row.latency.avg) : row.latency_p95 > 0 ? formatLatencyMs(row.latency_p95) : "";
    case "tps":
      return formatTPS(row.avg_tps);
    case "recent_error":
      return row.recent_error;
    default:
      return "";
  }
}

function BreakdownActionCell({
  dimension,
  row,
}: {
  dimension: BreakdownDimension;
  row: BreakdownRow;
}) {
  const [searchParams] = useSearchParams();
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
        <Link to={breakdownRowHref(dimension, row, searchParams)}>
          <EyeIcon />
        </Link>
      </Button>
    </div>
  );
}

function breakdownActionColumn(
  dimension: BreakdownDimension,
): ColumnDef<BreakdownRow> {
  return {
    id: "action",
    header: "操作",
    size: 72,
    minSize: 64,
    maxSize: 72,
    enableResizing: false,
    enableHiding: false,
    cell: ({ row }) => (
      <BreakdownActionCell dimension={dimension} row={row.original} />
    ),
  };
}

export function BreakdownDataTable({
  dimension,
  range,
  active,
}: {
  dimension: BreakdownDimension;
  range: RangeQuery;
  active: boolean;
}) {
  const thresholds = useMetricThresholds();

  const q = useQuery({
    queryKey: ["dashboard", "breakdown", dimension, range],
    queryFn: () => getBreakdown(dimension, range),
    placeholderData: keepPreviousData,
    enabled: active,
  });

  const nameLabel =
    BREAKDOWN_TABS.find((t) => t.value === dimension)?.label ?? "名称";
  const columns = useMemo(
    () => [
      ...createBreakdownColumns(dimension, nameLabel, thresholds),
      breakdownActionColumn(dimension),
    ],
    [dimension, nameLabel, thresholds],
  );
  const columnLabels = useMemo(() => {
    const labels = breakdownColumnLabels(dimension, nameLabel);
    labels.action = "操作";
    return labels;
  }, [dimension, nameLabel]);

  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError)
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{(q.error as Error).message}</AlertDescription>
      </Alert>
    );

  return (
    <div className="flex flex-col gap-3">
      {dimension === "route" ? (
        <p className="text-muted-foreground text-xs">
          按 API Key / 用户当前线路绑定归因，变更绑定后历史会重算。
        </p>
      ) : null}
      <ConfigurableDataTable
        storageKey={`breakdown:${dimension}:content-v4`}
        data={q.data?.rows ?? []}
        columns={columns}
        columnLabels={columnLabels}
        pinnedColumnId="name"
        layoutMode="content"
        getAutoSizeValue={autoSizeValue}
        emptyMessage="区间内暂无数据"
        getRowId={(row, i) => `${row.label}-${i}`}
        bordered={false}
        enablePagination={false}
        showViewOptions={false}
      />
    </div>
  );
}
