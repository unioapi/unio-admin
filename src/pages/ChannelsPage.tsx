import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { getChannelsOpsTable } from "@/lib/api/channelsOps";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import {
  channelOsColumns,
  CHANNEL_OS_COLUMN_LABELS,
  CHANNEL_STATUS_OPTIONS,
} from "@/components/openstatus-table/channels-os-columns";
import { ChannelFormDialog } from "@/components/channels/ChannelFormDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerTable } from "@/hooks/useServerTable";

export function ChannelsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const columns = useMemo(() => channelOsColumns(), []);
  const table = useServerTable({
    queryKey: "channels",
    fetch: (p) => getChannelsOpsTable({ range: "all", ...p }),
    statusOptions: CHANNEL_STATUS_OPTIONS,
    initialStatus: "enabled",
    // 不在此页做定时整表轮询：会整表重渲染，关掉「…」菜单并闪一下。
    // 熔断打开剩余由徽章本地倒计时；状态变化等下次进入/筛选取数即可。
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
          storageKey="channels"
          columns={columns}
          data={table.items}
          columnLabels={CHANNEL_OS_COLUMN_LABELS}
          total={table.total}
          page={table.page}
          pageCount={table.pageCount}
          onPageChange={table.setPage}
          sorting={table.sorting}
          onSortingChange={table.setSorting}
          getRowId={(r) => String(r.id)}
          loading={table.query.isPending}
          refetching={table.query.isFetching && !table.query.isPending}
          emptyMessage="暂无渠道"
          searchValue={table.searchInput}
          onSearchChange={table.onSearchChange}
          searchPlaceholder="搜索渠道名"
          toolbarLeading={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              新建渠道
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

      <ChannelFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
