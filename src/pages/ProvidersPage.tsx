import { PlusIcon } from "lucide-react";
import { getProvidersOpsTable } from "@/lib/api/providersOps";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import {
  providerOsColumns,
  PROVIDER_OS_COLUMN_LABELS,
  PROVIDER_STATUS_OPTIONS,
} from "@/components/openstatus-table/providers-os-columns";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerTable } from "@/hooks/useServerTable";

export function ProvidersPage() {
  const table = useServerTable({
    queryKey: "providers",
    fetch: (p) => getProvidersOpsTable({ range: "all", ...p }),
    defaultSort: { id: "name", desc: false },
    statusOptions: PROVIDER_STATUS_OPTIONS,
    initialStatus: "enabled",
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {table.query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(table.query.error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <ServerDataTable
          storageKey="providers"
          columns={providerOsColumns()}
          data={table.items}
          columnLabels={PROVIDER_OS_COLUMN_LABELS}
          total={table.total}
          page={table.page}
          pageCount={table.pageCount}
          onPageChange={table.setPage}
          sorting={table.sorting}
          onSortingChange={table.setSorting}
          getRowId={(r) => String(r.id)}
          loading={table.query.isPending}
          refetching={table.query.isFetching && !table.query.isPending}
          emptyMessage="暂无服务商"
          searchValue={table.searchInput}
          onSearchChange={table.onSearchChange}
          searchPlaceholder="搜索名称 / slug"
          toolbarLeading={
            <ProviderFormDialog>
              <Button size="sm">
                <PlusIcon data-icon="inline-start" />
                新建服务商
              </Button>
            </ProviderFormDialog>
          }
          toolbarFilters={
            <FacetFilterButton
              label="状态"
              multiple={false}
              value={table.status ? [table.status] : []}
              options={[...table.statusOptions]}
              onChange={(v) => table.onStatusChange(v[0] ?? "")}
            />
          }
        />
      )}
    </div>
  );
}
