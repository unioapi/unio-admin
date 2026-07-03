import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { getModel } from "@/lib/api/models";
import { getModelOpsDetail } from "@/lib/api/modelsOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { ModelDetailContent } from "@/components/models/ModelDetailContent";
import {
  ModelOverviewStats,
  ModelOverviewStatsSkeleton,
} from "@/components/models/ModelOverviewStats";
import { ModelStatusBadge } from "@/components/models/ModelStatusBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ModelDetailPage() {
  const { modelId: modelIdParam } = useParams();
  const modelId = Number(modelIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };
  const validId = Number.isFinite(modelId) && modelId > 0;

  const modelQ = useQuery({
    queryKey: ["model", modelId],
    queryFn: () => getModel(modelId),
    enabled: validId,
  });

  const opsDetail = useQuery({
    queryKey: ["model", modelId, "ops-detail", rangeQuery],
    queryFn: () => getModelOpsDetail(modelId, rangeQuery),
    placeholderData: keepPreviousData,
    enabled: modelQ.isSuccess,
  });

  const model = modelQ.data ?? null;
  const entityLoading = modelQ.isPending;
  const notFound = modelQ.isSuccess && model == null;

  const overviewSummary = useMemo(() => {
    if (opsDetail.isError) {
      return (
        <p className="text-destructive text-sm">
          概览加载失败：{(opsDetail.error as Error).message}
        </p>
      );
    }
    if (opsDetail.isPending && !opsDetail.data) {
      return <ModelOverviewStatsSkeleton />;
    }
    if (!opsDetail.data) return null;
    return <ModelOverviewStats detail={opsDetail.data} />;
  }, [opsDetail.data, opsDetail.isPending, opsDetail.isError, opsDetail.error]);

  const statusBadge = useMemo(() => {
    if (!model) return null;
    if (opsDetail.data) {
      return (
        <ModelStatusBadge
          row={{
            status: opsDetail.data.model_status,
            sellable: opsDetail.data.sellable,
            bindings_total: opsDetail.data.bindings_total,
            bindings_available: opsDetail.data.bindings_available,
          }}
        />
      );
    }
    return (
      <StatusBadge status={model.status} />
    );
  }, [model, opsDetail.data]);

  if (!validId) {
    return <Navigate to="/models" replace />;
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/models", label: "返回模型列表" }}
        title={model?.model_id ?? "详情"}
        titleLoading={entityLoading}
        badge={statusBadge}
        actions={
          <RangeFilter
            value={value}
            onChange={setRange}
            refreshedAt={refreshedAt}
            onRefresh={refresh}
          />
        }
        summary={model ? overviewSummary : null}
      />

      {modelQ.isError || opsDetail.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {((modelQ.error ?? opsDetail.error) as Error).message}
          </AlertDescription>
        </Alert>
      ) : notFound ? (
        <Alert variant="destructive">
          <AlertTitle>模型不存在</AlertTitle>
          <AlertDescription>
            <Link to="/models" className="underline underline-offset-4">
              返回模型列表
            </Link>
          </AlertDescription>
        </Alert>
      ) : model ? (
        <ModelDetailContent modelId={model.id} range={rangeQuery} />
      ) : null}
    </div>
  );
}
