import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import type {
  GatewayLogEntry,
  GatewayLogLevel,
} from "@/lib/api/system";
import { formatDateTime } from "@/lib/format";
import { DataTableColumnHeader } from "@/components/tablecn/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LOG_LEVEL_OPTIONS = [
  { value: "debug", label: "DEBUG" },
  { value: "info", label: "INFO" },
  { value: "warning", label: "WARNING" },
  { value: "error", label: "ERROR" },
];

export function gatewayLogsColumns(
  onOpenDetail: (entry: GatewayLogEntry) => void,
): ColumnDef<GatewayLogEntry, unknown>[] {
  return [
    {
      id: "timestamp",
      accessorKey: "timestamp",
      header: "时间",
      enableHiding: false,
      enableSorting: false,
      meta: { label: "时间" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
          {formatDateTime(row.original.timestamp)}
        </span>
      ),
    },
    {
      id: "level",
      accessorKey: "level",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="等级" />
      ),
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: "等级",
        variant: "select",
        options: LOG_LEVEL_OPTIONS,
      },
      cell: ({ row }) => <LogLevelBadge level={row.original.level} />,
    },
    {
      id: "type",
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Type" />
      ),
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: "Type",
        variant: "text",
        placeholder: "Type",
        maxLength: 64,
      },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.type || "—"}</span>
      ),
    },
    {
      id: "event",
      accessorKey: "event",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Event" />
      ),
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: "Event",
        variant: "text",
        placeholder: "Event",
        maxLength: 64,
      },
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.event || "—"}
        </span>
      ),
    },
    {
      id: "search",
      accessorKey: "message",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Message" />
      ),
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: "内容",
        variant: "text",
        placeholder: "搜索 message 或 data",
        maxLength: 200,
      },
      cell: ({ row }) => (
        <div className="max-w-md truncate" title={row.original.message}>
          {row.original.message}
        </div>
      ),
    },
    {
      id: "related_id",
      accessorFn: relatedId,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="关联 ID" />
      ),
      enableColumnFilter: true,
      enableSorting: false,
      meta: {
        label: "关联 ID",
        variant: "text",
        placeholder: "请求 / Trace / Attempt ID",
        maxLength: 128,
      },
      cell: ({ row }) => {
        const value = relatedId(row.original);
        return (
          <div className="max-w-52 truncate font-mono text-xs" title={value}>
            {value}
          </div>
        );
      },
    },
    {
      id: "instance",
      accessorKey: "instance",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="实例" />
      ),
      enableSorting: false,
      meta: { label: "实例" },
      cell: ({ row }) => (
        <div
          className="max-w-40 truncate text-xs"
          title={row.original.instance}
        >
          {row.original.instance || "—"}
        </div>
      ),
    },
    {
      id: "action",
      header: () => <span className="sr-only">操作</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`查看日志 ${row.original.id}`}
            title="查看详情"
            onClick={() => onOpenDetail(row.original)}
          >
            <EyeIcon />
          </Button>
        </div>
      ),
    },
  ];
}

function LogLevelBadge({ level }: { level: GatewayLogLevel }) {
  return (
    <Badge
      variant={
        level === "error"
          ? "destructive"
          : level === "info"
            ? "outline"
            : "secondary"
      }
    >
      {level.toUpperCase()}
    </Badge>
  );
}

function relatedId(entry: GatewayLogEntry): string {
  for (const key of [
    "attempt_id",
    "request_id",
    "trace_id",
    "upstream_request_id",
  ]) {
    const value = entry.data[key];
    if ((typeof value === "string" && value) || typeof value === "number") {
      return String(value);
    }
  }
  return "—";
}
