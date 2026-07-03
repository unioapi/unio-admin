import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRouteOpsReachableModels } from "@/lib/api/routesOps";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export function RouteModelsCountCell({
  routeId,
  count,
}: {
  routeId: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const modelsQuery = useQuery({
    queryKey: ["route", routeId, "ops-reachable-models"],
    queryFn: () => getRouteOpsReachableModels(routeId),
    enabled: open && count > 0,
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
          className={cn(
            "tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
            "cursor-default",
          )}
          aria-label={`查看 ${count} 个可达模型`}
        >
          {count}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-80">
        {modelsQuery.isPending ? (
          <p className="text-muted-foreground text-xs">加载模型…</p>
        ) : modelsQuery.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : (modelsQuery.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无可达模型</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium">
              可达模型（{modelsQuery.data!.length}）
            </div>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {modelsQuery.data!.map((m) => (
                <li
                  key={m.model_id}
                  className="rounded-md border px-2 py-1.5"
                >
                  <div className="truncate text-xs font-medium">
                    {m.display_name || m.model_id}
                  </div>
                  {m.display_name ? (
                    <div className="text-muted-foreground truncate font-mono text-[10px]">
                      {m.model_id}
                    </div>
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
