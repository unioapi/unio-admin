import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import {
  getProvidersOpsTable,
  type ProviderOpsRow,
} from "@/lib/api/providersOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { RangeFilter } from "@/components/common/RangeFilter";
import {
  ConfigurableDataTable,
  OPS_STATUS_FILTER_OPTIONS,
  TableToolbarSearch,
  TableToolbarSelect,
  type OpsStatusFilter,
} from "@/components/data-table";
import { providerOpsColumns } from "@/components/ops-tables/providers-columns";
import { ProviderDetailSheet } from "@/components/providers/ProviderDetailSheet";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/common/TablePagination";

const PAGE_SIZE = 20;

export function ProvidersPage() {
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const [statusTab, setStatusTab] = useState<OpsStatusFilter>("all");
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

      {table.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(table.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3">
          <ConfigurableDataTable
            storageKey="providers:ops-table"
            data={table.data?.items ?? []}
            columns={providerOpsColumns()}
            loading={table.isPending}
            onRowClick={setSelected}
            pinnedColumnId="name"
            emptyMessage="暂无服务商"
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
                  placeholder="搜索名称 / slug"
                />
              </>
            }
          />
          <TablePagination page={page} pageCount={pageCount} total={table.data?.total ?? 0} onPageChange={setPage} />
        </div>
      )}

      <ProviderDetailSheet provider={selected} range={rangeQuery} onClose={() => setSelected(null)} />
    </div>
  );
}
