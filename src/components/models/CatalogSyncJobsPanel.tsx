import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { listSyncJobs } from "@/lib/api/capability";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable } from "@/components/openstatus-table";
import {
  syncJobOsColumns,
  SYNC_OS_COLUMN_LABELS,
} from "@/components/openstatus-table/system-os-columns";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PAGE_SIZE = 20;

// models.dev 目录同步任务记录（参考目录页「同步记录」Tab;原系统页迁入——
// 记录与触发入口(目录页的同步按钮)同屏,同步完直接看结果)。
export function CatalogSyncJobsPanel() {
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    urlKey: "models:catalog-sync-jobs",
    defaultSort: { id: "created_at", desc: true },
  });

  const query = useQuery({
    queryKey: ["system-sync-jobs", page, sort],
    queryFn: () => listSyncJobs({ page, pageSize: PAGE_SIZE, sort }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  return (
    <>
      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : (
        <ServerDataTable
          storageKey="models:catalog-sync-jobs"
          columns={syncJobOsColumns()}
          data={items}
          columnLabels={SYNC_OS_COLUMN_LABELS}
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(r) => String(r.id)}
          loading={query.isPending}
          refetching={query.isFetching && !query.isPending}
          emptyMessage="还没有同步任务"
          toolbarActions={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="刷新"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCwIcon className={query.isFetching ? "animate-spin" : undefined} />
            </Button>
          }
        />
      )}
    </>
  );
}
