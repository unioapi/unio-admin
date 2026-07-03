import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getProviderOpsChannelCatalog,
  getProviderOpsModelCatalog,
  getProviderOpsRouteCatalog,
} from "@/lib/api/providersOps";
import { ROUTE_MODE_LABEL } from "@/lib/routes/display";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

export function ProviderChannelsCountCell({
  providerId,
  count,
}: {
  providerId: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["provider", providerId, "ops-channel-catalog"],
    queryFn: () => getProviderOpsChannelCatalog(providerId),
    enabled: open && count > 0,
    staleTime: 5 * 60_000,
  });

  if (count === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          aria-label={`查看 ${count} 个渠道`}
        >
          {count}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-80">
        {q.isPending ? (
          <p className="text-muted-foreground text-xs">加载中…</p>
        ) : q.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无渠道</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium">渠道（{q.data!.length}）</div>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {q.data!.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                >
                  <span className="truncate text-xs font-medium">{c.name}</span>
                  <Badge variant={c.status === "enabled" ? "secondary" : "outline"} className="h-5 shrink-0 px-1.5 text-[10px]">
                    {c.status === "enabled" ? "启用" : "停用"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TipHoverCardContent>
    </HoverCard>
  );
}

export function ProviderModelsCountCell({
  providerId,
  count,
}: {
  providerId: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["provider", providerId, "ops-model-catalog"],
    queryFn: () => getProviderOpsModelCatalog(providerId),
    enabled: open && count > 0,
    staleTime: 5 * 60_000,
  });

  if (count === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          aria-label={`查看 ${count} 个模型`}
        >
          {count}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-80">
        {q.isPending ? (
          <p className="text-muted-foreground text-xs">加载中…</p>
        ) : q.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无模型</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium">模型（{q.data!.length}）</div>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {q.data!.map((m) => (
                <li key={m.model_id} className="rounded-md border px-2 py-1.5">
                  <div className="truncate text-xs font-medium">{m.display_name || m.model_id}</div>
                  {m.display_name ? (
                    <div className="text-muted-foreground truncate font-mono text-[10px]">{m.model_id}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </TipHoverCardContent>
    </HoverCard>
  );
}

export function ProviderRoutesCountCell({
  providerId,
  count,
}: {
  providerId: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["provider", providerId, "ops-route-catalog"],
    queryFn: () => getProviderOpsRouteCatalog(providerId),
    enabled: open && count > 0,
    staleTime: 5 * 60_000,
  });

  if (count === 0) {
    return <span className="text-muted-foreground tabular-nums">0</span>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          aria-label={`查看 ${count} 条线路`}
        >
          {count}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-80">
        {q.isPending ? (
          <p className="text-muted-foreground text-xs">加载中…</p>
        ) : q.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无线路</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium">线路（{q.data!.length}）</div>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {q.data!.map((rt) => (
                <li
                  key={rt.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{rt.name}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {ROUTE_MODE_LABEL[rt.mode] ?? rt.mode}
                    </div>
                  </div>
                  <Badge variant={rt.status === "enabled" ? "secondary" : "outline"} className="h-5 shrink-0 px-1.5 text-[10px]">
                    {rt.status === "enabled" ? "启用" : "停用"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TipHoverCardContent>
    </HoverCard>
  );
}
