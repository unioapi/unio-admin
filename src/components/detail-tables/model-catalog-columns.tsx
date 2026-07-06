// 列定义模块：内联了状态/能力两个小渲染组件（非 HMR 边界），故关闭 fast-refresh 单一导出约束。
/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CopyIcon } from "lucide-react";
import {
  getCatalogEntry,
  type CatalogEntry,
} from "@/lib/api/modelCatalog";
import { copySecretToClipboard } from "@/components/common/SecretCopyCell";
import { resizableColumn } from "@/components/data-table";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { AdoptFromCatalogDialog } from "@/components/models/AdoptFromCatalogDialog";
import { SupportLevelBadge } from "@/components/capability/shared";
import { formatInt, roundPrice3 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export const MODEL_CATALOG_COLUMN_LABELS: Record<string, string> = {
  model: "模型",
  lab: "厂商",
  context: "上下文",
  max_output: "最大输出",
  input_price: "输入价",
  output_price: "输出价",
  release_date: "发布日期",
  capability_count: "能力",
  adopted_count: "已采纳",
  status: "状态",
  action: "操作",
};

const DASH = "—";

function fmtPrice(value: string | null): string {
  return roundPrice3(value) || DASH;
}

function fmtDate(value: string | null): string {
  return value ? value.slice(0, 10) : DASH;
}

function CatalogStatusBadge({
  removed,
  adopted,
}: {
  removed: boolean;
  adopted: boolean;
}) {
  if (removed) {
    return <Badge variant="destructive">已下架</Badge>;
  }
  if (adopted) {
    return <Badge variant="secondary">已采纳</Badge>;
  }
  return <Badge variant="outline">未采纳</Badge>;
}

function CatalogCopyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[10px]">{label}</span>
      <div className="flex items-start gap-1">
        <span className={cn("min-w-0 flex-1 break-all text-xs", mono && "font-mono")}>{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label={`复制${label}`}
          onClick={() =>
            void copySecretToClipboard(value, {
              success: `已复制${label}`,
              empty: `无可复制的${label}`,
            })
          }
        >
          <CopyIcon className="size-3" />
        </Button>
      </div>
    </div>
  );
}

/** 模型列：列表内截断展示，悬浮显示完整名称 / 厂商 / ID，详情内可复制。 */
function CatalogModelCell({ entry }: { entry: CatalogEntry }) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button type="button" className="flex min-w-0 flex-col gap-0.5 text-left">
          <span className="truncate font-medium underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
            {entry.display_name}
          </span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            {entry.canonical_id}
          </span>
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <div className="flex flex-col gap-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
          <CatalogCopyField label="显示名称" value={entry.display_name} />
          <CatalogCopyField label="厂商" value={entry.lab} />
          <CatalogCopyField label="模型 ID" value={entry.canonical_id} mono />
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}

// 能力列：悬浮时按需拉取目录详情（与采纳弹窗共用缓存键），展示每条能力 key + 支持级别。
function CatalogCapabilityCell({ entry }: { entry: CatalogEntry }) {
  const [open, setOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: ["model-catalog-entry", entry.canonical_id],
    queryFn: () => getCatalogEntry(entry.canonical_id),
    enabled: open,
  });
  const caps = detailQuery.data?.capabilities ?? [];

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="cursor-default tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
          {entry.capability_count}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        {detailQuery.isPending ? (
          <p className="text-muted-foreground text-xs">加载能力详情…</p>
        ) : detailQuery.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : caps.length === 0 ? (
          <p className="text-muted-foreground text-xs">无能力提示</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground text-xs font-medium">
              能力（{caps.length}）
            </div>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {caps.map((c) => (
                <li
                  key={c.capability_key}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate font-mono text-xs">
                    {c.capability_key}
                  </span>
                  <SupportLevelBadge level={c.support_level} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export function modelCatalogColumns(): ColumnDef<CatalogEntry, unknown>[] {
  return [
    resizableColumn<CatalogEntry>("model", {
      header: "模型",
      size: 240,
      minSize: 180,
      enableHiding: false,
      cell: ({ row }) => <CatalogModelCell entry={row.original} />,
    }),
    resizableColumn<CatalogEntry>("lab", {
      header: "厂商",
      size: 110,
      minSize: 80,
      meta: { label: "厂商" },
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.original.lab}
        </Badge>
      ),
    }),
    resizableColumn<CatalogEntry>("context", {
      header: "上下文",
      size: 100,
      minSize: 80,
      meta: { label: "上下文" },
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatInt(row.original.context_window_tokens)}
        </span>
      ),
    }),
    resizableColumn<CatalogEntry>("max_output", {
      header: "最大输出",
      size: 100,
      minSize: 80,
      meta: { label: "最大输出" },
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatInt(row.original.max_output_tokens)}
        </span>
      ),
    }),
    resizableColumn<CatalogEntry>("input_price", {
      header: "输入价",
      size: 96,
      minSize: 72,
      meta: { label: "输入价" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {fmtPrice(row.original.input_price_usd_per_million_tokens)}
        </span>
      ),
    }),
    resizableColumn<CatalogEntry>("output_price", {
      header: "输出价",
      size: 96,
      minSize: 72,
      meta: { label: "输出价" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {fmtPrice(row.original.output_price_usd_per_million_tokens)}
        </span>
      ),
    }),
    resizableColumn<CatalogEntry>("release_date", {
      header: "发布日期",
      size: 112,
      minSize: 96,
      meta: { label: "发布日期" },
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {fmtDate(row.original.release_date)}
        </span>
      ),
    }),
    resizableColumn<CatalogEntry>("capability_count", {
      header: "能力",
      size: 80,
      minSize: 64,
      cell: ({ row }) => <CatalogCapabilityCell entry={row.original} />,
    }),
    resizableColumn<CatalogEntry>("adopted_count", {
      header: "已采纳",
      size: 88,
      minSize: 64,
      cell: ({ row }) =>
        row.original.adopted_count > 0 ? (
          <span className="font-medium tabular-nums">{row.original.adopted_count}</span>
        ) : (
          <span className="text-muted-foreground tabular-nums">0</span>
        ),
    }),
    resizableColumn<CatalogEntry>("status", {
      header: "状态",
      size: 96,
      minSize: 72,
      cell: ({ row }) => (
        <CatalogStatusBadge
          removed={row.original.removed_upstream}
          adopted={row.original.adopted_count > 0}
        />
      ),
    }),
    resizableColumn<CatalogEntry>("action", {
      header: "操作",
      size: 88,
      minSize: 72,
      enableHiding: false,
      cell: ({ row }) => (
        <AdoptFromCatalogDialog entry={row.original}>
          <Button variant="outline" size="sm">
            采纳
          </Button>
        </AdoptFromCatalogDialog>
      ),
    }),
  ];
}
