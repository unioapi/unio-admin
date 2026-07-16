import { useEffect, useState } from "react";
import { ArrowRightIcon, CalendarIcon, ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import {
  RANGE_PRESETS,
  formatLocalDateSlash,
  rangePresetLabel,
  startOfLocalDay,
  type RangePreset,
  type RangeValue,
} from "@/lib/range";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function parseLocalDate(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toCustomBounds(fromDay: Date, toDay: Date): { from: string; to: string } {
  const from = startOfLocalDay(fromDay);
  const to = new Date(toDay);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Date;
  onChange: (d: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-muted-foreground text-[11px] leading-none">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-7 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-left text-xs",
              "hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 outline-none",
            )}
          >
            <span className={cn("tabular-nums", !value && "text-muted-foreground")}>
              {value ? formatLocalDateSlash(value) : "选择"}
            </span>
            <CalendarIcon className="text-muted-foreground size-3 shrink-0 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// 固定范围下拉 + 自定义区间 + 「最后刷新」+ 刷新按钮。
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
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date | undefined>();
  const [draftTo, setDraftTo] = useState<Date | undefined>();

  useEffect(() => {
    if (!open) return;
    if (value.preset === "custom") {
      setDraftFrom(parseLocalDate(value.from));
      setDraftTo(parseLocalDate(value.to));
      return;
    }
    // 打开时用「今天」填默认自定义草稿，方便改日期后点应用。
    const today = startOfLocalDay(new Date());
    setDraftFrom(today);
    setDraftTo(today);
  }, [open, value.preset, value.from, value.to]);

  const triggerLabel =
    value.preset === "custom" && value.from && value.to
      ? `${formatLocalDateSlash(new Date(value.from))} – ${formatLocalDateSlash(new Date(value.to))}`
      : rangePresetLabel(value.preset);

  function pickPreset(preset: Exclude<RangePreset, "custom">) {
    onChange({ preset });
    setOpen(false);
  }

  function applyCustom() {
    if (!draftFrom || !draftTo) return;
    const fromDay = draftFrom <= draftTo ? draftFrom : draftTo;
    const toDay = draftFrom <= draftTo ? draftTo : draftFrom;
    const bounds = toCustomBounds(fromDay, toDay);
    onChange({ preset: "custom", ...bounds });
    setOpen(false);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs whitespace-nowrap transition-colors outline-none select-none",
              "hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
              open ? "border-foreground/25 bg-muted/40" : "border-input",
            )}
          >
            <CalendarIcon className="text-muted-foreground size-3 shrink-0" />
            <span>{triggerLabel}</span>
            <ChevronDownIcon className="text-muted-foreground size-3 shrink-0 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className="w-[17.5rem] gap-0 p-2">
          <div className="grid grid-cols-2 gap-0.5">
            {RANGE_PRESETS.map((p) => {
              const active = value.preset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => pickPreset(p.value)}
                  className={cn(
                    "h-7 rounded-md px-1.5 text-xs transition-colors",
                    active
                      ? "bg-foreground text-background font-medium"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="bg-border/80 my-2 h-px" />

          <div className="flex items-end gap-1.5">
            <DateField label="开始" value={draftFrom} onChange={setDraftFrom} />
            <ArrowRightIcon className="text-muted-foreground mb-2 size-3 shrink-0 opacity-50" />
            <DateField label="结束" value={draftTo} onChange={setDraftTo} />
          </div>

          <div className="mt-2 flex justify-end">
            <Button size="xs" disabled={!draftFrom || !draftTo} onClick={applyCustom}>
              应用
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {onRefresh ? (
        <div className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px] tabular-nums">
          {refreshedAt ? <span>最后刷新 {formatClock(refreshedAt)}</span> : null}
          <Button variant="ghost" size="icon-xs" onClick={onRefresh} aria-label="刷新">
            <RefreshCwIcon />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
