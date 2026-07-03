import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { LibraryIcon, PlusIcon } from "lucide-react";
import { getModelsOpsTable } from "@/lib/api/modelsOps";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import {
  modelOsColumns,
  MODEL_OS_COLUMN_LABELS,
} from "@/components/openstatus-table/models-os-columns";
import { ModelFormDialog } from "@/components/models/ModelFormDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerTable, ENTITY_STATUS_OPTIONS } from "@/hooks/useServerTable";

export function ModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const qParam = searchParams.get("q") ?? "";

  useEffect(() => {
    if (qParam) {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          sp.delete("q");
          return sp;
        },
        { replace: true },
      );
    }
  }, [qParam, setSearchParams]);

  const table = useServerTable({
    queryKey: "models",
    fetch: (p) => getModelsOpsTable({ range: "all", ...p }),
    defaultSort: { id: "name", desc: false },
    statusOptions: ENTITY_STATUS_OPTIONS,
  });

  if (searchParams.get("tab") === "catalog") {
    return <Navigate to="/models/catalog" replace />;
  }

  if (table.query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{(table.query.error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ServerDataTable
        storageKey="models"
        columns={modelOsColumns()}
        data={table.items}
        columnLabels={MODEL_OS_COLUMN_LABELS}
        total={table.total}
        page={table.page}
        pageCount={table.pageCount}
        onPageChange={table.setPage}
        sorting={table.sorting}
        onSortingChange={table.setSorting}
        getRowId={(r) => String(r.id)}
        loading={table.query.isPending}
        refetching={table.query.isFetching && !table.query.isPending}
        emptyMessage="暂无模型"
        searchValue={table.searchInput}
        onSearchChange={table.onSearchChange}
        searchPlaceholder="搜索模型 ID / 名称"
        chips={table.chips}
        onClearChips={table.resetFilters}
        toolbarLeading={
          <>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              新建模型
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/models/catalog">
                <LibraryIcon data-icon="inline-start" />
                参考模型
              </Link>
            </Button>
          </>
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
      <ModelFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
