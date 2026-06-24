import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, RefreshCwIcon } from "lucide-react";
import {
  RANGE_PRESETS,
  type RangePreset,
  type RangeValue,
} from "@/lib/range";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 固定范围下拉 + 自定义区间 + 「最后刷新」+ 刷新按钮。
// 「全部」点击须确认弹窗（§3.1.10：大库慢查询保护）。
export function RangeFilter({
  value,
  onChange,
  refreshedAt,
  onRefresh,
  className,
}: {
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  refreshedAt?: number;
  onRefresh?: () => void;
  className?: string;
}) {
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  function handlePreset(next: string) {
    if (!next) return;
    const preset = next as Exclude<RangePreset, "custom">;
    if (preset === "all") {
      setConfirmAllOpen(true);
      return;
    }
    onChange({ preset });
  }

  function applyCustom() {
    if (draft?.from && draft?.to) {
      const from = new Date(draft.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(draft.to);
      to.setHours(23, 59, 59, 999);
      onChange({
        preset: "custom",
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setCalOpen(false);
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        value={value.preset === "custom" ? "" : value.preset}
        onValueChange={handlePreset}
      >
        <SelectTrigger size="sm" className="min-w-28">
          <SelectValue placeholder="时间范围" />
        </SelectTrigger>
        <SelectContent align="end" position="popper">
          <SelectGroup>
            {RANGE_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value.preset === "custom" ? "outline" : "ghost"}
            size="sm"
          >
            <CalendarIcon data-icon="inline-start" />
            {value.preset === "custom" && value.from && value.to
              ? `${new Date(value.from).toLocaleDateString()} – ${new Date(
                  value.to,
                ).toLocaleDateString()}`
              : "自定义"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={draft}
            onSelect={setDraft}
            autoFocus
          />
          <div className="flex justify-end gap-2 px-1 pb-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(undefined);
                setCalOpen(false);
              }}
            >
              取消
            </Button>
            <Button size="sm" disabled={!draft?.from || !draft?.to} onClick={applyCustom}>
              应用
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {onRefresh ? (
        <div className="text-muted-foreground ml-auto flex items-center gap-2 text-xs tabular-nums">
          {refreshedAt ? <span>最后刷新 {formatClock(refreshedAt)}</span> : null}
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="刷新">
            <RefreshCwIcon />
          </Button>
        </div>
      ) : null}

      <Dialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>查询全部时间范围？</DialogTitle>
            <DialogDescription>
              「全部」会扫描全库历史数据，在数据量大时查询较慢。确认继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAllOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                onChange({ preset: "all" });
                setConfirmAllOpen(false);
              }}
            >
              确认查询全部
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
