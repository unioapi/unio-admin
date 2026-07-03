import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** 详情页各 section 的统一外框（圆角 + 细描边）。 */
export function SectionFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl ring-1 ring-foreground/10", className)}>
      {children}
    </div>
  );
}

/** 详情页 section 空态（图标 + 标题 + 说明）。 */
export function SectionEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <Empty className="border py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}

/** 详情页 section 加载失败提示。 */
export function ErrorBox({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>加载失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** 表格骨架（section 内）。 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <SectionFrame className="p-4">
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-3">
            {Array.from({ length: cols }).map((__, col) => (
              <Skeleton key={col} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}

/** 图表区骨架（3 张小卡 + 两块图）。 */
export function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[200px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  );
}

/** 小指标卡（性能 section 汇总）。 */
export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-heading mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
