import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type Ref,
} from "react";
import { CalendarIcon, ClockIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// 与原生 <input type="date"> / <input type="datetime-local"> 的字符串格式完全一致，
// 以便作为放心的替换件：date → "YYYY-MM-DD"；datetime → "YYYY-MM-DDTHH:mm"（本地时区）。

const pad = (n: number) => String(n).padStart(2, "0");

function parseDateValue(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateTimeValue(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return undefined;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
  );
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function formatDateTimeValue(d: Date): string {
  return `${formatDateValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CALENDAR_START = new Date(2015, 0);
const CALENDAR_END = new Date(new Date().getFullYear() + 6, 11);

// 用 forwardRef + 透传 ...rest，保证 PopoverTrigger asChild 注入的 onClick/ref/aria-* 落到真正的 <button> 上。
const TriggerButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<typeof Button> & {
    filled: boolean;
    invalid?: boolean;
    onClear?: () => void;
  }
>(function TriggerButton(
  { filled, invalid, onClear, className, children, disabled, ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      disabled={disabled}
      aria-invalid={invalid}
      className={cn(
        "group/dp w-full justify-start pr-2 font-normal tabular-nums",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        !filled && "text-muted-foreground",
        className,
      )}
      {...rest}
    >
      <CalendarIcon data-icon="inline-start" className="shrink-0" />
      <span className="truncate">{children}</span>
      {filled && !disabled && onClear ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label="清除"
          className="text-muted-foreground hover:text-foreground ml-auto shrink-0 rounded-sm p-0.5"
          // 阻止冒泡到 PopoverTrigger（pointerdown + click 都拦），避免点 X 时打开浮层。
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
        >
          <XIcon className="size-3.5" />
        </span>
      ) : null}
    </Button>
  );
});

/** 日期选择器（仅日期）；value/onChange 使用 "YYYY-MM-DD" 字符串。 */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "选择日期",
  disabled,
  align = "start",
  className,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton
          id={id}
          filled={!!selected}
          disabled={disabled}
          invalid={ariaInvalid}
          className={className}
          onClear={() => onChange("")}
        >
          {selected ? formatDateValue(selected) : placeholder}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={CALENDAR_START}
          endMonth={CALENDAR_END}
          defaultMonth={selected}
          selected={selected}
          onSelect={(d) => {
            onChange(d ? formatDateValue(d) : "");
            if (d) setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** 日期时间选择器（日期 + 时分）；value/onChange 使用 "YYYY-MM-DDTHH:mm" 字符串。 */
export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "选择日期时间",
  disabled,
  align = "start",
  className,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateTimeValue(value);
  const hourRef = useRef<HTMLButtonElement>(null);
  const minuteRef = useRef<HTMLButtonElement>(null);

  // 打开时把当前时/分滚动到可见位置。
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      hourRef.current?.scrollIntoView({ block: "center" });
      minuteRef.current?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  function commit(next: Date) {
    onChange(formatDateTimeValue(next));
  }

  function pickDate(d: Date | undefined) {
    if (!d) {
      onChange("");
      return;
    }
    const base = selected ?? new Date();
    commit(
      new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        selected ? base.getHours() : 0,
        selected ? base.getMinutes() : 0,
      ),
    );
  }

  function pickTime(part: "h" | "m", v: number) {
    const base = selected ?? new Date();
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      part === "h" ? v : base.getHours(),
      part === "m" ? v : base.getMinutes(),
    );
    commit(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton
          id={id}
          filled={!!selected}
          disabled={disabled}
          invalid={ariaInvalid}
          className={className}
          onClear={() => onChange("")}
        >
          {selected
            ? `${formatDateValue(selected)} ${pad(selected.getHours())}:${pad(selected.getMinutes())}`
            : placeholder}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex max-sm:flex-col">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            startMonth={CALENDAR_START}
            endMonth={CALENDAR_END}
            defaultMonth={selected}
            selected={selected}
            onSelect={pickDate}
            autoFocus
          />
          <div className="flex flex-col border-t sm:border-t-0 sm:border-l">
            <div className="text-muted-foreground flex items-center gap-1.5 px-3 pt-2 pb-1 text-xs">
              <ClockIcon className="size-3.5" />
              时间
            </div>
            <div className="flex">
              <TimeColumn
                values={HOURS}
                selected={selected?.getHours()}
                onPick={(v) => pickTime("h", v)}
                activeRef={hourRef}
              />
              <TimeColumn
                values={MINUTES}
                selected={selected?.getMinutes()}
                onPick={(v) => pickTime("m", v)}
                activeRef={minuteRef}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeColumn({
  values,
  selected,
  onPick,
  activeRef,
}: {
  values: number[];
  selected: number | undefined;
  onPick: (v: number) => void;
  activeRef: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="h-[15rem] w-14 overflow-y-auto p-1 [scrollbar-width:thin]">
      <div className="flex flex-col gap-0.5">
        {values.map((v) => {
          const active = selected === v;
          return (
            <Button
              key={v}
              ref={active ? activeRef : undefined}
              type="button"
              size="sm"
              variant={active ? "default" : "ghost"}
              className="h-7 w-full justify-center px-0 tabular-nums"
              onClick={() => onPick(v)}
            >
              {pad(v)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
