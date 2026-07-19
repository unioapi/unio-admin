import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  CableIcon,
  CircleCheckIcon,
} from "lucide-react";
import {
  getModelOpsChannels,
  getModelOpsPerformance,
  getModelOpsRequests,
} from "@/lib/api/modelsOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { useServerList } from "@/hooks/useServerList";
import { ConfigurableDataTable } from "@/components/data-table";
import { ServerDataTable } from "@/components/openstatus-table";
import {
  MODEL_OPS_CHANNEL_COLUMN_LABELS,
  MODEL_OPS_REQUEST_COLUMN_LABELS,
  modelOpsChannelColumns,
  modelOpsRequestColumns,
} from "@/components/detail-tables/model-detail-columns";
import { DetailSideNav } from "@/components/common/DetailSideNav";
import {
  ChartSkeleton,
  ErrorBox,
  SectionEmpty,
  TableSkeleton,
} from "@/components/common/detail-section";
import { PerformanceCharts, type PerfPoint } from "@/components/common/PerformanceCharts";

const PAGE_SIZE = 10;


export function ModelDetailContent({
  modelId,
  range,
}: {
  modelId: number;
  range: RangeQuery;
}) {
  const sections = useMemo(
    () => [
      {
        id: "channels",
        label: "渠道",
        content: <ChannelsSection modelId={modelId} range={range} />,
      },
      {
        id: "performance",
        label: "性能",
        content: <PerformanceSection modelId={modelId} range={range} />,
      },
      {
        id: "requests",
        label: "请求",
        content: <RequestsSection modelId={modelId} range={range} />,
      },
    ],
    [modelId, range],
  );

  return <DetailSideNav sections={sections} defaultSectionId="channels" />;
}

function ChannelsSection({ modelId, range }: { modelId: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["model", modelId, "ops-channels", range],
    queryFn: () => getModelOpsChannels(modelId, range),
    placeholderData: keepPreviousData,
  });

  const channels = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => b.attempt_total - a.attempt_total),
    [q.data],
  );

  if (q.isPending && !q.data) return <TableSkeleton rows={6} cols={7} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (channels.length === 0) {
    return (
      <SectionEmpty
        icon={CableIcon}
        title="暂无承载渠道"
        description="为该模型绑定渠道后即可在此查看运行表现"
      />
    );
  }

  return (
    <ConfigurableDataTable
      storageKey={`model:${modelId}:channels`}
      data={channels}
      columns={modelOpsChannelColumns()}
      columnLabels={MODEL_OPS_CHANNEL_COLUMN_LABELS}
      layoutMode="content"
      bordered={false}
      toolbarStart={
        <span className="text-muted-foreground text-sm tabular-nums">
          共 {channels.length} 个渠道
        </span>
      }
    />
  );
}

function PerformanceSection({ modelId, range }: { modelId: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["model", modelId, "ops-perf", range],
    queryFn: () => getModelOpsPerformance(modelId, range),
    placeholderData: keepPreviousData,
  });

  if (q.isPending && !q.data) return <ChartSkeleton />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (!q.data?.length) {
    return (
      <SectionEmpty
        icon={ActivityIcon}
        title="区间内暂无数据"
        description="扩大时间范围或等待该模型产生请求后再查看"
      />
    );
  }

  const points: PerfPoint[] = q.data.map((p) => ({
    bucket: p.bucket,
    total: p.request_total,
    succeeded: p.request_succeeded,
    latencyMs: p.latency_p95,
  }));

  return (
    <PerformanceCharts
      points={points}
      totalLabel="请求"
      totalStatLabel="总请求"
      latencyLabel="P95 延迟"
    />
  );
}

function RequestsSection({ modelId, range }: { modelId: number; range: RangeQuery }) {
  const { page, setPage } = useServerList({
    urlKey: `model:${modelId}:requests`,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    setPage(1);
  }, [range, setPage]);

  const q = useQuery({
    queryKey: ["model", modelId, "ops-requests", range, page],
    queryFn: () => getModelOpsRequests(modelId, { ...range, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (q.isPending && !q.data) return <TableSkeleton rows={5} cols={4} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (total === 0) {
    return (
      <SectionEmpty
        icon={CircleCheckIcon}
        title="暂无请求"
        description="所选时间范围内没有该模型的请求记录"
      />
    );
  }

  return (
    <ServerDataTable
      storageKey={`model:${modelId}:requests`}
      columns={modelOpsRequestColumns()}
      data={q.data?.items ?? []}
      columnLabels={MODEL_OPS_REQUEST_COLUMN_LABELS}
      total={total}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      bordered={false}
      showViewOptions={false}
      refetching={q.isFetching && !q.isPending}
      pinnedColumnId="at"
      getRowId={(row) => row.request_id}
    />
  );
}
