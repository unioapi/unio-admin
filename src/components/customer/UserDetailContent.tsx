import { useMemo } from "react";
import type { UserOpsDetail } from "@/lib/api/customerOps";
import type { UserDetail } from "@/lib/api/users";
import { DetailSideNav } from "@/components/common/DetailSideNav";
import { UserAccountSection } from "@/components/customer/UserAccountSection";
import { UserRequestsSection } from "@/components/customer/UserRequestsSection";

export function UserDetailContent({
  user,
  detail,
  rangeParams,
}: {
  user: UserDetail;
  detail: UserOpsDetail;
  rangeParams: { from?: string; to?: string };
}) {
  const sections = useMemo(
    () => [
      {
        id: "account",
        label: "账户",
        content: <UserAccountSection user={user} detail={detail} />,
      },
      {
        id: "requests",
        label: "请求",
        content: (
          <UserRequestsSection userId={user.id} rangeParams={rangeParams} />
        ),
      },
    ],
    [user, detail, rangeParams],
  );

  return <DetailSideNav sections={sections} defaultSectionId="account" />;
}
