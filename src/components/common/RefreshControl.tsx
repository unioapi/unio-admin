import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  REFRESH_INTERVAL_OPTIONS,
  type RefreshIntervalSec,
} from "@/hooks/useRefreshSettings";
import { cn } from "@/lib/utils";

export function RefreshControl({
  autoRefresh,
  intervalSec,
  onAutoRefreshChange,
  onIntervalChange,
  onRefresh,
  spinning,
  className,
}: {
  autoRefresh: boolean;
  intervalSec: RefreshIntervalSec;
  onAutoRefreshChange: (next: boolean) => void;
  onIntervalChange: (next: RefreshIntervalSec) => void;
  onRefresh: () => void;
  /** 图标旋转：自动刷新开启，或正在拉取。 */
  spinning?: boolean;
  className?: string;
}) {
  return (
    <HoverCard openDelay={200} closeDelay={280}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(className)}
          aria-label={autoRefresh ? "自动刷新已开启，点击立即刷新" : "刷新列表"}
          title={autoRefresh ? "自动刷新中 · 点击立即刷新" : "刷新列表"}
          onClick={() => onRefresh()}
        >
          <RefreshCwIcon
            className={cn(
              "size-4 transition-transform",
              spinning && "animate-spin",
            )}
          />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-56 space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="auto-refresh" className="text-xs font-medium">
            自动刷新
          </Label>
          <Switch
            id="auto-refresh"
            size="sm"
            checked={autoRefresh}
            onCheckedChange={onAutoRefreshChange}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">刷新间隔</p>
          <div className="grid grid-cols-3 gap-1">
            {REFRESH_INTERVAL_OPTIONS.map((sec) => {
              const active = intervalSec === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onIntervalChange(sec)}
                  className={cn(
                    "h-7 rounded-md text-xs tabular-nums transition-colors",
                    active
                      ? "bg-foreground text-background font-medium"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  {sec}秒
                </button>
              );
            })}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
