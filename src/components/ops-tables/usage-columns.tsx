import type { ColumnDef } from "@tanstack/react-table";
import type { UsageSummary } from "@/lib/api/usage";
import { resizableColumn } from "@/components/data-table";
import { formatDateTime } from "@/lib/format";

function inputTokens(u: UsageSummary): number {
  return (
    u.uncached_input_tokens +
    u.cache_read_input_tokens +
    u.cache_write_5m_input_tokens +
    u.cache_write_1h_input_tokens
  );
}

export function usageListColumns(): ColumnDef<UsageSummary, unknown>[] {
  return [
    resizableColumn<UsageSummary>("request_id", {
      header: "请求 ID",
      size: 180,
      minSize: 140,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="truncate font-mono text-xs">{row.original.request_id}</span>
      ),
    }),
    resizableColumn<UsageSummary>("requested_model_id", {
      header: "模型",
      size: 180,
      cell: ({ row }) => <span className="font-medium">{row.original.requested_model_id}</span>,
    }),
    resizableColumn<UsageSummary>("input_tokens", {
      header: "输入",
      size: 96,
      cell: ({ row }) => inputTokens(row.original),
    }),
    resizableColumn<UsageSummary>("output_tokens_total", {
      header: "输出",
      size: 96,
      cell: ({ row }) => row.original.output_tokens_total,
    }),
    resizableColumn<UsageSummary>("usage_source", {
      header: "来源",
      size: 120,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.usage_source}</span>
      ),
    }),
    resizableColumn<UsageSummary>("user_id", {
      header: "用户",
      size: 80,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.user_id}</span>
      ),
    }),
    resizableColumn<UsageSummary>("created_at", {
      header: "创建时间",
      size: 160,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    }),
  ];
}
