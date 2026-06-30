import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

/** 当前生效的筛选条件 Chip 条；无筛选时不渲染。 */
export function FilterChips({
  chips,
  onClearAll,
  className,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
  className?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="bg-muted/60 inline-flex h-7 max-w-full items-center gap-1 rounded-full border px-2.5 text-xs"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-full p-0.5 transition-colors"
            aria-label={`移除 ${chip.label}`}
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 px-2 text-xs font-normal"
        onClick={onClearAll}
      >
        清除全部
      </Button>
    </div>
  );
}
