import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { getRoute } from "@/lib/api/routes";
import { getRouteOpsDetail, getRoutesOpsTable } from "@/lib/api/routesOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { RouteDetailContent } from "@/components/routes/RouteDetailContent";
import {
  RouteOverviewStats,
  RouteOverviewStatsSkeleton,
} from "@/components/routes/RouteOverviewStats";
import { RouteDetailActions } from "@/components/routes/RouteDetailActions";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MODE_LABEL: Record<string, string> = {
  cheapest: "经济",
  stable: "稳定",
  fixed: "固定",
};

export function RouteDetailPage() {
  const { routeId: routeIdParam } = useParams();
  const routeId = Number(routeIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };

  if (!Number.isFinite(routeId) || routeId <= 0) {
    return <Navigate to="/routes" replace />;
  }

  const routeQ = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => getRoute(routeId),
  });

  const opsDetail = useQuery({
    queryKey: ["route", routeId, "ops-detail", rangeQuery],
    queryFn: () => getRouteOpsDetail(routeId, rangeQuery),
    placeholderData: keepPreviousData,
    enabled: routeQ.isSuccess,
  });

  const opsRow = useQuery({
    queryKey: ["routes", routeId, "ops-row", rangeQuery],
    queryFn: async () => {
      const res = await getRoutesOpsTable({ ...rangeQuery, page: 1, page_size: 500 });
      return res.items.find((r) => r.id === routeId) ?? null;
    },
    enabled: routeQ.isSuccess,
  });

  const route = routeQ.data ?? null;
  const entityLoading = routeQ.isPending;
  const notFound = routeQ.isSuccess && route == null;

  const overviewSummary =
    opsDetail.isPending && !opsDetail.data ? (
      <RouteOverviewStatsSkeleton />
    ) : opsDetail.data ? (
      <RouteOverviewStats detail={opsDetail.data} />
    ) : null;

  const subtitle = route ? (
    <>
      {MODE_LABEL[route.mode] ?? route.mode} ·{" "}
      {route.pool_kind === "all" ? "全量动态" : "手挑渠道"}
      {opsRow.data
        ? ` · 绑定 用户 ${opsRow.data.bound_users} / Key ${opsRow.data.bound_keys}`
        : ""}
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
              <Badge variant={route.status === "enabled" ? "default" : "outline"}>
                {route.status === "enabled" ? "启用" : "停用"}
              </Badge>
              {route.status === "enabled" && opsRow.data ? (
                opsRow.data.serviceable ? (
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
