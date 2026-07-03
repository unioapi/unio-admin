import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { ArrowUpRightIcon } from "lucide-react";
import { resizableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";

/** 「请求」列：截断 request_id + 跳转证据中心（各详情页错误/请求子表通用）。 */
export function requestIdLinkColumn<T extends { request_id: string }>(): ColumnDef<T, unknown> {
  return resizableColumn<T>("request_id", {
    header: "请求",
    size: 120,
    minSize: 88,
    cell: ({ row }) => (
      <Button asChild size="sm" variant="ghost" className="font-mono text-xs">
        <Link to={`/requests?q=${row.original.request_id}`}>
          {row.original.request_id.slice(0, 8)}…
          <ArrowUpRightIcon data-icon="inline-end" />
        </Link>
      </Button>
    ),
  });
}
