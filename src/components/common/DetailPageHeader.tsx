import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface DetailPageHeaderProps {
  back: { href: string; label: string };
  title: string;
  titleLoading?: boolean;
  badge?: ReactNode;
  subtitle?: ReactNode;
  /** 概览指标等摘要内容（由页面自行处理 loading skeleton） */
  summary?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DetailPageHeader({
  back,
  title,
  titleLoading = false,
  badge,
  subtitle,
  summary,
  actions,
  className,
}: DetailPageHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <Button variant="outline" size="icon" className="size-9 shrink-0" asChild>
            <Link to={back.href} aria-label={back.label}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 space-y-1 pt-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {titleLoading ? (
                <Skeleton className="h-8 w-48" />
              ) : (
                <>
                  <h1 className="font-heading truncate text-2xl font-semibold tracking-tight">
                    {title}
                  </h1>
                  {badge}
                </>
              )}
            </div>
            {!titleLoading && subtitle ? (
              <div className="text-muted-foreground text-sm">{subtitle}</div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      {summary ? <div>{summary}</div> : null}
    </header>
  );
}
