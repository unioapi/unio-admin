import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import type { RadarBadChannel } from "@/lib/api/dashboard";
import { resizableColumn } from "@/components/data-table";
import { TruncateCell } from "@/components/openstatus-table/truncate-cell";
import { formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const BAD_CHANNELS_COLUMN_LABELS: Record<string, string> = {
  name: "渠道",
  attempt_failed: "失败",
  success_rate: "成功率",
  recent_error_code: "最近错误",
  action: "操作",
};

export function badChannelsColumns(): ColumnDef<RadarBadChannel, unknown>[] {
  return [
    resizableColumn<RadarBadChannel>("name", {
      header: "渠道",
      size: 180,
      minSize: 120,
      enableHiding: false,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    }),
    resizableColumn<RadarBadChannel>("attempt_failed", {
      header: "失败",
      size: 88,
      minSize: 72,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.attempt_failed}</span>
      ),
    }),
    resizableColumn<RadarBadChannel>("success_rate", {
      header: "成功率",
      size: 96,
      minSize: 80,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatPercent(row.original.success_rate)}</span>
      ),
    }),
    resizableColumn<RadarBadChannel>("recent_error_code", {
      header: "最近错误",
      size: 140,
      minSize: 100,
      cell: ({ row }) => (
        <TruncateCell
          className="text-muted-foreground text-xs"
          text={row.original.recent_error_code || "—"}
        />
      ),
    }),
    resizableColumn<RadarBadChannel>("action", {
      header: "操作",
      size: 80,
      minSize: 64,
      enableHiding: false,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost">
          <Link to={`/channels?channel_id=${row.original.channel_id}`}>查看</Link>
        </Button>
      ),
    }),
  ];
}
