import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  BoxIcon,
  CircleCheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  RouteIcon,
  ScrollTextIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getChannel, type Channel } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import type { ChannelOpsRow, ChannelCircuitBreakerStatus } from "@/lib/api/channelsOps";
import {
  getChannelOpsErrors,
  getChannelOpsModels,
  getChannelOpsPerformance,
  getChannelOpsRoutes,
} from "@/lib/api/channelsOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { formatRelativeTime } from "@/lib/format";
import { ConfigurableDataTable } from "@/components/data-table";
import { ServerDataTable } from "@/components/openstatus-table";
import {
  CHANNEL_OPS_ERROR_COLUMN_LABELS,
  CHANNEL_OPS_MODEL_COLUMN_LABELS,
  CHANNEL_OPS_ROUTE_COLUMN_LABELS,
  channelOpsErrorColumns,
  channelOpsModelColumns,
  channelOpsRouteColumns,
} from "@/components/detail-tables/channel-detail-columns";
import { ChannelOverviewSection } from "@/components/channels/ChannelOverviewSection";
import { ChannelTestSection } from "@/components/channels/ChannelTestSection";
import { DetailSideNav } from "@/components/common/DetailSideNav";
import {
  ChartSkeleton,
  ErrorBox,
  SectionEmpty,
  SectionFrame,
  TableSkeleton,
} from "@/components/common/detail-section";
import { PerformanceCharts, type PerfPoint } from "@/components/common/PerformanceCharts";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyMedia } from "@/components/ui/empty";

const PAGE_SIZE = 10;

export function ChannelDetailContent({
  channelId,
  channel,
  range,
  opsRow,
  circuitBreaker,
}: {
  channelId: number;
  channel: Channel;
  range: RangeQuery;
  opsRow?: ChannelOpsRow | null;
  circuitBreaker?: ChannelCircuitBreakerStatus | null;
}) {
  const sections = useMemo(
    () => [
      {
        id: "overview",
        label: "概览",
        content: (
          <ChannelOverviewSection
            channel={channel}
            opsRow={opsRow}
            circuitBreaker={circuitBreaker}
          />
        ),
      },
      {
        id: "test",
        label: "检测",
        content: <ChannelTestSection channel={channel} />,
      },
      {
        id: "performance",
        label: "性能",
        content: <PerformanceSection channelId={channelId} range={range} />,
      },
      {
        id: "errors",
        label: "错误",
        content: <ErrorsSection channelId={channelId} range={range} />,
      },
      {
        id: "models",
        label: "模型",
        content: <ModelsSection channelId={channelId} range={range} />,
      },
      {
        id: "routes",
        label: "线路",
        content: <RoutesSection channelId={channelId} />,
      },
      {
        id: "credential",
        label: "凭据",
        content: <CredentialSection channelId={channelId} />,
      },
      {
        id: "audit",
        label: "审计",
        content: <AuditSection />,
      },
    ],
    [channelId, channel, range, opsRow, circuitBreaker],
  );

  return <DetailSideNav sections={sections} defaultSectionId="overview" />;
}

function PerformanceSection({
  channelId,
  range,
}: {
  channelId: number;
  range: RangeQuery;
}) {
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-perf", range],
    queryFn: () => getChannelOpsPerformance(channelId, range),
    placeholderData: keepPreviousData,
  });

  if (q.isPending && !q.data) return <ChartSkeleton />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (!q.data?.length) {
    return (
      <SectionEmpty
        icon={ActivityIcon}
        title="区间内暂无数据"
        description="扩大时间范围或等待该渠道产生请求后再查看"
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

function ErrorsSection({ channelId, range }: { channelId: number; range: RangeQuery }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [range]);

  const q = useQuery({
    queryKey: ["channel", channelId, "ops-errors", range, page],
    queryFn: () => getChannelOpsErrors(channelId, { ...range, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const pageCount = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE_SIZE));

  if (q.isPending && !q.data) return <TableSkeleton rows={5} cols={5} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  const errors = q.data;
  if (!errors || errors.items.length === 0) {
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
      storageKey={`channel:${channelId}:errors`}
      columns={channelOpsErrorColumns()}
      data={errors.items}
      columnLabels={CHANNEL_OPS_ERROR_COLUMN_LABELS}
      total={errors.total}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      bordered={false}
      refetching={q.isFetching && !q.isPending}
      pinnedColumnId="at"
    />
  );
}

function ModelsSection({ channelId, range }: { channelId: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-models", range],
    queryFn: () => getChannelOpsModels(channelId, range),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const models = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => b.attempt_total - a.attempt_total),
    [q.data],
  );

  if (q.isPending && !q.data) return <TableSkeleton rows={5} cols={6} />;
  if (q.isError) return <ErrorBox message={apiErrorMessage(q.error)} />;
  if (models.length === 0) {
    return (
      <SectionEmpty
        icon={BoxIcon}
        title="暂无绑定模型"
        description="为该渠道绑定模型后即可在此查看运行表现"
      />
    );
  }

  return (
    <ConfigurableDataTable
      storageKey={`channel:${channelId}:models`}
      data={models}
      columns={channelOpsModelColumns()}
      columnLabels={CHANNEL_OPS_MODEL_COLUMN_LABELS}
      layoutMode="content"
      bordered={false}
      toolbarStart={
        <span className="text-muted-foreground text-sm tabular-nums">
          共 {models.length} 个模型
        </span>
      }
    />
  );
}

function RoutesSection({ channelId }: { channelId: number }) {
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-routes"],
    queryFn: () => getChannelOpsRoutes(channelId),
  });

  if (q.isPending) return <TableSkeleton rows={4} cols={4} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0) {
    return (
      <SectionEmpty
        icon={RouteIcon}
        title="无显式线路引用"
        description="全量动态线路会按模型自动纳入本渠道"
      />
    );
  }

  return (
    <ConfigurableDataTable
      storageKey={`channel:${channelId}:routes`}
      data={q.data}
      columns={channelOpsRouteColumns()}
      columnLabels={CHANNEL_OPS_ROUTE_COLUMN_LABELS}
      layoutMode="content"
      bordered={false}
      toolbarStart={
        <span className="text-muted-foreground text-sm tabular-nums">
          共 {q.data.length} 条线路
        </span>
      }
    />
  );
}

function CredentialSection({ channelId }: { channelId: number }) {
  const channelQ = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => getChannel(channelId),
  });
  const [revealed, setRevealed] = useState(false);

  if (channelQ.isPending) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (channelQ.isError) return <ErrorBox message={(channelQ.error as Error).message} />;

  const channel = channelQ.data;
  if (!channel) return null;

  async function copyCredential() {
    if (!channel?.credential) return;
    try {
      await navigator.clipboard.writeText(channel.credential);
      toast.success("已复制凭据到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择复制");
    }
  }

  return (
    <SectionFrame className="p-4">
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex items-start gap-3">
          <EmptyMedia variant="icon">
            <KeyRoundIcon />
          </EmptyMedia>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-medium">凭据（上游 API Key）</p>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 truncate rounded-md px-3 py-2 font-mono text-sm">
                {revealed ? channel.credential || "—" : "••••••••••••••••"}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={revealed ? "隐藏" : "显示"}
                onClick={() => setRevealed((v) => !v)}
              >
                {revealed ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="复制凭据"
                onClick={copyCredential}
              >
                <CopyIcon />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              明文存储，可查看/复制；如需修改请用「轮换凭据」。最近更新：
              {channel.updated_at ? formatRelativeTime(channel.updated_at) : "—"}。
            </p>
          </div>
        </div>
      </div>
    </SectionFrame>
  );
}

function AuditSection() {
  return (
    <SectionEmpty
      icon={ScrollTextIcon}
      title="审计日志"
      description="审计功能规划中（P1）"
    />
  );
}
