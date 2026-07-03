import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  CableIcon,
  KeyRoundIcon,
  LayersIcon,
  ScrollTextIcon,
} from "lucide-react";
import { listChannels } from "@/lib/api/channels";
import { getRoute } from "@/lib/api/routes";
import {
  getRouteOpsBindings,
  getRouteOpsChannelPool,
  getRouteOpsModels,
  getRouteOpsPerformance,
  getRouteOpsRequests,
} from "@/lib/api/routesOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { ConfigurableDataTable } from "@/components/data-table";
import { ServerDataTable } from "@/components/openstatus-table";
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
import { RouteChannelMarginTable } from "@/components/routes/RouteChannelMarginTable";
import { formatRouteRatioInput } from "@/components/routes/route-pricing";
import { DetailSideNav } from "@/components/common/DetailSideNav";
import {
  ChartSkeleton,
  ErrorBox,
  SectionEmpty,
  SectionFrame,
  TableSkeleton,
} from "@/components/common/detail-section";
import { PerformanceCharts, type PerfPoint } from "@/components/common/PerformanceCharts";

const PAGE_SIZE = 10;


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

function PoolSection({ routeId }: { routeId: number }) {
  const routeQ = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => getRoute(routeId),
  });
  const allChannelsQ = useQuery({
    queryKey: ["channels", "all-for-route-pool-detail"],
    queryFn: () => listChannels({ page: 1, pageSize: 200 }),
    enabled: routeQ.data?.pool_kind === "all",
  });
  const poolQ = useQuery({
    queryKey: ["route", routeId, "ops-pool"],
    queryFn: () => getRouteOpsChannelPool(routeId),
    enabled: routeQ.data?.pool_kind === "explicit",
  });

  const route = routeQ.data;
  const isAllPool = route?.pool_kind === "all";

  const marginChannels = useMemo(() => {
    if (!route) return [];
    if (isAllPool) {
      return (allChannelsQ.data?.items ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        provider_name: c.provider_name ?? "",
        protocol: c.protocol,
      }));
    }
    return route.channels.map((c) => ({
      id: c.channel_id,
      name: c.channel_name,
      provider_name: c.provider_slug,
      protocol: "",
    }));
  }, [route, isAllPool, allChannelsQ.data?.items]);

  const marginChannelIds = useMemo(
    () => marginChannels.map((c) => c.id),
    [marginChannels],
  );

  if (routeQ.isPending) return <TableSkeleton rows={6} cols={7} />;
  if (routeQ.isError) return <ErrorBox message={(routeQ.error as Error).message} />;
  if (!route) return null;

  if (!isAllPool && route.channels.length === 0) {
    return (
      <SectionEmpty
        icon={CableIcon}
        title="渠道池为空"
        description="为该线路添加渠道后即可在此查看成本与售价对比"
      />
    );
  }

  if (isAllPool && allChannelsQ.isPending) {
    return <TableSkeleton rows={6} cols={7} />;
  }
  if (isAllPool && allChannelsQ.isError) {
    return <ErrorBox message={(allChannelsQ.error as Error).message} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionFrame className="p-4">
        <div className="mb-3 flex flex-col gap-1">
          <div className="text-sm font-medium">
            {isAllPool ? "全量动态 · 成本与售价" : "渠道池 · 成本与售价"}
          </div>
          <p className="text-muted-foreground text-xs">
            {isAllPool
              ? "展示全部渠道的模型成本与客户售价（倍率 × 模型基准价）对比。"
              : `共 ${marginChannelIds.length} 个渠道 · 客户售价 = 模型基准 × ${formatRouteRatioInput(route.price_ratio)} 倍率`}
          </p>
        </div>
        <RouteChannelMarginTable
          readOnly
          channels={marginChannels}
          channelIds={marginChannelIds}
          priceRatio={route.price_ratio}
          fixedSingle={route.mode === "fixed"}
          tableMaxHeight="max-h-[min(480px,60vh)]"
        />
      </SectionFrame>

      {!isAllPool && poolQ.data && poolQ.data.length > 0 ? (
        <ConfigurableDataTable
          storageKey={`route:${routeId}:pool-meta`}
          data={poolQ.data}
          columns={routeOpsPoolColumns()}
          columnLabels={ROUTE_OPS_POOL_COLUMN_LABELS}
          layoutMode="content"
          bordered={false}
          getRowId={(row) => String(row.channel_id)}
          toolbarStart={
            <span className="text-muted-foreground text-sm tabular-nums">
              渠道状态与优先级
            </span>
          }
        />
      ) : null}
    </div>
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
