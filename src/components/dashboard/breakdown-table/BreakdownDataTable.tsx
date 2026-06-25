import { useMemo, type ReactNode } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getBreakdown, type BreakdownDimension, type RangeQuery } from "@/lib/api/dashboard";
import { ConfigurableDataTable } from "@/components/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BREAKDOWN_TABS, breakdownColumnLabels } from "./constants";
import { createBreakdownColumns } from "./columns";

export function BreakdownDataTable({
  dimension,
  range,
  active,
  toolbarStart,
}: {
  dimension: BreakdownDimension;
  range: RangeQuery;
  active: boolean;
  toolbarStart?: ReactNode;
}) {
  const q = useQuery({
    queryKey: ["dashboard", "breakdown", dimension, range],
    queryFn: () => getBreakdown(dimension, range),
    placeholderData: keepPreviousData,
    enabled: active,
  });

  const nameLabel =
    BREAKDOWN_TABS.find((t) => t.value === dimension)?.label ?? "名称";
  const columns = useMemo(
    () => createBreakdownColumns(dimension, nameLabel),
    [dimension, nameLabel],
  );
  const columnLabels = useMemo(
    () => breakdownColumnLabels(dimension, nameLabel),
    [dimension, nameLabel],
  );

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
          按 API Key / 项目当前线路绑定归因，变更绑定后历史会重算。
        </p>
      ) : null}
      <ConfigurableDataTable
        storageKey={`breakdown:${dimension}`}
        data={q.data?.rows ?? []}
        columns={columns}
        columnLabels={columnLabels}
        pinnedColumnId="name"
        emptyMessage="区间内暂无数据"
        getRowId={(row, i) => `${row.label}-${i}`}
        toolbarStart={toolbarStart}
        bordered={false}
      />
    </div>
  );
}
