import { RequestsList } from "@/components/requests/RequestsList";

/** 用户详情「请求」页：复用请求中心列表，锁定当前用户并沿用页头时间区间。 */
export function UserRequestsSection({
  userId,
  rangeParams,
}: {
  userId: number;
  rangeParams: { from?: string; to?: string };
}) {
  return (
    <RequestsList
      fixedUserId={userId}
      storageKey="user-detail-requests"
      rangeParams={rangeParams}
      showRangeFilter={false}
    />
  );
}
