import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  CableIcon,
  CircleCheckIcon,
} from "lucide-react";
import {
  getProviderOpsChannels,
  getProviderOpsErrors,
  getProviderOpsPerformance,
} from "@/lib/api/providersOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { ConfigurableDataTable } from "@/components/data-table";
import { ServerDataTable } from "@/components/openstatus-table";
import {
  PROVIDER_OPS_CHANNEL_COLUMN_LABELS,
  PROVIDER_OPS_ERROR_COLUMN_LABELS,
  providerOpsChannelColumns,
  providerOpsErrorColumns,
} from "@/components/detail-tables/provider-detail-columns";
import { DetailSideNav } from "@/components/common/DetailSideNav";
import {
  ChartSkeleton,
  ErrorBox,
  SectionEmpty,
  TableSkeleton,
} from "@/components/common/detail-section";
import { PerformanceCharts, type PerfPoint } from "@/components/common/PerformanceCharts";

const PAGE_SIZE = 10;

export function ProviderDetailContent({
  providerId,
  range,
}: {
  providerId: number;
  range: RangeQuery;
}) {
  const sections = useMemo(
    () => [
      {
        id: "channels",
        label: "渠道",
        content: <ChannelsSection id={providerId} range={range} />,
      },
      {
        id: "performance",
        label: "性能",
        content: <PerformanceSection id={providerId} range={range} />,
      },
      {
        id: "errors",
        label: "错误",
        content: <ErrorsSection id={providerId} range={range} />,
      },
    ],
    [providerId, range],
  );

  return <DetailSideNav sections={sections} defaultSectionId="channels" />;
}

function ChannelsSection({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["provider", id, "ops-channels", range],
    queryFn: () => getProviderOpsChannels(id, range),
    placeholderData: keepPreviousData,
  });

  const channels = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => b.attempt_total - a.attempt_total),
    [q.data],
  );

  const enabledCount = channels.filter((c) => c.status === "enabled").length;

  if (q.isPending && !q.data) return <TableSkeleton rows={6} cols={6} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (channels.length === 0) {
    return (
      <SectionEmpty
        icon={CableIcon}
        title="暂无渠道"
        description="该服务商下还没有关联渠道，可前往渠道管理添加"
      />
    );
  }

  return (
    <ConfigurableDataTable
      storageKey={`provider:${id}:channels`}
      data={channels}
      columns={providerOpsChannelColumns()}
      columnLabels={PROVIDER_OPS_CHANNEL_COLUMN_LABELS}
      layoutMode="content"
      bordered={false}
      toolbarStart={
        <span className="text-muted-foreground text-sm tabular-nums">
          共 {channels.length} 个渠道 · {enabledCount} 个启用
        </span>
      }
    />
  );
}

function PerformanceSection({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["provider", id, "ops-perf", range],
    queryFn: () => getProviderOpsPerformance(id, range),
    placeholderData: keepPreviousData,
  });

  if (q.isPending && !q.data) return <ChartSkeleton />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (!q.data?.length) {
    return (
      <SectionEmpty
        icon={ActivityIcon}
        title="区间内暂无数据"
        description="扩大时间范围或等待该服务商产生请求后再查看"
      />
    );
  }

  const points: PerfPoint[] = q.data.map((p) => ({
    bucket: p.bucket,
    total: p.attempt_total,
    succeeded: p.attempt_succeeded,
    latencyMs: p.latency_avg,
  }));

  return (
    <PerformanceCharts
      points={points}
      totalLabel="尝试"
      totalStatLabel="总尝试"
      latencyLabel="平均延迟"
    />
  );
}

function ErrorsSection({ id, range }: { id: number; range: RangeQuery }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [range]);

  const q = useQuery({
    queryKey: ["provider", id, "ops-errors", range, page],
    queryFn: () => getProviderOpsErrors(id, { ...range, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const pageCount = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE_SIZE));

  if (q.isPending && !q.data) return <TableSkeleton rows={5} cols={5} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.items.length === 0) {
    return (
      <SectionEmpty
        icon={CircleCheckIcon}
        title="暂无错误"
        description="所选时间范围内没有失败请求，表现良好"
      />
    );
  }

  return (
    <ServerDataTable
      storageKey={`provider:${id}:errors`}
      columns={providerOpsErrorColumns()}
      data={q.data.items}
      columnLabels={PROVIDER_OPS_ERROR_COLUMN_LABELS}
      total={q.data.total}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      bordered={false}
      refetching={q.isFetching && !q.isPending}
      pinnedColumnId="at"
      getRowId={(row) => row.request_id}
    />
  );
}
