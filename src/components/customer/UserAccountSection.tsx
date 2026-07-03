import { Link } from "react-router-dom";
import type { UserOpsDetail } from "@/lib/api/customerOps";
import type { UserDetail } from "@/lib/api/users";
import { formatDateTime, formatUSD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function InfoItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/40 px-3 py-2.5", className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5 min-w-0 text-sm">{children}</div>
    </div>
  );
}

function usdBalance(user: UserDetail) {
  return user.balances.find((b) => b.currency === "USD") ?? null;
}

export function UserAccountSection({
  user,
  detail,
}: {
  user: UserDetail;
  detail: UserOpsDetail;
}) {
  const balance = usdBalance(user);
  const balanceUsd = balance?.balance ?? detail.balance_usd;
  const reservedUsd = balance?.reserved_balance ?? detail.reserved_usd;
  const availableUsd = detail.available_usd;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="邮箱">
          <span className="break-all">{user.email}</span>
        </InfoItem>
        <InfoItem label="昵称">{user.display_name || "—"}</InfoItem>
        <InfoItem label="用户 ID">
          <span className="tabular-nums">{user.id}</span>
        </InfoItem>
        <InfoItem label="注册时间">{formatDateTime(user.created_at)}</InfoItem>
        <InfoItem label="余额">
          <span className="font-medium tabular-nums">{formatUSD(balanceUsd)}</span>
        </InfoItem>
        <InfoItem label="冻结">
          <span className="tabular-nums">{formatUSD(reservedUsd)}</span>
        </InfoItem>
        <InfoItem label="可用">
          <span className="font-medium tabular-nums">{formatUSD(availableUsd)}</span>
        </InfoItem>
        <InfoItem label="最近更新">{formatDateTime(user.updated_at)}</InfoItem>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to={`/ledger?userId=${user.id}`}>查看账本</Link>
        </Button>
      </div>
    </div>
  );
}
