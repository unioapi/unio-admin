import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRouteOpsChannelPool } from "@/lib/api/routesOps";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export function RouteChannelsCell({
  routeId,
  count,
}: {
  routeId: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const poolQuery = useQuery({
    queryKey: ["route", routeId, "ops-pool", "list-cell"],
    queryFn: () => getRouteOpsChannelPool(routeId),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  if (count === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-default tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          aria-label={`查看 ${count} 条渠道`}
        >
          {count}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-80">
        {poolQuery.isPending ? (
          <p className="text-muted-foreground text-xs">加载渠道…</p>
        ) : poolQuery.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : (poolQuery.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-xs">渠道池为空</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium">
              渠道池（{poolQuery.data!.length}）
            </div>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {poolQuery.data!.map((c) => (
                <li
                  key={c.channel_id}
                  className={cn(
                    "rounded-md border px-2.5 py-2",
                    c.channel_status === "enabled"
                      ? "bg-muted/35 border-border/60"
                      : "bg-muted/15 border-dashed",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{c.channel_name}</span>
                    {c.channel_status !== "enabled" ? (
                      <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
                        停用
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate text-[10px]">
                    {c.provider_name} · 优先级 {c.priority}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TipHoverCardContent>
    </HoverCard>
  );
}
