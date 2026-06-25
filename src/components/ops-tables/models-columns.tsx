import type { ColumnDef } from "@tanstack/react-table";
import type { ModelOpsRow } from "@/lib/api/modelsOps";
import { resizableColumn } from "@/components/data-table";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function modelOpsColumns(): ColumnDef<ModelOpsRow, unknown>[] {
  return [
    resizableColumn<ModelOpsRow>("name", {
      header: "模型",
      size: 220,
      minSize: 160,
      enableHiding: false,
      cell: ({ row }) => (
        <>
          <div className="truncate font-medium">{row.original.model_id}</div>
          <div className="text-muted-foreground truncate text-xs">
            {row.original.display_name} · {row.original.owned_by}
          </div>
        </>
      ),
    }),
    resizableColumn<ModelOpsRow>("status", {
      header: "状态",
      size: 88,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "enabled" ? "default" : "outline"}>
          {row.original.status === "enabled" ? "启用" : "停用"}
        </Badge>
      ),
    }),
    resizableColumn<ModelOpsRow>("sellable", {
      header: "可售",
      size: 88,
      cell: ({ row }) =>
        row.original.sellable ? (
          <Badge variant="default">可售</Badge>
        ) : (
          <Badge variant="destructive">不可售</Badge>
        ),
    }),
    resizableColumn<ModelOpsRow>("bindings", {
      header: "渠道",
      size: 88,
      cell: ({ row }) => `${row.original.bindings_available}/${row.original.bindings_total}`,
    }),
    resizableColumn<ModelOpsRow>("request_total", {
      header: "请求",
      size: 96,
      cell: ({ row }) => formatCompact(row.original.request_total),
    }),
    resizableColumn<ModelOpsRow>("success_rate", {
      header: "成功率",
      size: 96,
      cell: ({ row }) => formatPercent(row.original.success_rate),
    }),
    resizableColumn<ModelOpsRow>("latency_p95", {
      header: "P95 延迟",
      size: 112,
      cell: ({ row }) => formatLatencyMs(row.original.latency_p95),
    }),
    resizableColumn<ModelOpsRow>("has_price", {
      header: "价格",
      size: 96,
      cell: ({ row }) =>
        row.original.has_price ? (
          <Badge variant="secondary">已配置</Badge>
        ) : (
          <Badge variant="destructive">缺价</Badge>
        ),
    }),
    resizableColumn<ModelOpsRow>("margin_rate", {
      header: "毛利率",
      size: 96,
      cell: ({ row }) => formatPercent(row.original.margin_rate),
    }),
  ];
}
