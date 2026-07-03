/* eslint-disable react-refresh/only-export-components */
import type { ColumnDef } from "@tanstack/react-table";
import { PencilIcon, Trash2Icon } from "lucide-react";
import type { CapabilityKeyDef } from "@/lib/api/capability";
import {
  normalizeProtocolScope,
  protocolScopeLabel,
} from "@/lib/capability/protocolScope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColumnHeader } from "./column-header";
import { TruncateCell } from "./truncate-cell";

export const CAPABILITY_KEY_OS_COLUMN_LABELS: Record<string, string> = {
  key: "key",
  protocol_scope: "协议归属",
  domain: "domain",
  display_name: "展示名",
  description: "描述",
  sort_order: "排序",
  action: "操作",
};

export function capabilityKeyOsColumns(handlers: {
  onEdit: (row: CapabilityKeyDef) => void;
  onDelete: (row: CapabilityKeyDef) => void;
}): ColumnDef<CapabilityKeyDef, unknown>[] {
  return [
    {
      id: "key",
      accessorKey: "key",
      header: ({ column }) => <ColumnHeader column={column} title="key" />,
      enableHiding: false,
      meta: { autoSizeValue: (row: CapabilityKeyDef) => row.key },
      cell: ({ row }) => {
        const key = row.original.key;
        return (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <div className="min-w-0 cursor-default">
                <TruncateCell
                  text={key}
                  className="font-mono text-sm"
                  title=""
                />
              </div>
            </TooltipTrigger>
            <TooltipContent align="start" className="max-w-md font-mono break-all">
              {key}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "protocol_scope",
      accessorFn: (r) => normalizeProtocolScope(r.protocol_scope),
      header: ({ column }) => <ColumnHeader column={column} title="协议归属" />,
      meta: {
        autoSizeValue: (row: CapabilityKeyDef) =>
          protocolScopeLabel(normalizeProtocolScope(row.protocol_scope)),
      },
      cell: ({ row }) => (
        <span className="text-sm">
          {protocolScopeLabel(normalizeProtocolScope(row.original.protocol_scope))}
        </span>
      ),
    },
    {
      id: "domain",
      accessorKey: "domain",
      header: ({ column }) => <ColumnHeader column={column} title="domain" />,
      meta: { autoSizeValue: (row: CapabilityKeyDef) => row.domain },
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.domain}</span>
      ),
    },
    {
      id: "display_name",
      accessorKey: "display_name",
      header: ({ column }) => <ColumnHeader column={column} title="展示名" />,
      meta: { autoSizeValue: (row: CapabilityKeyDef) => row.display_name },
      cell: ({ row }) => row.original.display_name,
    },
    {
      id: "description",
      accessorKey: "description",
      header: ({ column }) => <ColumnHeader column={column} title="描述" />,
      meta: { autoSizeValue: (row: CapabilityKeyDef) => row.description },
      cell: ({ row }) => (
        <TruncateCell
          text={row.original.description}
          className="text-muted-foreground text-xs"
        />
      ),
    },
    {
      id: "sort_order",
      accessorKey: "sort_order",
      header: ({ column }) => <ColumnHeader column={column} title="排序" />,
      meta: { autoSizeValue: (row: CapabilityKeyDef) => String(row.sort_order) },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.sort_order}</span>
      ),
    },
    {
      id: "deprecated",
      accessorFn: (r) => (r.deprecated ? "是" : "否"),
      header: () => <span className="text-muted-foreground">deprecated</span>,
      enableSorting: false,
      enableHiding: true,
      cell: ({ row }) =>
        row.original.deprecated ? (
          <Badge variant="secondary">已弃用</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "action",
      header: () => <span className="text-muted-foreground">操作</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="编辑"
            onClick={() => handlers.onEdit(row.original)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="删除"
            onClick={() => handlers.onDelete(row.original)}
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
    },
  ];
}
