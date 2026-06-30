import type { Column } from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 可排序表头：未排序时仅标题；排序后显示对应方向箭头。 */
export function ColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) {
    return <span className={cn("text-muted-foreground", className)}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(undefined)}
      className={cn(
        "group/sort flex h-7 w-full items-center gap-1.5 text-left text-muted-foreground transition-colors hover:text-foreground",
        sorted && "text-foreground",
        className,
      )}
    >
      <span className="whitespace-nowrap">{title}</span>
      {sorted === "asc" ? (
        <ChevronUpIcon className="size-3.5 shrink-0" />
      ) : sorted === "desc" ? (
        <ChevronDownIcon className="size-3.5 shrink-0" />
      ) : null}
    </button>
  );
}
