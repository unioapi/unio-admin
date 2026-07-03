import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import type { ApiKeyOpsRow } from "@/lib/api/customerOps";
import type { ApiKey } from "@/lib/api/apiKeys";
import { formatCompact, formatDateTime, formatRelativeTime, formatUSD } from "@/lib/format";
import { formatRouteRatioInput } from "@/components/routes/route-pricing";
import { copySecretToClipboard, SecretCopyCell } from "@/components/common/SecretCopyCell";
import { ApiKeyFormDialog } from "@/components/customer/ApiKeyFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnHeader } from "./column-header";

export const API_KEY_OS_COLUMN_LABELS: Record<string, string> = {
  name: "名称",
  key: "API Key",
  status: "状态",
  route_name: "线路",
  spend_limit: "限额",
  spent: "已用",
  expires_at: "过期时间",
  requests: "请求",
  consumption: "消费",
  last_used: "最近",
  action: "操作",
};

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

const API_KEY_COPY_MESSAGES = {
  success: "已复制完整 Key 到剪贴板",
  empty: "该 Key 无可复制明文（历史 Key）",
  failed: "复制失败，请手动选择复制",
} as const;

function copyPlaintextKey(row: ApiKeyOpsRow) {
  return copySecretToClipboard(row.key_plaintext, API_KEY_COPY_MESSAGES);
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

function ApiKeyRouteCell({ row }: { row: ApiKeyOpsRow }) {
  const ratio = formatRouteRatioInput(row.route_price_ratio) || "1";
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-xs">{row.route_name || "—"}</span>
      {row.route_name ? (
        <Badge variant="outline" className="shrink-0 px-1.5 py-0 tabular-nums text-[10px] font-normal">
          ×{ratio}
        </Badge>
      ) : null}
    </div>
  );
}

function ApiKeyExpiresCell({ row }: { row: ApiKeyOpsRow }) {
  if (!row.expires_at) {
    return <span className="text-muted-foreground text-xs">永不过期</span>;
  }
  const expired = row.status === "expired";
  return (
    <span
      className={
        expired
          ? "text-destructive text-xs tabular-nums"
          : "text-muted-foreground text-xs tabular-nums"
      }
    >
      {formatDateTime(row.expires_at)}
    </span>
  );
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
      header: ({ column }) => <ColumnHeader column={column} title="名称" />,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="truncate font-medium">{row.original.name}</span>
      ),
    },
    {
      id: "key",
      accessorKey: "key_prefix",
      header: ({ column }) => <ColumnHeader column={column} title="API Key" />,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <SecretCopyCell
          value={row.original.key_plaintext}
          display={
            row.original.key_plaintext
              ? undefined
              : `${row.original.key_prefix}…`
          }
          tooltipTitle="完整 Key"
          copyAriaLabel="复制 Key"
          copyMessages={API_KEY_COPY_MESSAGES}
        />
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableSorting: false,
      enableHiding: false,
      meta: { label: "状态" },
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
      cell: ({ row }) => <ApiKeyRouteCell row={row.original} />,
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
      id: "expires_at",
      accessorFn: (r) => r.expires_at ?? "",
      header: ({ column }) => <ColumnHeader column={column} title="过期时间" />,
      enableSorting: false,
      cell: ({ row }) => <ApiKeyExpiresCell row={row.original} />,
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
      cell: ({ row }) => {
        const apiKey = toApiKey(row.original);
        const revoked = row.original.status === "revoked";
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="更多">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => { void copyPlaintextKey(row.original); }}>
                  复制完整 Key
                </DropdownMenuItem>
                {!revoked ? (
                  <ApiKeyFormDialog apiKey={apiKey}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>编辑</DropdownMenuItem>
                  </ApiKeyFormDialog>
                ) : null}
                {!revoked ? (
                  <DropdownMenuItem onSelect={() => handlers.onToggle(row.original)}>
                    {row.original.status === "disabled" ? "启用" : "停用"}
                  </DropdownMenuItem>
                ) : null}
                {!revoked ? (
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
        );
      },
    },
  ];
}
