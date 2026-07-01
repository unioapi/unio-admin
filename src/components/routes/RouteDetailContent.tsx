import { useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  BoxIcon,
  CableIcon,
  KeyRoundIcon,
  LayersIcon,
  ScrollTextIcon,
} from "lucide-react";
import { getRoute } from "@/lib/api/routes";
import {
  getRouteOpsBindings,
  getRouteOpsChannelPool,
  getRouteOpsModels,
  getRouteOpsPerformance,
  getRouteOpsRequests,
} from "@/lib/api/routesOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { formatCompact, formatLatencyMs } from "@/lib/format";
import { ConfigurableDataTable, ServerDataTable } from "@/components/data-table";
import {
  ROUTE_OPS_KEY_COLUMN_LABELS,
  ROUTE_OPS_MODEL_COLUMN_LABELS,
  ROUTE_OPS_POOL_COLUMN_LABELS,
  ROUTE_OPS_REQUEST_COLUMN_LABELS,
  routeOpsKeyColumns,
  routeOpsModelColumns,
  routeOpsPoolColumns,
  routeOpsRequestColumns,
} from "@/components/detail-tables/route-detail-columns";
import { AttemptSuccessRateCell } from "@/components/ops-tables/AttemptSuccessRateCell";
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
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
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

export function RouteDetailContent({
  routeId,
  range,
}: {
  routeId: number;
  range: RangeQuery;
}) {
  const sections = useMemo(
    () => [
      {
        id: "performance",
        label: "性能",
        content: <PerformanceSection routeId={routeId} range={range} />,
      },
      {
        id: "pool",
        label: "渠道池",
        content: <PoolSection routeId={routeId} />,
      },
      {
        id: "models",
        label: "模型",
        content: <ModelsSection routeId={routeId} range={range} />,
      },
      {
        id: "bindings",
        label: "绑定",
        content: <BindingsSection routeId={routeId} />,
      },
      {
        id: "requests",
        label: "请求",
        content: <RequestsSection routeId={routeId} range={range} />,
      },
    ],
    [routeId, range],
  );

  return <DetailSideNav sections={sections} defaultSectionId="performance" />;
}

function PerformanceSection({
  routeId,
  range,
}: {
  routeId: number;
  range: RangeQuery;
}) {
  const q = useQuery({
    queryKey: ["route", routeId, "ops-perf", range],
    queryFn: () => getRouteOpsPerformance(routeId, range),
    placeholderData: keepPreviousData,
  });

  const summary = useMemo(() => {
    if (!q.data?.length) return null;
    const request_total = q.data.reduce((sum, point) => sum + point.request_total, 0);
    const request_succeeded = q.data.reduce((sum, point) => sum + point.request_succeeded, 0);
    const latencyPoints = q.data.filter((point) => point.latency_p95 > 0);
    const latency_p95 = latencyPoints.length
      ? latencyPoints.reduce((sum, point) => sum + point.latency_p95, 0) / latencyPoints.length
      : 0;
    return {
      request_total,
      request_succeeded,
      success_rate: request_total ? request_succeeded / request_total : 0,
      latency_p95,
    };
  }, [q.data]);

  const latencyChartData = useMemo(
    () =>
      (q.data ?? []).map((point) => ({
        bucket: point.bucket,
        latency_p95: point.latency_p95 / 1000,
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
        description="扩大时间范围或等待该线路产生请求后再查看"
      />
    );
  }

  const reqConfig: ChartConfig = {
    request_total: { label: "请求", color: "var(--chart-1)" },
    request_succeeded: { label: "成功", color: "var(--chart-2)" },
  };
  const latConfig: ChartConfig = {
    latency_p95: { label: "P95 (s)", color: "var(--chart-3)" },
  };

  return (
    <div className="flex flex-col gap-4">
      {summary ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="text-muted-foreground text-xs">总请求</div>
            <div className="font-heading mt-0.5 text-sm font-semibold tabular-nums">
              {formatCompact(summary.request_total)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="text-muted-foreground text-xs">成功率</div>
            <div className="mt-0.5">
              <AttemptSuccessRateCell
                attemptTotal={summary.request_total}
                attemptSucceeded={summary.request_succeeded}
                successRate={summary.success_rate}
                className="text-sm"
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <div className="text-muted-foreground text-xs">平均 P95</div>
            <div className="font-heading mt-0.5 text-sm font-semibold tabular-nums">
              {summary.latency_p95 > 0 ? formatLatencyMs(summary.latency_p95) : "—"}
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
              dataKey="request_total"
              type="monotone"
              stroke="var(--color-request_total)"
              fill="var(--color-request_total)"
              fillOpacity={0.15}
            />
            <Area
              dataKey="request_succeeded"
              type="monotone"
              stroke="var(--color-request_succeeded)"
              fill="var(--color-request_succeeded)"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ChartContainer>
      </SectionFrame>

      <SectionFrame className="p-4">
        <div className="text-muted-foreground mb-2 text-xs font-medium">P95 延迟</div>
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
            <YAxis tickLine={false} axisLine={false} width={44} />
            <ChartTooltip
              content={
                <ChartTooltipContent labelFormatter={(_, p) => fmtTs(String(p?.[0]?.payload.bucket))} />
              }
            />
            <Line
              dataKey="latency_p95"
              type="monotone"
              stroke="var(--color-latency_p95)"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      </SectionFrame>
    </div>
  );
}

function PoolSection({ routeId }: { routeId: number }) {
  const routeQ = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => getRoute(routeId),
  });
  const poolQ = useQuery({
    queryKey: ["route", routeId, "ops-pool"],
    queryFn: () => getRouteOpsChannelPool(routeId),
    enabled: routeQ.data?.pool_kind === "explicit",
  });

  if (routeQ.isPending) return <TableSkeleton rows={4} cols={4} />;
  if (routeQ.isError) return <ErrorBox message={(routeQ.error as Error).message} />;

  if (routeQ.data?.pool_kind === "all") {
    return (
      <SectionEmpty
        icon={CableIcon}
        title="全量动态线路"
        description="自动使用每个模型的全部可用渠道，无固定渠道池"
      />
    );
  }

  if (poolQ.isPending) return <TableSkeleton rows={5} cols={5} />;
  if (poolQ.isError) return <ErrorBox message={(poolQ.error as Error).message} />;
  if (poolQ.data.length === 0) {
    return (
      <SectionEmpty
        icon={CableIcon}
        title="渠道池为空"
        description="为该线路添加渠道后即可在此查看"
      />
    );
  }

  return (
    <ConfigurableDataTable
      storageKey={`route:${routeId}:pool`}
      data={poolQ.data}
      columns={routeOpsPoolColumns()}
      columnLabels={ROUTE_OPS_POOL_COLUMN_LABELS}
      layoutMode="content"
      bordered={false}
      getRowId={(row) => String(row.channel_id)}
      toolbarStart={
        <span className="text-muted-foreground text-sm tabular-nums">
          共 {poolQ.data.length} 个渠道
        </span>
      }
    />
  );
}

function ModelsSection({ routeId, range }: { routeId: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["route", routeId, "ops-models", range],
    queryFn: () => getRouteOpsModels(routeId, range),
    placeholderData: keepPreviousData,
  });

  const models = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => b.request_total - a.request_total),
    [q.data],
  );

  if (q.isPending && !q.data) return <TableSkeleton rows={5} cols={4} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (models.length === 0) {
    return (
      <SectionEmpty
        icon={LayersIcon}
        title="区间内暂无模型流量"
        description="扩大时间范围或等待该线路产生请求后再查看"
      />
    );
  }

  return (
    <ConfigurableDataTable
      storageKey={`route:${routeId}:models`}
      data={models}
      columns={routeOpsModelColumns()}
      columnLabels={ROUTE_OPS_MODEL_COLUMN_LABELS}
      layoutMode="content"
      bordered={false}
      getRowId={(row) => row.model_id}
      toolbarStart={
        <span className="text-muted-foreground text-sm tabular-nums">
          共 {models.length} 个模型
        </span>
      }
    />
  );
}

function BindingsSection({ routeId }: { routeId: number }) {
  const q = useQuery({
    queryKey: ["route", routeId, "ops-bindings"],
    queryFn: () => getRouteOpsBindings(routeId),
  });

  if (q.isPending) return <TableSkeleton rows={4} cols={4} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;

  const { keys } = q.data;

  return (
    <div className="flex flex-col gap-4">
      {keys.length === 0 ? (
        <SectionEmpty
          icon={KeyRoundIcon}
          title="暂无绑定 Key"
          description="用户创建 API Key 并选择本线路后，将在此展示"
        />
      ) : (
        <ConfigurableDataTable
          storageKey={`route:${routeId}:keys`}
          data={keys}
          columns={routeOpsKeyColumns()}
          columnLabels={ROUTE_OPS_KEY_COLUMN_LABELS}
          layoutMode="content"
          bordered={false}
          getRowId={(row) => String(row.id)}
          toolbarStart={
            <span className="text-muted-foreground text-sm tabular-nums">
              共 {keys.length} 个 Key
            </span>
          }
        />
      )}
      <p className="text-muted-foreground text-xs">
        改线路前请确认上述绑定不受影响。
      </p>
    </div>
  );
}

function RequestsSection({ routeId, range }: { routeId: number; range: RangeQuery }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [range]);

  const q = useQuery({
    queryKey: ["route", routeId, "ops-requests", range, page],
    queryFn: () => getRouteOpsRequests(routeId, { ...range, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const pageCount = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE_SIZE));

  if (q.isPending && !q.data) return <TableSkeleton rows={6} cols={6} />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.items.length === 0) {
    return (
      <SectionEmpty
        icon={ScrollTextIcon}
        title="区间内暂无请求"
        description="扩大时间范围或等待该线路产生请求后再查看"
      />
    );
  }

  return (
    <ServerDataTable
      storageKey={`route:${routeId}:requests`}
      columns={routeOpsRequestColumns()}
      data={q.data.items}
      columnLabels={ROUTE_OPS_REQUEST_COLUMN_LABELS}
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
