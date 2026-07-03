import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { getRoute } from "@/lib/api/routes";
import { getRouteOpsDetail } from "@/lib/api/routesOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { RouteDetailContent } from "@/components/routes/RouteDetailContent";
import {
  RouteOverviewStats,
  RouteOverviewStatsSkeleton,
} from "@/components/routes/RouteOverviewStats";
import { RouteDetailActions } from "@/components/routes/RouteDetailActions";
import { ROUTE_MODE_LABEL, routePoolKindLabel } from "@/lib/routes/display";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  const subtitle = route ? (
    <>
      {ROUTE_MODE_LABEL[route.mode] ?? route.mode} ·{" "}
      {routePoolKindLabel(route.pool_kind, route.mode)}
      {route.description ? ` · ${route.description}` : ""}
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/routes", label: "返回线路列表" }}
        title={route?.name ?? "详情"}
        titleLoading={entityLoading}
        badge={
          route ? (
            <>
              <StatusBadge status={route.status} />
              {detail && route.status === "enabled" ? (
                detail.serviceable ? (
                  <Badge variant="default">可服务</Badge>
                ) : (
                  <Badge variant="destructive">异常</Badge>
                )
              ) : null}
            </>
          ) : null
        }
        subtitle={route ? subtitle : null}
        actions={
          route ? (
            <>
              <RangeFilter
                value={value}
                onChange={setRange}
                refreshedAt={refreshedAt}
                onRefresh={refresh}
              />
              <RouteDetailActions route={route} />
            </>
          ) : (
            <RangeFilter
              value={value}
              onChange={setRange}
              refreshedAt={refreshedAt}
              onRefresh={refresh}
            />
          )
        }
        summary={route ? overviewSummary : null}
      />

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
