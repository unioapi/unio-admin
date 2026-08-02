import { useId } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  refreshLabel = "刷新列表",
  className,
}: {
  autoRefresh: boolean;
  intervalSec: RefreshIntervalSec;
  onAutoRefreshChange: (next: boolean) => void;
  onIntervalChange: (next: RefreshIntervalSec) => void;
  onRefresh: () => void;
  /** 图标旋转：自动刷新开启，或正在拉取。 */
  spinning?: boolean;
  /** 当前刷新控制负责的数据范围。 */
  refreshLabel?: string;
  className?: string;
}) {
  const autoRefreshId = useId();

  return (
    <HoverCard openDelay={200} closeDelay={280}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(className)}
          aria-label={autoRefresh ? `自动刷新已开启，点击${refreshLabel}` : refreshLabel}
          title={autoRefresh ? `自动刷新中 · 点击${refreshLabel}` : refreshLabel}
          onClick={() => onRefresh()}
        >
          <RefreshCwIcon
            className={cn("transition-transform", spinning && "animate-spin")}
          />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="flex w-56 flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={autoRefreshId} className="text-xs font-medium">
            自动刷新
          </Label>
          <Switch
            id={autoRefreshId}
            size="sm"
            checked={autoRefresh}
            onCheckedChange={onAutoRefreshChange}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs">刷新间隔</p>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={1}
            value={String(intervalSec)}
            onValueChange={(value) => {
              if (value) {
                onIntervalChange(Number(value) as RefreshIntervalSec);
              }
            }}
            aria-label="刷新间隔"
            className="grid w-full grid-cols-4"
          >
            {REFRESH_INTERVAL_OPTIONS.map((sec) => {
              return (
                <ToggleGroupItem
                  key={sec}
                  value={String(sec)}
                  aria-label={`${sec} 秒`}
                  className="tabular-nums"
                >
                  {sec}秒
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
