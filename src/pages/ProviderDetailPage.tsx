import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { listAllProviders } from "@/lib/api/providers";
import { getProviderOpsDetail } from "@/lib/api/providersOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { ProviderDetailContent } from "@/components/providers/ProviderDetailContent";
import {
  ProviderOverviewStats,
  ProviderOverviewStatsSkeleton,
} from "@/components/providers/ProviderOverviewStats";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ProviderDetailPage() {
  const { providerId: providerIdParam } = useParams();
  const providerId = Number(providerIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };
  const validId = Number.isFinite(providerId) && providerId > 0;

  const allProviders = useQuery({
    queryKey: ["providers", "all"],
    queryFn: listAllProviders,
    enabled: validId,
  });

  const opsDetail = useQuery({
    queryKey: ["providers", providerId, "ops-detail", rangeQuery],
    queryFn: () => getProviderOpsDetail(providerId, rangeQuery),
    placeholderData: keepPreviousData,
    enabled: validId && allProviders.isSuccess,
    retry: 1,
  });

  if (!validId) {
    return <Navigate to="/providers" replace />;
  }

  const providerEntity = allProviders.data?.find((x) => x.id === providerId) ?? null;
  const entityLoading = allProviders.isPending;
  const notFound = allProviders.isSuccess && providerEntity == null;

  const overviewSummary = opsDetail.isError ? (
    <p className="text-destructive text-sm">概览加载失败：{(opsDetail.error as Error).message}</p>
  ) : opsDetail.isPending && !opsDetail.data ? (
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
            <StatusBadge status={providerEntity.status} />
          ) : null
        }
        subtitle={providerEntity ? providerEntity.slug : null}
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
      ) : providerEntity ? (
        <ProviderDetailContent providerId={providerEntity.id} range={rangeQuery} />
      ) : null}
    </div>
  );
}
