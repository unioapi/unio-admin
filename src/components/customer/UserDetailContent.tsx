import { useMemo } from "react";
import type { UserOpsDetail } from "@/lib/api/customerOps";
import type { UserDetail } from "@/lib/api/users";
import { DetailSideNav } from "@/components/common/DetailSideNav";
import { UserAccountSection } from "@/components/customer/UserAccountSection";

export function UserDetailContent({
  user,
  detail,
}: {
  user: UserDetail;
  detail: UserOpsDetail;
}) {
  const sections = useMemo(
    () => [
      {
        id: "account",
        label: "账户",
        content: <UserAccountSection user={user} detail={detail} />,
      },
    ],
    [user, detail],
  );

  return <DetailSideNav sections={sections} defaultSectionId="account" />;
}
