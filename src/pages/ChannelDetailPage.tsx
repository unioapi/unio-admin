import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { getChannel } from "@/lib/api/channels";
import { getBreakdown } from "@/lib/api/dashboard";
import { getChannelOpsDetail, getChannelsOpsTable } from "@/lib/api/channelsOps";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { ChannelDetailContent } from "@/components/channels/ChannelDetailContent";
import {
  ChannelOverviewStats,
  ChannelOverviewStatsSkeleton,
} from "@/components/channels/ChannelOverviewStats";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ChannelDetailPage() {
  const { channelId: channelIdParam } = useParams();
  const channelId = Number(channelIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };

  if (!Number.isFinite(channelId) || channelId <= 0) {
    return <Navigate to="/channels" replace />;
  }

  const channelQ = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => getChannel(channelId),
  });

  const opsDetail = useQuery({
    queryKey: ["channel", channelId, "ops-detail", rangeQuery],
    queryFn: () => getChannelOpsDetail(channelId, rangeQuery),
    placeholderData: keepPreviousData,
    enabled: channelQ.isSuccess,
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

  const channel = channelQ.data ?? null;
  const breakdownRow = channelBreakdown.data?.rows.find((row) => row.ref_id === channelId);
  const entityLoading = channelQ.isPending;
  const notFound = channelQ.isSuccess && channel == null;

  const overviewSummary =
    opsDetail.isPending && !opsDetail.data ? (
      <ChannelOverviewStatsSkeleton />
    ) : opsDetail.data ? (
      <ChannelOverviewStats detail={opsDetail.data} breakdownRow={breakdownRow} />
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/channels", label: "返回渠道列表" }}
        title={channel?.name ?? "详情"}
        titleLoading={entityLoading}
        badge={
          channel ? (
            <Badge variant={channel.status === "enabled" ? "default" : "outline"}>
              {channel.status === "enabled" ? "启用" : "停用"}
            </Badge>
          ) : null
        }
        subtitle={
          channel ? `${channel.provider_name} · ${channel.base_url}` : null
        }
        actions={
          <RangeFilter
            value={value}
            onChange={setRange}
            refreshedAt={refreshedAt}
            onRefresh={refresh}
          />
        }
        summary={channel ? overviewSummary : null}
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
        <ChannelDetailContent
          channelId={channel.id}
          channel={channel}
          range={rangeQuery}
          opsRow={opsRow.data}
        />
      ) : null}
    </div>
  );
}
