import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listCapabilityKeys,
  listModelCapabilities,
  type ModelCapability,
} from "@/lib/api/capability";
import { SupportLevelBadge } from "@/components/capability/shared";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

function isDeclaredCapability(cap: ModelCapability): boolean {
  return cap.support_level === "full" || cap.support_level === "limited";
}

export function ModelCapabilitiesCountCell({
  modelId,
  count,
}: {
  modelId: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);

  const capsQuery = useQuery({
    queryKey: ["model", modelId, "capabilities"],
    queryFn: () => listModelCapabilities(modelId),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const keysQuery = useQuery({
    queryKey: ["capability-keys", "v2"],
    queryFn: listCapabilityKeys,
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const caps = useMemo(() => {
    const declared = (capsQuery.data ?? []).filter(isDeclaredCapability);
    const order = new Map((keysQuery.data ?? []).map((k) => [k.key, k.sort_order]));
    return [...declared].sort((a, b) => {
      const ao = order.get(a.capability_key) ?? Number.MAX_SAFE_INTEGER;
      const bo = order.get(b.capability_key) ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.capability_key.localeCompare(b.capability_key);
    });
  }, [capsQuery.data, keysQuery.data]);

  const keyLabels = useMemo(
    () => new Map((keysQuery.data ?? []).map((k) => [k.key, k.display_name])),
    [keysQuery.data],
  );

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "tabular-nums",
            count > 0
              ? "cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
              : "text-muted-foreground cursor-default",
          )}
          aria-label={count > 0 ? `查看 ${count} 项声明能力` : "无声明能力"}
        >
          {count > 0 ? count : "—"}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-80">
        {count === 0 ? (
          <p className="text-muted-foreground text-xs">暂无声明能力</p>
        ) : capsQuery.isPending ? (
          <p className="text-muted-foreground text-xs">加载能力详情…</p>
        ) : capsQuery.isError ? (
          <p className="text-destructive text-xs">加载失败</p>
        ) : caps.length === 0 ? (
          <p className="text-muted-foreground text-xs">暂无声明能力</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium">
              声明能力（{caps.length}）
            </div>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {caps.map((c) => (
                <li
                  key={c.capability_key}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">
                      {keyLabels.get(c.capability_key) ?? c.capability_key}
                    </div>
                    {keyLabels.has(c.capability_key) ? (
                      <div className="text-muted-foreground truncate font-mono text-[10px]">
                        {c.capability_key}
                      </div>
                    ) : null}
                  </div>
                  <SupportLevelBadge level={c.support_level} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </TipHoverCardContent>
    </HoverCard>
  );
}
