import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import {
  getRoutesOpsSummary,
  getRoutesOpsTable,
  type RouteOpsRow,
  type RoutesOpsSummary,
} from "@/lib/api/routesOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { RangeFilter } from "@/components/common/RangeFilter";
import { MetricCard, MetricGrid } from "@/components/common/MetricCard";
import {
  ConfigurableDataTable,
  OPS_STATUS_FILTER_OPTIONS,
  TableToolbarSearch,
  TableToolbarSelect,
  type OpsStatusFilter,
} from "@/components/data-table";
import { routeOpsColumns } from "@/components/ops-tables/routes-columns";
import { RouteDetailSheet } from "@/components/routes/RouteDetailSheet";
import { RouteFormDialog } from "@/components/routes/RouteFormDialog";
import { formatCompact, formatInt, formatLatencyMs, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/common/TablePagination";

const PAGE_SIZE = 20;

export function RoutesPage() {
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const [statusTab, setStatusTab] = useState<OpsStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<RouteOpsRow | null>(null);
  const search = useDebouncedValue(searchInput.trim(), 300);
  const queryClient = useQueryClient();

  const rangeQuery = { ...params, range: value.preset };

  const summary = useQuery({
    queryKey: ["routes", "ops-summary", rangeQuery],
    queryFn: () => getRoutesOpsSummary(rangeQuery),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const table = useQuery({
    queryKey: ["routes", "ops-table", rangeQuery, statusTab, search, page],
    queryFn: () =>
      getRoutesOpsTable({
        ...rangeQuery,
        page,
        page_size: PAGE_SIZE,
        status: statusTab === "all" ? undefined : statusTab,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const pageCount = table.data ? Math.max(1, Math.ceil(table.data.total / PAGE_SIZE)) : 1;
  const refetchAll = () => queryClient.invalidateQueries({ queryKey: ["routes"] });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">线路</h2>
          <p className="text-muted-foreground text-sm">客户线路（渠道商品）：可服务性、fallback 与绑定</p>
        </div>
        <div className="flex items-center gap-2">
          <RangeFilter value={value} onChange={setRange} refreshedAt={refreshedAt} onRefresh={refresh} />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            新建线路
          </Button>
        </div>
      </div>

      <RoutesCards summary={summary.data} loading={summary.isPending} />

      {table.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(table.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <ConfigurableDataTable
            storageKey="routes:ops-table"
            data={table.data?.items ?? []}
            columns={routeOpsColumns()}
            loading={table.isPending}
            onRowClick={setSelected}
            pinnedColumnId="name"
            emptyMessage="暂无线路"
            getRowId={(r) => String(r.id)}
            tableClassName={table.isFetching && !table.isPending ? "opacity-60" : undefined}
            toolbarStart={
              <>
                <TableToolbarSelect
                  value={statusTab}
                  onValueChange={(v) => {
                    setStatusTab(v);
                    setPage(1);
                  }}
                  options={OPS_STATUS_FILTER_OPTIONS}
                />
                <TableToolbarSearch
                  value={searchInput}
                  onChange={(v) => {
                    setSearchInput(v);
                    setPage(1);
                  }}
                  placeholder="搜索线路名"
                />
              </>
            }
          />
          <TablePagination page={page} pageCount={pageCount} total={table.data?.total ?? 0} onPageChange={setPage} />
        </div>
      )}

      <RouteDetailSheet route={selected} range={rangeQuery} onClose={() => setSelected(null)} onChanged={refetchAll} />
      <RouteFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        route={null}
        onSaved={() => {
          setCreateOpen(false);
          refetchAll();
        }}
      />
    </div>
  );
}

function RoutesCards({ summary, loading }: { summary?: RoutesOpsSummary; loading: boolean }) {
  const s = summary;
  return (
    <MetricGrid className="lg:grid-cols-4">
      <MetricCard label="线路总数" loading={loading} value={formatInt(s?.total ?? 0)} hint={s ? `启用 ${s.enabled} · 内置 ${s.builtin}` : undefined} />
      <MetricCard label="启用线路" loading={loading} value={formatInt(s?.enabled ?? 0)} hint={s ? `停用 ${s.disabled}` : undefined} />
      <MetricCard label="请求量" loading={loading} value={formatCompact(s?.request_total ?? 0)} hint={s ? `成功 ${formatCompact(s.succeeded)}` : undefined} tooltip="按就近绑定归因到线路的请求" />
      <MetricCard label="成功率" loading={loading} value={formatPercent(s?.success_rate ?? 0)} intent={s ? (s.success_rate >= 0.95 ? "success" : s.success_rate >= 0.8 ? "warning" : "danger") : "default"} />
      <MetricCard label="性能" loading={loading} value={formatLatencyMs(s?.latency_p95 ?? 0)} tooltip="P95 完成延迟" />
      <MetricCard label="Fallback 率" loading={loading} value={formatPercent(s?.fallback_rate ?? 0)} intent={s && s.fallback_rate > 0.15 ? "warning" : "default"} tooltip="成功请求中发生过降级切换的占比" />
      <MetricCard label="无可用渠道" loading={loading} value={formatInt(s?.no_channel ?? 0)} intent={s && s.no_channel > 0 ? "danger" : "default"} tooltip="routing 无可用渠道次数" />
      <MetricCard label="内置线路" loading={loading} value={formatInt(s?.builtin ?? 0)} tooltip="经济 / 稳定（不可删）" />
    </MetricGrid>
  );
}
