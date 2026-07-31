import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getRoute } from "@/lib/api/routes";
import { getRouteOpsDetail } from "@/lib/api/routesOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { RouteDetailContent } from "@/components/routes/RouteDetailContent";
import { RouteDataSourceSubtitle } from "@/components/routes/RouteRuntimeSection";
import {
  RouteOverviewStats,
  RouteOverviewStatsSkeleton,
} from "@/components/routes/RouteOverviewStats";
import { RouteDetailActions } from "@/components/routes/RouteDetailActions";
import { ROUTE_MODE_LABEL } from "@/lib/routes/display";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatInt, formatPercent } from "@/lib/format";
import { formatRouteRatioInput } from "@/components/routes/route-pricing";
import type { Route } from "@/lib/api/routes";
import type { RouteOpsDetail } from "@/lib/api/routesOps";

export function RouteDetailPage() {
  const { routeId: routeIdParam } = useParams();
  const routeId = Number(routeIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };
  const validId = Number.isFinite(routeId) && routeId > 0;

  const routeQ = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => getRoute(routeId),
    enabled: validId,
  });

  const opsDetail = useQuery({
    queryKey: ["route", routeId, "ops-detail", rangeQuery],
    queryFn: () => getRouteOpsDetail(routeId, rangeQuery),
    placeholderData: keepPreviousData,
    enabled: routeQ.isSuccess,
  });

  if (!validId) {
    return <Navigate to="/routes" replace />;
  }

  const route = routeQ.data ?? null;
  const entityLoading = routeQ.isPending;
  const notFound = routeQ.isSuccess && route == null;
  const detail = opsDetail.data;

  const overviewSummary = opsDetail.isError ? (
    <p className="text-destructive text-sm">概览加载失败：{(opsDetail.error as Error).message}</p>
  ) : opsDetail.isPending && !opsDetail.data ? (
    <RouteOverviewStatsSkeleton />
  ) : detail ? (
    <RouteOverviewStats detail={detail} />
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/routes", label: "返回线路列表" }}
        title={route?.name ?? "详情"}
        titleLoading={entityLoading}
        badge={route ? <StatusBadge status={route.status} /> : null}
        subtitle={route ? <RouteDataSourceSubtitle routeId={route.id} /> : null}
        actions={
          route ? (
            <>
              <RangeFilter
                value={value}
                onChange={setRange}
                refreshedAt={refreshedAt}
                onRefresh={refresh}
                refreshLabel="刷新区间数据"
              />
              <RouteDetailActions route={route} />
            </>
          ) : (
            <RangeFilter
              value={value}
              onChange={setRange}
              refreshedAt={refreshedAt}
              onRefresh={refresh}
              refreshLabel="刷新区间数据"
            />
          )
        }
        summary={route ? overviewSummary : null}
      />

      {route ? <RouteContextCards route={route} detail={detail} /> : null}

      {routeQ.isError || opsDetail.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {((routeQ.error ?? opsDetail.error) as Error).message}
          </AlertDescription>
        </Alert>
      ) : notFound ? (
        <Alert variant="destructive">
          <AlertTitle>线路不存在</AlertTitle>
          <AlertDescription>
            <Link to="/routes" className="underline underline-offset-4">
              返回线路列表
            </Link>
          </AlertDescription>
        </Alert>
      ) : route ? (
        <RouteDetailContent routeId={route.id} range={rangeQuery} />
      ) : null}
    </div>
  );
}

function RouteContextCards({
  route,
  detail,
}: {
  route: Route;
  detail?: RouteOpsDetail;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card size="sm">
        <CardHeader>
          <CardTitle>线路策略</CardTitle>
          <CardDescription>决定候选池与客户售价。</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <ContextValue label="模式">{ROUTE_MODE_LABEL[route.mode] ?? route.mode}</ContextValue>
            <ContextValue label="售价倍率">×{formatRouteRatioInput(route.price_ratio)}</ContextValue>
          </dl>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>线路配置</CardTitle>
          <CardDescription>线路限额保留；渠道仅以并发作为硬容量门槛。</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <ContextValue label="绑定渠道">{formatInt(route.channels.length)}</ContextValue>
            <ContextValue label="并发">{formatLimit(route.concurrency_limit)}</ContextValue>
            <ContextValue label="RPM">{formatLimit(route.rpm_limit)}</ContextValue>
            <ContextValue label="RPD / TPM">{formatLimit(route.rpd_limit)} / {formatLimit(route.tpm_limit)}</ContextValue>
          </dl>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>运行概况</CardTitle>
          <CardDescription>当前页时间范围内的请求结果。</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <ContextValue label="请求">{formatInt(detail?.request_total)}</ContextValue>
            <ContextValue label="成功率">{detail ? formatPercent(detail.success_rate) : "—"}</ContextValue>
            <ContextValue label="回退">{formatInt(detail?.fallback_total)}</ContextValue>
            <ContextValue label="无渠道">{formatInt(detail?.no_channel_total)}</ContextValue>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function ContextValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

function formatLimit(value: number | null): string {
  if (value == null) return "继承默认";
  if (value === 0) return "不限";
  return formatInt(value);
}
