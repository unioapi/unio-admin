import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontalIcon } from "lucide-react";
import type { ApiKeyOpsRow } from "@/lib/api/customerOps";
import type { ApiKey } from "@/lib/api/apiKeys";
import { resizableColumn } from "@/components/data-table";
import { formatCompact, formatRelativeTime, formatUSD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiKeySpendLimitDialog } from "@/components/customer/ApiKeySpendLimitDialog";

function toApiKey(row: ApiKeyOpsRow): ApiKey {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    key_prefix: row.key_prefix,
    status: row.status,
    spend_limit: row.spend_limit,
    spent_total: row.spent_total,
    route_id: null,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    disabled_at: null,
    revoked_at: null,
    created_at: "",
    updated_at: "",
  };
}

export function apiKeyOpsColumns(handlers: {
  onToggle: (row: ApiKeyOpsRow) => void;
  onRevoke: (id: number) => void;
}): ColumnDef<ApiKeyOpsRow, unknown>[] {
  return [
    resizableColumn<ApiKeyOpsRow>("name", {
      header: "Key",
      size: 200,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <>
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="text-muted-foreground truncate font-mono text-xs">
            {row.original.key_prefix}…
          </div>
        </>
      ),
    }),
    resizableColumn<ApiKeyOpsRow>("status", {
      header: "状态",
      size: 88,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "default" : "outline"}>
          {row.original.status}
        </Badge>
      ),
    }),
    resizableColumn<ApiKeyOpsRow>("route_name", {
      header: "线路",
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs">{row.original.route_name || "项目默认 → 内置经济"}</span>
      ),
    }),
    resizableColumn<ApiKeyOpsRow>("spend_limit", {
      header: "限额",
      size: 112,
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.spend_limit ? formatUSD(row.original.spend_limit) : "不限"}
        </span>
      ),
    }),
    resizableColumn<ApiKeyOpsRow>("spent_total", {
      header: "已用",
      size: 112,
      cell: ({ row }) => <span className="text-xs">{formatUSD(row.original.spent_total)}</span>,
    }),
    resizableColumn<ApiKeyOpsRow>("request_total", {
      header: "请求",
      size: 96,
      cell: ({ row }) => <span className="text-xs">{formatCompact(row.original.request_total)}</span>,
    }),
    resizableColumn<ApiKeyOpsRow>("consumption_usd", {
      header: "消费",
      size: 112,
      cell: ({ row }) => <span className="text-xs">{formatUSD(row.original.consumption_usd)}</span>,
    }),
    resizableColumn<ApiKeyOpsRow>("last_used_at", {
      header: "最近",
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.last_used_at ? formatRelativeTime(row.original.last_used_at) : "—"}
        </span>
      ),
    }),
    resizableColumn<ApiKeyOpsRow>("action", {
      header: "操作",
      size: 72,
      enableHiding: false,
      cell: ({ row }) => (
        <div >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ApiKeySpendLimitDialog apiKey={toApiKey(row.original)}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>调整限额</DropdownMenuItem>
              </ApiKeySpendLimitDialog>
              {row.original.status !== "revoked" ? (
                <DropdownMenuItem onSelect={() => handlers.onToggle(row.original)}>
                  {row.original.status === "disabled" ? "启用" : "停用"}
                </DropdownMenuItem>
              ) : null}
              {row.original.status !== "revoked" ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => handlers.onRevoke(row.original.id)}
                >
                  吊销
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ];
}
