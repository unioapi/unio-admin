import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import {
  getModelsOpsSummary,
  getModelsOpsTable,
  type ModelOpsRow,
  type ModelsOpsSummary,
} from "@/lib/api/modelsOps";
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
import { modelOpsColumns } from "@/components/ops-tables/models-columns";
import { ModelDetailSheet } from "@/components/models/ModelDetailSheet";
import { ModelFormDialog } from "@/components/models/ModelFormDialog";
import { ModelCatalogTab } from "@/components/models/ModelCatalogTab";
import { formatCompact, formatInt, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePagination } from "@/components/common/TablePagination";

const PAGE_SIZE = 20;

export function ModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageTab = searchParams.get("tab") === "catalog" ? "catalog" : "ops";
  const setPageTab = (t: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (t === "catalog") sp.set("tab", "catalog");
        else sp.delete("tab");
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">模型</h2>
        <p className="text-muted-foreground text-sm">运营模型商品：可售性、渠道、性能与毛利</p>
      </div>
      <Tabs value={pageTab} onValueChange={setPageTab}>
        <TabsList>
          <TabsTrigger value="ops">运营模型</TabsTrigger>
          <TabsTrigger value="catalog">参考目录</TabsTrigger>
        </TabsList>
        <TabsContent value="ops" className="pt-4">
          <OpsConsole />
        </TabsContent>
        <TabsContent value="catalog" className="pt-4">
          <ModelCatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OpsConsole() {
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const [statusTab, setStatusTab] = useState<OpsStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ModelOpsRow | null>(null);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const rangeQuery = { ...params, range: value.preset };

  const summary = useQuery({
    queryKey: ["models", "ops-summary", rangeQuery],
    queryFn: () => getModelsOpsSummary(rangeQuery),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const table = useQuery({
    queryKey: ["models", "ops-table", rangeQuery, statusTab, search, page],
    queryFn: () =>
      getModelsOpsTable({
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RangeFilter value={value} onChange={setRange} refreshedAt={refreshedAt} onRefresh={refresh} />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          新建模型
        </Button>
      </div>

      <ModelsCards summary={summary.data} loading={summary.isPending} />

      {table.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(table.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <ConfigurableDataTable
            storageKey="models:ops-table"
            data={table.data?.items ?? []}
            columns={modelOpsColumns()}
            loading={table.isPending}
            onRowClick={setSelected}
            pinnedColumnId="name"
            emptyMessage="暂无模型"
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
                  placeholder="搜索模型 ID / 名称"
                />
              </>
            }
          />
          <TablePagination page={page} pageCount={pageCount} total={table.data?.total ?? 0} onPageChange={setPage} />
        </div>
      )}

      <ModelDetailSheet model={selected} range={rangeQuery} onClose={() => setSelected(null)} />
      <ModelFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ModelsCards({ summary, loading }: { summary?: ModelsOpsSummary; loading: boolean }) {
  const s = summary;
  const priceRate = s && s.price_total > 0 ? s.price_with_price / s.price_total : 0;
  return (
    <MetricGrid className="lg:grid-cols-4">
      <MetricCard label="模型总数" loading={loading} value={formatInt(s?.total ?? 0)} hint={s ? `启用 ${s.enabled}` : undefined} />
      <MetricCard label="启用模型" loading={loading} value={formatInt(s?.enabled ?? 0)} hint={s ? `停用 ${s.disabled}` : undefined} />
      <MetricCard label="可售模型" loading={loading} value={formatInt(s?.sellable ?? 0)} intent="success" tooltip="启用 + 有可用渠道 + 有价格" />
      <MetricCard label="无可用渠道" loading={loading} value={formatInt(s?.no_channel ?? 0)} intent={s && s.no_channel > 0 ? "danger" : "default"} tooltip="启用但无健康可用渠道" />
      <MetricCard label="价格完整率" loading={loading} value={formatPercent(priceRate)} tooltip={s ? `有价 ${s.price_with_price}/${s.price_total}` : undefined} />
      <MetricCard label="请求量" loading={loading} value={formatCompact(s?.request_total ?? 0)} hint={s ? `成功 ${formatCompact(s.succeeded)}` : undefined} />
      <MetricCard label="成功率" loading={loading} value={formatPercent(s?.success_rate ?? 0)} intent={s ? (s.success_rate >= 0.95 ? "success" : s.success_rate >= 0.8 ? "warning" : "danger") : "default"} />
      <MetricCard label="毛利率" loading={loading} value={formatPercent(s?.margin_rate ?? 0)} intent={s && Number(s.margin_usd) < 0 ? "danger" : "success"} tooltip={s ? `收入 $${s.revenue_usd} · 毛利 $${s.margin_usd}（USD）` : undefined} />
    </MetricGrid>
  );
}
