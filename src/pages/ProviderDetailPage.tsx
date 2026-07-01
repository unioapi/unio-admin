import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import type { Provider } from "@/lib/api/providers";
import { listAllProviders } from "@/lib/api/providers";
import { getProviderOpsDetail, type ProviderOpsRow } from "@/lib/api/providersOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { ProviderDetailContent } from "@/components/providers/ProviderDetailContent";
import {
  ProviderOverviewStats,
  ProviderOverviewStatsSkeleton,
} from "@/components/providers/ProviderOverviewStats";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function providerStubFromList(
  p: Provider,
  detail?: Awaited<ReturnType<typeof getProviderOpsDetail>>,
): ProviderOpsRow {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    created_at: p.created_at,
    channel_total: detail?.channel_total ?? 0,
    channel_enabled: detail?.channel_enabled ?? 0,
    attempt_total: detail?.attempt_total ?? 0,
    attempt_succeeded: detail?.attempt_succeeded ?? 0,
    success_rate: detail?.success_rate ?? 0,
    timeout_total: detail?.timeout_total ?? 0,
    latency: detail?.latency ?? {
      avg: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      sample: 0,
      coverage: 0,
    },
    health: "no_data",
    tokens: 0,
    revenue_usd: "0",
    cost_usd: "0",
    margin_usd: "0",
    avg_tps: 0,
  };
}

export function ProviderDetailPage() {
  const { providerId: providerIdParam } = useParams();
  const providerId = Number(providerIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };

  if (!Number.isFinite(providerId) || providerId <= 0) {
    return <Navigate to="/providers" replace />;
  }

  const allProviders = useQuery({
    queryKey: ["providers", "all"],
    queryFn: listAllProviders,
  });
  const opsDetail = useQuery({
    queryKey: ["providers", providerId, "ops-detail", rangeQuery],
    queryFn: () => getProviderOpsDetail(providerId, rangeQuery),
    placeholderData: keepPreviousData,
  });

  const providerEntity = useMemo(
    () => allProviders.data?.find((x) => x.id === providerId) ?? null,
    [allProviders.data, providerId],
  );

  const provider = useMemo(() => {
    if (!providerEntity) return null;
    return providerStubFromList(providerEntity, opsDetail.data);
  }, [providerEntity, opsDetail.data]);

  const entityLoading = allProviders.isPending;
  const notFound = allProviders.isSuccess && providerEntity == null;

  const overviewSummary =
    opsDetail.isPending && !opsDetail.data ? (
      <ProviderOverviewStatsSkeleton />
    ) : opsDetail.data ? (
      <ProviderOverviewStats detail={opsDetail.data} />
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/providers", label: "返回服务商列表" }}
        title={providerEntity?.name ?? "详情"}
        titleLoading={entityLoading}
        badge={
          providerEntity ? (
            <Badge variant={providerEntity.status === "enabled" ? "default" : "outline"}>
              {providerEntity.status === "enabled" ? "启用" : "停用"}
            </Badge>
          ) : null
        }
        actions={
          <RangeFilter
            value={value}
            onChange={setRange}
            refreshedAt={refreshedAt}
            onRefresh={refresh}
          />
        }
        summary={providerEntity ? overviewSummary : null}
      />

      {allProviders.isError || opsDetail.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {((allProviders.error ?? opsDetail.error) as Error).message}
          </AlertDescription>
        </Alert>
      ) : notFound ? (
        <Alert variant="destructive">
          <AlertTitle>服务商不存在</AlertTitle>
          <AlertDescription>
            <Link to="/providers" className="underline underline-offset-4">
              返回服务商列表
            </Link>
          </AlertDescription>
        </Alert>
      ) : provider ? (
        <ProviderDetailContent providerId={provider.id} range={rangeQuery} />
      ) : null}
    </div>
  );
}
