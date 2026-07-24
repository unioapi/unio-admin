import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { getChannel } from "@/lib/api/channels";
import { getBreakdown } from "@/lib/api/dashboard";
import {
  getChannelOpsDetail,
  getChannelRuntime,
  getChannelsOpsTable,
  resetChannelBreaker,
} from "@/lib/api/channelsOps";
import { apiErrorMessage } from "@/lib/api/client";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { ChannelDetailContent } from "@/components/channels/ChannelDetailContent";
import {
  ChannelOverviewStats,
  ChannelOverviewStatsSkeleton,
} from "@/components/channels/ChannelOverviewStats";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ChannelCircuitBreakerBadge } from "@/components/channels/ChannelCircuitBreakerBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import type { RuntimeSyncState } from "@/lib/api/runtime";

export function ChannelDetailPage() {
  const { channelId: channelIdParam } = useParams();
  const channelId = Number(channelIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };
  const validId = Number.isFinite(channelId) && channelId > 0;
  const queryClient = useQueryClient();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const channelQ = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => getChannel(channelId),
    enabled: validId,
  });

  const opsDetail = useQuery({
    queryKey: ["channel", channelId, "ops-detail", rangeQuery],
    queryFn: () => getChannelOpsDetail(channelId, rangeQuery),
    placeholderData: keepPreviousData,
    enabled: channelQ.isSuccess,
  });

  const runtimeQ = useQuery({
    queryKey: ["channel", channelId, "runtime"],
    queryFn: () => getChannelRuntime(channelId),
    enabled: channelQ.isSuccess,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const resetBreaker = useMutation({
    mutationFn: () => resetChannelBreaker(channelId),
    onSuccess: (runtime) => {
      queryClient.setQueryData(["channel", channelId, "runtime"], runtime);
      toast.success(`已复位渠道「${channelQ.data?.name ?? channelId}」熔断状态`);
      setResetConfirmOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  // 与概览「表现 → 渠道」同一接口、同一行数据（含 success_buckets）
  const channelBreakdown = useQuery({
    queryKey: ["dashboard", "breakdown", "channel", rangeQuery],
    queryFn: () => getBreakdown("channel", rangeQuery),
    placeholderData: keepPreviousData,
    enabled: channelQ.isSuccess,
  });

  const opsRow = useQuery({
    queryKey: ["channels", "ops-table", "row", channelId, rangeQuery],
    queryFn: async () => {
      const page = await getChannelsOpsTable({ ...rangeQuery, page: 1, page_size: 500 });
      return page.items.find((c) => c.id === channelId) ?? null;
    },
    placeholderData: keepPreviousData,
    enabled: channelQ.isSuccess,
  });

  if (!validId) {
    return <Navigate to="/channels" replace />;
  }

  const channel = channelQ.data ?? null;
  const breakdownRow = channelBreakdown.data?.rows.find((row) => row.ref_id === channelId);
  const runtimeSyncState: RuntimeSyncState | undefined = runtimeQ.isError
    ? "store_unavailable"
    : runtimeQ.data?.runtime_sync_state;
  const entityLoading = channelQ.isPending;
  const notFound = channelQ.isSuccess && channel == null;

  const overviewSummary = opsDetail.isError ? (
    <p className="text-destructive text-sm">概览加载失败：{(opsDetail.error as Error).message}</p>
  ) : opsDetail.isPending && !opsDetail.data ? (
    <ChannelOverviewStatsSkeleton />
  ) : opsDetail.data ? (
    <ChannelOverviewStats
      detail={opsDetail.data}
      breakdownRow={breakdownRow}
      runtime={runtimeQ.data}
      runtimeSyncState={runtimeSyncState}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/channels", label: "返回渠道列表" }}
        title={channel?.name ?? "详情"}
        titleLoading={entityLoading}
        badge={
          channel ? (
            <span className="inline-flex items-center gap-1.5">
              <StatusBadge status={channel.status} />
              <ChannelCircuitBreakerBadge
                breaker={runtimeQ.data?.breaker}
                runtimeSyncState={runtimeSyncState}
              />
            </span>
          ) : null
        }
        subtitle={
          channel
            ? `${channel.provider_name} · ${channel.provider_origin_name} · ${channel.base_url}`
            : null
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                !channel ||
                runtimeSyncState !== "active" ||
                runtimeQ.isPending ||
                resetBreaker.isPending
              }
              onClick={() => setResetConfirmOpen(true)}
            >
              <RotateCcwIcon data-icon="inline-start" />
              复位熔断
            </Button>
            <RangeFilter
              value={value}
              onChange={setRange}
              refreshedAt={refreshedAt}
              onRefresh={refresh}
            />
          </div>
        }
        summary={channel ? overviewSummary : null}
      />

      <ConfirmActionDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="复位渠道熔断状态"
        description={`确认复位「${channel?.name ?? channelId}」？当前 breaker 窗口和连续失败计数将被清空。`}
        confirmLabel="确认复位"
        destructive
        pending={resetBreaker.isPending}
        onConfirm={() => resetBreaker.mutate()}
      />

      {channelQ.isError || opsDetail.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {((channelQ.error ?? opsDetail.error) as Error).message}
          </AlertDescription>
        </Alert>
      ) : notFound ? (
        <Alert variant="destructive">
          <AlertTitle>渠道不存在</AlertTitle>
          <AlertDescription>
            <Link to="/channels" className="underline underline-offset-4">
              返回渠道列表
            </Link>
          </AlertDescription>
        </Alert>
      ) : channel ? (
        <>
          {runtimeQ.isError ? (
            <Alert variant="destructive">
              <AlertTitle>运行态基础设施故障</AlertTitle>
              <AlertDescription>
                Redis/BreakerStore 当前不可用，新的上游准入已拒绝。旧快照不会作为当前事实展示。
              </AlertDescription>
            </Alert>
          ) : null}
          <ChannelDetailContent
            channelId={channel.id}
            channel={channel}
            range={rangeQuery}
            opsRow={opsRow.data}
            runtime={runtimeQ.data}
            runtimeSyncState={runtimeSyncState}
          />
        </>
      ) : null}
    </div>
  );
}
