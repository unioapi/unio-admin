import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DurationUnit = "ms" | "s" | "m" | "h";

const DURATION_UNIT_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
};

const DURATION_UNIT_LABEL: Record<DurationUnit, string> = {
  ms: "毫秒",
  s: "秒",
  m: "分钟",
  h: "小时",
};

export interface DurationFieldValue {
  num: string;
  unit: DurationUnit;
}

export function decomposeDurationMs(ms: number): DurationFieldValue {
  if (!Number.isFinite(ms) || ms <= 0) {
    return { num: String(ms ?? 0), unit: "ms" };
  }
  for (const unit of ["h", "m", "s"] as const) {
    if (ms % DURATION_UNIT_MS[unit] === 0) {
      return { num: String(ms / DURATION_UNIT_MS[unit]), unit };
    }
  }
  return { num: String(ms), unit: "ms" };
}

export function composeDurationMs(value: DurationFieldValue): number {
  const raw = value.num.trim();
  if (raw === "") return Number.NaN;
  const number = Number(raw);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.round(number * DURATION_UNIT_MS[value.unit]);
}

export function durationError(
  value: DurationFieldValue,
  allowZero: boolean,
): string | undefined {
  const milliseconds = composeDurationMs(value);
  if (Number.isNaN(milliseconds)) return "请输入数字";
  if (!Number.isInteger(milliseconds)) return "换算成毫秒后需为整数";
  if (allowZero ? milliseconds < 0 : milliseconds <= 0) {
    return allowZero ? "需 ≥ 0" : "需 > 0";
  }
  return undefined;
}

export function DurationInput({
  id,
  value,
  onChange,
  ariaInvalid,
}: {
  id?: string;
  value: DurationFieldValue;
  onChange: (next: DurationFieldValue) => void;
  ariaInvalid?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        id={id}
        type="number"
        min={0}
        step="any"
        value={value.num}
        onChange={(event) => onChange({ ...value, num: event.target.value })}
        aria-invalid={ariaInvalid}
        className="h-8 min-w-0 flex-1 font-mono text-xs"
      />
      <Select
        value={value.unit}
        onValueChange={(unit) => onChange({ ...value, unit: unit as DurationUnit })}
      >
        <SelectTrigger aria-label="时间单位" className="h-8 w-20 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-(--radix-select-trigger-width)">
          <SelectGroup>
            {(Object.keys(DURATION_UNIT_LABEL) as DurationUnit[]).map((unit) => (
              <SelectItem key={unit} value={unit}>
                {DURATION_UNIT_LABEL[unit]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
