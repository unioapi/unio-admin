import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getApiKeysOpsSummary,
  getUserOpsDetail,
} from "@/lib/api/customerOps";
import { getUser } from "@/lib/api/users";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { UserDetailContent } from "@/components/customer/UserDetailContent";
import {
  UserOverviewStats,
  UserOverviewStatsSkeleton,
} from "@/components/customer/UserOverviewStats";
import { UserBalanceDialog } from "@/components/customer/UserBalanceDialog";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function UserDetailPage() {
  const { userId: userIdParam } = useParams();
  const userId = Number(userIdParam);
  const { value, setRange, params, refresh, refreshedAt } = useRangeQuery("24h");
  const rangeQuery = { ...params, range: value.preset };
  const validId = Number.isFinite(userId) && userId > 0;

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId),
    enabled: validId,
  });

  const opsDetail = useQuery({
    queryKey: ["user", userId, "ops-detail", rangeQuery],
    queryFn: () => getUserOpsDetail(userId, rangeQuery),
    placeholderData: keepPreviousData,
    enabled: userQuery.isSuccess,
  });

  const keySummary = useQuery({
    queryKey: ["api-keys", userId, "ops-summary"],
    queryFn: () => getApiKeysOpsSummary(userId),
    enabled: userQuery.isSuccess,
  });

  if (!validId) {
    return <Navigate to="/users" replace />;
  }

  const user = userQuery.data ?? null;
  const entityLoading = userQuery.isPending;
  const notFound = userQuery.isSuccess && user == null;

  const overviewSummary =
    opsDetail.isError ? (
      <p className="text-destructive text-sm">
        概览加载失败：{(opsDetail.error as Error).message}
      </p>
    ) : opsDetail.isPending && !opsDetail.data ? (
      <UserOverviewStatsSkeleton />
    ) : opsDetail.data && keySummary.data ? (
      <UserOverviewStats
        detail={opsDetail.data}
        keyTotal={keySummary.data.key_total}
        keyEnabled={keySummary.data.key_enabled}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/users", label: "返回用户列表" }}
        title={user?.display_name || user?.email || "详情"}
        titleLoading={entityLoading}
        subtitle={
          user ? (
            <>
              {user.email} · ID {user.id} · 注册 {formatDateTime(user.created_at)}
            </>
          ) : null
        }
        actions={
          user ? (
            <>
              <RangeFilter
                value={value}
                onChange={setRange}
                refreshedAt={refreshedAt}
                onRefresh={refresh}
              />
              <UserBalanceDialog user={user}>
                <Button size="sm">调额</Button>
              </UserBalanceDialog>
            </>
          ) : entityLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <RangeFilter
              value={value}
              onChange={setRange}
              refreshedAt={refreshedAt}
              onRefresh={refresh}
            />
          )
        }
        summary={user ? overviewSummary : null}
      />

      {userQuery.isError || opsDetail.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {((userQuery.error ?? opsDetail.error) as Error).message}
          </AlertDescription>
        </Alert>
      ) : notFound ? (
        <Alert variant="destructive">
          <AlertTitle>用户不存在</AlertTitle>
          <AlertDescription>
            <Link to="/users" className="underline underline-offset-4">
              返回用户列表
            </Link>
          </AlertDescription>
        </Alert>
      ) : user && opsDetail.data ? (
        <UserDetailContent
          user={user}
          detail={opsDetail.data}
          rangeParams={params}
        />
      ) : null}
    </div>
  );
}
