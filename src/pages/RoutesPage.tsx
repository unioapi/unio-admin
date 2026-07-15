import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { getRoutesOpsTable } from "@/lib/api/routesOps";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import {
  routeOsColumns,
  ROUTE_OS_COLUMN_LABELS,
  ROUTE_STATUS_OPTIONS,
} from "@/components/openstatus-table/routes-os-columns";
import { RouteFormDialog } from "@/components/routes/RouteFormDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerTable } from "@/hooks/useServerTable";

export function RoutesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const table = useServerTable({
    queryKey: "routes",
    fetch: (p) => getRoutesOpsTable({ range: "all", ...p }),
    defaultSort: { id: "name", desc: false },
    statusOptions: ROUTE_STATUS_OPTIONS,
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
          storageKey="routes"
          columns={routeOsColumns()}
          data={table.items}
          columnLabels={ROUTE_OS_COLUMN_LABELS}
          total={table.total}
          page={table.page}
          pageCount={table.pageCount}
          onPageChange={table.setPage}
          sorting={table.sorting}
          onSortingChange={table.setSorting}
          getRowId={(r) => String(r.id)}
          loading={table.query.isPending}
          refetching={table.query.isFetching && !table.query.isPending}
          emptyMessage="暂无线路"
          searchValue={table.searchInput}
          onSearchChange={table.onSearchChange}
          searchPlaceholder="搜索线路名"
          chips={table.chips}
          onClearChips={table.resetFilters}
          toolbarLeading={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              新建线路
            </Button>
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

      <RouteFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        route={null}
        onSaved={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["routes"] });
        }}
      />
    </div>
  );
}
