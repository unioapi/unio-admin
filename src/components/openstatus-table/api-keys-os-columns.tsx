import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import type { ApiKeyOpsRow } from "@/lib/api/customerOps";
import type { ApiKey } from "@/lib/api/apiKeys";
import { formatCompact, formatRelativeTime, formatUSD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiKeyRouteDialog } from "@/components/customer/ApiKeyRouteDialog";
import { ApiKeySpendLimitDialog } from "@/components/customer/ApiKeySpendLimitDialog";
import { ColumnHeader } from "./column-header";

export const API_KEY_OS_COLUMN_LABELS: Record<string, string> = {
  name: "Key",
  status: "状态",
  route_name: "线路",
  spend_limit: "限额",
  spent: "已用",
  requests: "请求",
  consumption: "消费",
  last_used: "最近",
  action: "操作",
};

// budgetUsagePercent 计算费用上限使用率（向下取整百分比）；未设上限返回 null（不展示比例）。
function budgetUsagePercent(
  spendLimit: string | null,
  spentTotal: string,
): number | null {
  if (!spendLimit) return null;
  const limit = Number(spendLimit);
  const spent = Number(spentTotal);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(spent)) return null;
  return Math.floor((spent / limit) * 100);
}

// copyPlaintextKey 复制完整明文 key（产品决策：明文留存，可多次复制）。
async function copyPlaintextKey(row: ApiKeyOpsRow) {
  if (!row.key_plaintext) {
    toast.error("该 Key 无可复制明文（历史 Key）");
    return;
  }
  try {
    await navigator.clipboard.writeText(row.key_plaintext);
    toast.success("已复制完整 Key 到剪贴板");
  } catch {
    toast.error("复制失败，请手动选择复制");
  }
}

function toApiKey(row: ApiKeyOpsRow): ApiKey {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    key_prefix: row.key_prefix,
    status: row.status,
    spend_limit: row.spend_limit,
    spent_total: row.spent_total,
    route_id: row.route_id,
    rpm_limit: null,
    tpm_limit: null,
    rpd_limit: null,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    disabled_at: null,
    revoked_at: null,
    created_at: "",
    updated_at: "",
  };
}

export function apiKeyOsColumns(handlers: {
  onToggle: (row: ApiKeyOpsRow) => void;
  onRevoke: (row: ApiKeyOpsRow) => void;
  onDelete: (row: ApiKeyOpsRow) => void;
}): ColumnDef<ApiKeyOpsRow, unknown>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <ColumnHeader column={column} title="Key" />,
      enableHiding: false,
      cell: ({ row }) => (
        <>
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="text-muted-foreground truncate font-mono text-xs">
            {row.original.key_prefix}…
          </div>
        </>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableSorting: false,
      enableHiding: false,
      meta: { label: "状态", fixedWidth: true },
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "default" : "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "route_name",
      accessorKey: "route_name",
      header: ({ column }) => <ColumnHeader column={column} title="线路" />,
      enableSorting: false,
      cell: ({ row }) => <span className="text-xs">{row.original.route_name}</span>,
    },
    {
      id: "spend_limit",
      accessorKey: "spend_limit",
      header: ({ column }) => <ColumnHeader column={column} title="限额" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {row.original.spend_limit ? formatUSD(row.original.spend_limit) : "不限"}
        </span>
      ),
    },
    {
      id: "spent",
      accessorKey: "spent_total",
      header: ({ column }) => <ColumnHeader column={column} title="已用" />,
      cell: ({ row }) => {
        const used = formatUSD(row.original.spent_total);
        const pct = budgetUsagePercent(row.original.spend_limit, row.original.spent_total);
        if (pct === null) {
          return <span className="text-xs tabular-nums">{used}</span>;
        }
        // P2-1：软上限可视化——接近/达到上限即高亮告警（不加硬闸门，spend_limit 命中由后端自动停用）。
        const tone =
          pct >= 100
            ? "text-destructive font-medium"
            : pct >= 80
              ? "text-amber-600 dark:text-amber-500"
              : "text-muted-foreground";
        return (
          <span className={`text-xs tabular-nums ${tone}`}>
            {used} ({pct}%)
          </span>
        );
      },
    },
    {
      id: "requests",
      accessorKey: "request_total",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatCompact(row.original.request_total)}</span>
      ),
    },
    {
      id: "consumption",
      accessorKey: "consumption_usd",
      header: ({ column }) => <ColumnHeader column={column} title="消费" />,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{formatUSD(row.original.consumption_usd)}</span>
      ),
    },
    {
      id: "last_used",
      accessorKey: "last_used_at",
      header: ({ column }) => <ColumnHeader column={column} title="最近" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {row.original.last_used_at ? formatRelativeTime(row.original.last_used_at) : "—"}
        </span>
      ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="更多">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => copyPlaintextKey(row.original)}>
                复制完整 Key
              </DropdownMenuItem>
              <ApiKeySpendLimitDialog apiKey={toApiKey(row.original)}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>调整限额</DropdownMenuItem>
              </ApiKeySpendLimitDialog>
              <ApiKeyRouteDialog apiKey={toApiKey(row.original)}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>换绑线路</DropdownMenuItem>
              </ApiKeyRouteDialog>
              {row.original.status !== "revoked" ? (
                <DropdownMenuItem onSelect={() => handlers.onToggle(row.original)}>
                  {row.original.status === "disabled" ? "启用" : "停用"}
                </DropdownMenuItem>
              ) : null}
              {row.original.status !== "revoked" ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => handlers.onRevoke(row.original)}
                >
                  吊销
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => handlers.onDelete(row.original)}
              >
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
