import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import type { ErrorGroup } from "@/lib/api/dashboard";
import { errorCodeLabel } from "@/components/dashboard/breakdown-table/constants";
import { resizableColumn } from "@/components/data-table";
import { formatInt, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";

function ErrorCodeCell({ code }: { code: string }) {
  const label = errorCodeLabel(code);
  if (label === code) {
    return <span className="block truncate font-mono text-xs">{code}</span>;
  }
  return (
    <>
      <div className="truncate font-medium">{label}</div>
      <div className="text-muted-foreground truncate font-mono text-xs">{code}</div>
    </>
  );
}

export function topErrorsColumns(): ColumnDef<ErrorGroup, unknown>[] {
  return [
    resizableColumn<ErrorGroup>("code", {
      header: "错误原因",
      size: 240,
      minSize: 160,
      enableHiding: false,
      cell: ({ row }) => <ErrorCodeCell code={row.original.code} />,
    }),
    resizableColumn<ErrorGroup>("total", {
      header: "次数",
      size: 96,
      cell: ({ row }) => formatInt(row.original.total),
    }),
    resizableColumn<ErrorGroup>("share", {
      header: "占比",
      size: 200,
      cell: ({ row }) => (
        <div className="space-y-1">
          <span className="text-xs tabular-nums">{formatPercent(row.original.share)}</span>
          <div className="bg-muted/70 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-destructive/70 h-full rounded-full"
              style={{ width: `${Math.round(row.original.share * 100)}%` }}
            />
          </div>
        </div>
      ),
    }),
    resizableColumn<ErrorGroup>("action", {
      header: "操作",
      size: 72,
      enableHiding: false,
      cell: () => (
        <div >
          <Button asChild size="sm" variant="ghost">
            <Link to="/requests?status=failed">查看</Link>
          </Button>
        </div>
      ),
    }),
  ];
}
