import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

// §1.5.3 MetricCard：Card + 悬浮详情（HoverCard，可移入 tip）+ Skeleton 组合。运维总览卡片唯一实现。
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
  /** 悬浮卡片详情；有值时整卡 hover 展示 HoverCard，鼠标可移入 tip 内 */
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
  const card = (
    <Card
      size="sm"
      onClick={onClick}
      className={cn(
        "gap-1.5 p-3",
        tooltip && "cursor-default",
        onClick && "cursor-pointer transition-colors hover:bg-accent/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-muted-foreground truncate text-xs font-medium">
          {label}
        </span>
        {icon ? (
          <span className="text-muted-foreground shrink-0">{icon}</span>
        ) : null}
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
        <div className="text-muted-foreground min-w-0 text-xs">{hint}</div>
      ) : null}
    </Card>
  );

  if (!tooltip) return card;

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
        {tooltip}
      </HoverCardContent>
    </HoverCard>
  );
}

// 响应式雷达栅格：移动端 2 列，桌面 4 列（8 卡 = 4×2）。
export function MetricGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}
    >
      {children}
    </div>
  );
}
