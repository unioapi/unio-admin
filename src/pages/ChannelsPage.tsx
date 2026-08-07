import { useMemo, useState } from "react";
import { CableIcon, PlusIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getChannelsOpsTable } from "@/lib/api/channelsOps";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import {
  channelOsColumns,
  CHANNEL_OS_COLUMN_LABELS,
  CHANNEL_STATUS_OPTIONS,
} from "@/components/openstatus-table/channels-os-columns";
import { ChannelFormDialog } from "@/components/channels/ChannelFormDialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerTable } from "@/hooks/useServerTable";

export function ChannelsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const columns = useMemo(() => channelOsColumns(), []);
  const table = useServerTable({
    queryKey: "channels",
    fetch: (p) => getChannelsOpsTable({ range: "all", ...p }),
    statusOptions: CHANNEL_STATUS_OPTIONS,
    initialStatus: "enabled",
    // 不在此页做定时整表轮询：会整表重渲染，关掉「…」菜单并闪一下。
    // Redis breaker 实时事实在渠道详情和线路运行态页单独读取。
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
          emptyContent={<ChannelsEmpty />}
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

      <ChannelFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(channel) => navigate(`/channels/${channel.id}?section=models&setup=1`)}
      />
    </div>
  );
}

function ChannelsEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CableIcon />
        </EmptyMedia>
        <EmptyTitle>暂无渠道</EmptyTitle>
        <EmptyDescription>没有匹配当前筛选条件的渠道。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
