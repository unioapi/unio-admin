import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// 限流「数字 + 单位」输入：用于 TPM / RPD 这类量级较大的上限。
// 单位 K=千 / M=百万 / B=十亿，默认 K；入库存真实整数(数字 × 单位)。
// 语义沿用限流覆盖约定：空=继承调用方对应的默认限流；0=不限(0 × 任意单位仍是 0)。

type RateUnit = "K" | "M" | "B";

const RATE_UNIT_MULTIPLIER: Record<RateUnit, number> = {
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000,
};

export interface RateLimitFieldValue {
  num: string;
  unit: RateUnit;
}

const EMPTY_RATE_LIMIT: RateLimitFieldValue = { num: "", unit: "K" };

// decomposeRateLimit 把存储的真实整数拆回 {数字, 单位} 用于回填编辑表单。
// null/undefined → 空(继承默认)；0 → "0"(不限)；能被 B/M 整除则用 B/M，否则落到 K(允许小数，如 590→0.59K)。
export function decomposeRateLimit(
  value: number | null | undefined,
): RateLimitFieldValue {
  if (value == null) return { ...EMPTY_RATE_LIMIT };
  if (value === 0) return { num: "0", unit: "K" };
  if (value % RATE_UNIT_MULTIPLIER.B === 0) {
    return { num: String(value / RATE_UNIT_MULTIPLIER.B), unit: "B" };
  }
  if (value % RATE_UNIT_MULTIPLIER.M === 0) {
    return { num: String(value / RATE_UNIT_MULTIPLIER.M), unit: "M" };
  }
  return { num: String(value / RATE_UNIT_MULTIPLIER.K), unit: "K" };
}

// composeRateLimit 把 {数字, 单位} 折算成入库的真实整数。
// 空 → null(继承默认)；否则 数字 × 单位 并四舍五入到整数。非法数字返回 NaN(交给校验拦截)。
export function composeRateLimit(value: RateLimitFieldValue): number | null {
  const t = value.num.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.round(n * RATE_UNIT_MULTIPLIER[value.unit]);
}

// rateLimitWithUnitError 校验「数字 + 单位」：空放行；否则数字须 ≥ 0，且换算后为非负整数(0=不限)。
export function rateLimitWithUnitError(
  value: RateLimitFieldValue,
  inheritLabel = "继承默认",
): string | undefined {
  const t = value.num.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return `需为 ≥ 0 的数(0=不限，留空=${inheritLabel})`;
  }
  const real = n * RATE_UNIT_MULTIPLIER[value.unit];
  if (!Number.isInteger(real)) {
    return `换算后需为整数(当前单位 ${value.unit} = ×${RATE_UNIT_MULTIPLIER[
      value.unit
    ].toLocaleString()})`;
  }
  return undefined;
}

// RateLimitInput 数字输入 + 单位下拉(K/M/B)。受控：value={num,unit}，onChange 回传整体。
export function RateLimitInput({
  id,
  value,
  onChange,
  ariaInvalid,
  placeholder = "继承默认",
}: {
  id?: string;
  value: RateLimitFieldValue;
  onChange: (next: RateLimitFieldValue) => void;
  ariaInvalid?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        id={id}
        type="number"
        min={0}
        step="any"
        value={value.num}
        onChange={(e) => onChange({ ...value, num: e.target.value })}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        className="min-w-0 flex-1"
      />
      <Select
        value={value.unit}
        onValueChange={(u) => onChange({ ...value, unit: u as RateUnit })}
      >
        <SelectTrigger aria-label="单位" className="w-16 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-(--radix-select-trigger-width)">
          <SelectItem value="K">K</SelectItem>
          <SelectItem value="M">M</SelectItem>
          <SelectItem value="B">B</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
