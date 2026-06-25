import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import {
  getChannelsOpsSummary,
  getChannelsOpsTable,
} from "@/lib/api/channelsOps";
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
import { channelOpsColumns } from "@/components/ops-tables/channels-columns";
import { ChannelDetailSheet } from "@/components/channels/ChannelDetailSheet";
import { ChannelFormDialog } from "@/components/channels/ChannelFormDialog";
import { LatencyHint, LatencyTip } from "@/components/dashboard/LatencyTip";
import { formatCompact, formatInt, formatLatencyMs, formatPercent, formatTPS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/common/TablePagination";

const PAGE_SIZE = 20;

export function ChannelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");

  const [statusTab, setStatusTab] = useState<OpsStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const channelIdParam = searchParams.get("channel_id");
  const openChannelId = channelIdParam ? Number(channelIdParam) : null;
  const setOpenChannelId = (id: number | null) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (id == null) sp.delete("channel_id");
        else sp.set("channel_id", String(id));
        return sp;
      },
      { replace: true },
    );
  };

  const rangeQuery = { ...params, range: value.preset };

  const summary = useQuery({
    queryKey: ["channels", "ops-summary", rangeQuery],
    queryFn: () => getChannelsOpsSummary(rangeQuery),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const table = useQuery({
    queryKey: ["channels", "ops-table", rangeQuery, statusTab, search, page],
    queryFn: () =>
      getChannelsOpsTable({
        ...rangeQuery,
        page,
        page_size: PAGE_SIZE,
        status: statusTab === "all" ? undefined : statusTab,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const pageCount = table.data ? Math.max(1, Math.ceil(table.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">渠道</h2>
          <p className="text-muted-foreground text-sm">上游渠道运维：健康、性能、错误与定价</p>
        </div>
        <div className="flex items-center gap-2">
          <RangeFilter value={value} onChange={setRange} refreshedAt={refreshedAt} onRefresh={refresh} />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            新建渠道
          </Button>
        </div>
      </div>

      <ChannelsCards summary={summary.data} loading={summary.isPending} />

      {table.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(table.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <ConfigurableDataTable
            storageKey="channels:ops-table"
            data={table.data?.items ?? []}
            columns={channelOpsColumns()}
            loading={table.isPending}
            onRowClick={(c) => setOpenChannelId(c.id)}
            pinnedColumnId="name"
            emptyMessage="暂无渠道"
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
                  placeholder="搜索渠道名"
                />
              </>
            }
          />
          <TablePagination page={page} pageCount={pageCount} total={table.data?.total ?? 0} onPageChange={setPage} />
        </div>
      )}

      <ChannelDetailSheet channelId={openChannelId} range={rangeQuery} onClose={() => setOpenChannelId(null)} />
      <ChannelFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ChannelsCards({
  summary,
  loading,
}: {
  summary?: import("@/lib/api/channelsOps").ChannelsOpsSummary;
  loading: boolean;
}) {
  const s = summary;
  const health = s
    ? `健康 ${s.health.healthy} · 降级 ${s.health.degraded} · 不健康 ${s.health.unhealthy} · 无数据 ${s.health.no_data}`
    : undefined;
  const priceRate =
    s && s.price_total > 0 ? s.price_with_price / s.price_total : 0;
  return (
    <MetricGrid>
      <MetricCard label="渠道总数" loading={loading} value={formatInt(s?.total ?? 0)} hint={s ? `启用 ${s.enabled}` : undefined} />
      <MetricCard label="启用渠道" loading={loading} value={formatInt(s?.enabled ?? 0)} hint={s ? `停用 ${s.disabled}` : undefined} />
      <MetricCard
        label="健康状态"
        loading={loading}
        value={s ? formatInt(s.health.healthy) : "—"}
        hint={s ? `不健康 ${s.health.unhealthy}` : undefined}
        tooltip={health}
        intent={s && s.health.unhealthy > 0 ? "danger" : "default"}
      />
      <MetricCard label="请求量" loading={loading} value={formatCompact(s?.attempt_total ?? 0)} tooltip="attempt 维度（每次上游尝试）" hint={s ? `成功 ${formatCompact(s.attempt_succeeded)}` : undefined} />
      <MetricCard label="成功率" loading={loading} value={formatPercent(s?.success_rate ?? 0)} intent={s ? (s.success_rate >= 0.95 ? "success" : s.success_rate >= 0.8 ? "warning" : "danger") : "default"} tooltip="attempt 成功率" />
      <MetricCard
        label="性能"
        loading={loading}
        value={formatLatencyMs(s?.latency.avg ?? 0)}
        hint={s ? <LatencyHint latency={s.latency} /> : undefined}
        tooltip={s ? <LatencyTip latency={s.latency} /> : undefined}
      />
      <MetricCard label="TPS" loading={loading} value={s ? formatTPS(s.tps) : "—"} tooltip="成功请求平均输出 token 速度（最终渠道归因）" />
      <MetricCard label="超时" loading={loading} value={formatInt(s?.timeout_total ?? 0)} intent={s && s.timeout_total > 0 ? "warning" : "default"} />
      <MetricCard label="最近错误" loading={loading} value={s?.recent_error_code || "—"} hint={s?.recent_error_channel || undefined} />
      <MetricCard
        label="价格完整率"
        loading={loading}
        value={formatPercent(priceRate)}
        tooltip={s ? `有售价 ${s.price_with_price}/${s.price_total} · 有成本 ${s.price_with_cost}` : undefined}
      />
      <MetricCard label="凭据状态" loading={loading} value={s ? `${s.enabled} 已配置` : "—"} tooltip="所有渠道均已加密配置凭据" />
    </MetricGrid>
  );
}
