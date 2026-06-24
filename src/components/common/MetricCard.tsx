import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// §1.5.3 MetricCard：Card + Tooltip + Skeleton 组合。运维总览卡片唯一实现。
export type MetricIntent = "default" | "success" | "warning" | "danger";

const intentText: Record<MetricIntent, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tooltip?: ReactNode;
  intent?: MetricIntent;
  loading?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  tooltip,
  intent = "default",
  loading,
  icon,
  onClick,
  className,
}: MetricCardProps) {
  return (
    <Card
      size="sm"
      onClick={onClick}
      className={cn(
        "gap-1.5 p-3",
        onClick && "cursor-pointer transition-colors hover:bg-accent/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-muted-foreground truncate text-xs font-medium">
          {label}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          {icon}
          {tooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/70 hover:text-foreground"
                    aria-label="详情"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <InfoIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs whitespace-pre-line text-left">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div
          className={cn(
            "font-heading text-2xl leading-tight font-semibold tabular-nums",
            intentText[intent],
          )}
        >
          {value}
        </div>
      )}
      {hint != null && !loading ? (
        <div className="text-muted-foreground truncate text-xs">{hint}</div>
      ) : null}
    </Card>
  );
}

// 响应式雷达栅格：移动端 2 列，桌面 6 列（§3.1.9）。
export function MetricGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
