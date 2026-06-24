import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon } from "lucide-react";
import {
  getProvidersOpsTable,
  type ProviderOpsRow,
} from "@/lib/api/providersOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { RangeFilter } from "@/components/common/RangeFilter";
import { ProviderDetailSheet } from "@/components/providers/ProviderDetailSheet";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import {
  formatCompact,
  formatInt,
  formatLatencyMs,
  formatPercent,
  formatRelativeTime,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function ProvidersPage() {
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ProviderOpsRow | null>(null);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const rangeQuery = { ...params, range: value.preset };

  const table = useQuery({
    queryKey: ["providers", "ops-table", rangeQuery, statusTab, search, page],
    queryFn: () =>
      getProvidersOpsTable({
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
          <h2 className="font-heading text-lg font-semibold tracking-tight">服务商</h2>
          <p className="text-muted-foreground text-sm">上游供应商分组视图：整体稳定性与渠道概况</p>
        </div>
        <div className="flex items-center gap-2">
          <RangeFilter value={value} onChange={setRange} refreshedAt={refreshedAt} onRefresh={refresh} />
          <ProviderFormDialog>
            <Button size="sm">
              <PlusIcon data-icon="inline-start" />
              新建服务商
            </Button>
          </ProviderFormDialog>
        </div>
      </div>

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
            placeholder="搜索名称 / slug"
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
                  <TableHead>服务商</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">渠道</TableHead>
                  <TableHead>健康</TableHead>
                  <TableHead className="text-right">请求</TableHead>
                  <TableHead className="text-right">成功率</TableHead>
                  <TableHead className="text-right">P95 延迟</TableHead>
                  <TableHead className="text-right">超时</TableHead>
                  <TableHead>最近成功</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.isPending ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : table.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground py-10 text-center text-sm">
                      暂无服务商
                    </TableCell>
                  </TableRow>
                ) : (
                  table.data.items.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-muted-foreground text-xs">{p.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "enabled" ? "default" : "outline"}>
                          {p.status === "enabled" ? "启用" : "停用"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.channel_enabled}/{p.channel_total}
                      </TableCell>
                      <TableCell>
                        <Badge variant={HEALTH_VARIANT[p.health]}>{HEALTH_LABEL[p.health]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCompact(p.attempt_total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(p.success_rate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatLatencyMs(p.latency_p95)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(p.timeout_total)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {p.last_success_at ? formatRelativeTime(p.last_success_at) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination page={page} pageCount={pageCount} total={table.data?.total ?? 0} onPageChange={setPage} />
        </div>
      )}

      <ProviderDetailSheet provider={selected} range={rangeQuery} onClose={() => setSelected(null)} />
    </div>
  );
}
