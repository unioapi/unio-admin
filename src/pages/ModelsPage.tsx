import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon } from "lucide-react";
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
import { ModelDetailSheet } from "@/components/models/ModelDetailSheet";
import { ModelFormDialog } from "@/components/models/ModelFormDialog";
import { ModelCatalogTab } from "@/components/models/ModelCatalogTab";
import {
  formatCompact,
  formatInt,
  formatLatencyMs,
  formatPercent,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/common/TablePagination";

const PAGE_SIZE = 20;
type StatusTab = "all" | "enabled" | "disabled";

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
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
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

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v as StatusTab); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="enabled">启用</TabsTrigger>
            <TabsTrigger value="disabled">停用</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="搜索模型 ID / 名称"
            className="w-56 pl-8"
          />
        </div>
      </div>

      {table.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(table.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>可售</TableHead>
                  <TableHead className="text-right">渠道</TableHead>
                  <TableHead className="text-right">请求</TableHead>
                  <TableHead className="text-right">成功率</TableHead>
                  <TableHead className="text-right">P95 延迟</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead className="text-right">毛利率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.isPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : table.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground py-10 text-center text-sm">
                      暂无模型
                    </TableCell>
                  </TableRow>
                ) : (
                  table.data.items.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                      <TableCell>
                        <div className="font-medium">{m.model_id}</div>
                        <div className="text-muted-foreground text-xs">{m.display_name} · {m.owned_by}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === "enabled" ? "default" : "outline"}>
                          {m.status === "enabled" ? "启用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.sellable ? (
                          <Badge variant="default">可售</Badge>
                        ) : (
                          <Badge variant="destructive">不可售</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.bindings_available}/{m.bindings_total}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCompact(m.request_total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(m.success_rate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatLatencyMs(m.latency_p95)}</TableCell>
                      <TableCell>
                        {m.has_price ? (
                          <Badge variant="secondary">已配置</Badge>
                        ) : (
                          <Badge variant="destructive">缺价</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(m.margin_rate)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
