import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { getChannel, type Channel } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import type { ChannelOpsRow } from "@/lib/api/channelsOps";
import {
  getChannelOpsErrors,
  getChannelOpsModels,
  getChannelOpsPerformance,
  getChannelOpsRoutes,
} from "@/lib/api/channelsOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { formatCompact, formatLatencySec, formatRelativeTime } from "@/lib/format";
import { ConfigurableDataTable, ServerDataTable } from "@/components/data-table";
import {
  CHANNEL_OPS_ERROR_COLUMN_LABELS,
  CHANNEL_OPS_MODEL_COLUMN_LABELS,
  CHANNEL_OPS_ROUTE_COLUMN_LABELS,
  channelOpsErrorColumns,
  channelOpsModelColumns,
  channelOpsRouteColumns,
} from "@/components/detail-tables/channel-detail-columns";
import { AttemptSuccessRateCell } from "@/components/ops-tables/AttemptSuccessRateCell";
import { ChannelOverviewSection } from "@/components/channels/ChannelOverviewSection";
import { DetailSideNav } from "@/components/common/DetailSideNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function fmtTs(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function SectionFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl ring-1 ring-foreground/10", className)}>
      {children}
    </div>
  );
}

function SectionEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BoxIcon;
  title: string;
  description?: string;
}) {
  return (
    <Empty className="border py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>加载失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <SectionFrame className="p-4">
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-3">
            {Array.from({ length: cols }).map((__, col) => (
              <Skeleton key={col} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  );
}

export function ChannelDetailContent({
  channelId,
  channel,
  range,
  opsRow,
}: {
  channelId: number;
  channel: Channel;
  range: RangeQuery;
  opsRow?: ChannelOpsRow | null;
}) {
  const sections = useMemo(
    () => [
      {
        id: "overview",
        label: "概览",
        content: <ChannelOverviewSection channel={channel} opsRow={opsRow} />,
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
    [channelId, channel, range, opsRow],
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

  const summary = useMemo(() => {
    if (!q.data?.length) return null;
    const attempt_total = q.data.reduce((sum, point) => sum + point.attempt_total, 0);
    const attempt_succeeded = q.data.reduce((sum, point) => sum + point.attempt_succeeded, 0);
    const latencyPoints = q.data.filter((point) => point.latency_avg > 0);
    const latency_avg = latencyPoints.length
      ? latencyPoints.reduce((sum, point) => sum + point.latency_avg, 0) / latencyPoints.length
      : 0;
    return {
      attempt_total,
      attempt_succeeded,
      success_rate: attempt_total ? attempt_succeeded / attempt_total : 0,
      latency_avg,
    };
  }, [q.data]);

  const latencyChartData = useMemo(
    () =>
      (q.data ?? []).map((point) => ({
        bucket: point.bucket,
        latency_avg: point.latency_avg / 1000,
      })),
    [q.data],
  );

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

  const reqConfig: ChartConfig = {
    attempt_total: { label: "尝试", color: "var(--chart-1)" },
    attempt_succeeded: { label: "成功", color: "var(--chart-2)" },
  };
  const latConfig: ChartConfig = { latency_avg: { label: "平均延迟 (s)", color: "var(--chart-3)" } };

  return (
    <div className="flex flex-col gap-4">
      {summary ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="text-muted-foreground text-xs">总尝试</div>
            <div className="font-heading mt-0.5 text-sm font-semibold tabular-nums">
              {formatCompact(summary.attempt_total)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="text-muted-foreground text-xs">成功率</div>
            <div className="mt-0.5">
              <AttemptSuccessRateCell
                attemptTotal={summary.attempt_total}
                attemptSucceeded={summary.attempt_succeeded}
                successRate={summary.success_rate}
                className="text-sm"
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="text-muted-foreground text-xs">平均延迟</div>
            <div className="font-heading mt-0.5 text-sm font-semibold tabular-nums">
              {summary.latency_avg > 0 ? formatLatencySec(summary.latency_avg) : "—"}
            </div>
          </div>
        </div>
      ) : null}

      <SectionFrame className="p-4">
        <div className="text-muted-foreground mb-2 text-xs font-medium">请求量</div>
        <ChartContainer config={reqConfig} className="h-[200px] w-full">
          <AreaChart data={q.data} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={fmtTs}
            />
            <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent labelFormatter={(_, p) => fmtTs(String(p?.[0]?.payload.bucket))} />
              }
            />
            <Area
              dataKey="attempt_total"
              type="monotone"
              stroke="var(--color-attempt_total)"
              fill="var(--color-attempt_total)"
              fillOpacity={0.15}
            />
            <Area
              dataKey="attempt_succeeded"
              type="monotone"
              stroke="var(--color-attempt_succeeded)"
              fill="var(--color-attempt_succeeded)"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ChartContainer>
      </SectionFrame>

      <SectionFrame className="p-4">
        <div className="text-muted-foreground mb-2 text-xs font-medium">平均延迟</div>
        <ChartContainer config={latConfig} className="h-[200px] w-full">
          <LineChart data={latencyChartData} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={fmtTs}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value) => `${Number(value).toFixed(1)}s`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => fmtTs(String(p?.[0]?.payload.bucket))}
                  formatter={(value) => `${Number(value).toFixed(2)}s`}
                />
              }
            />
            <Line
              dataKey="latency_avg"
              type="monotone"
              stroke="var(--color-latency_avg)"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </SectionFrame>
    </div>
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
