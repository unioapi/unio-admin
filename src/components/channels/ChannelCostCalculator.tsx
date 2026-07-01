import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalculatorIcon } from "lucide-react";
import { listModelPrices, type ModelPrice } from "@/lib/api/modelPrices";
import { roundPrice3, trimDecimal } from "@/lib/format";
import { HintLabel } from "@/components/common/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DetailSheetContent,
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetMain,
  SheetTitle,
} from "@/components/ui/sheet";

const STORAGE_PREFIX = "channel-cost-calc:";

const CALC_FIELDS = [
  {
    baseKey: "uncached_input",
    costKey: "uncached_input",
    label: "输入",
    priceField: "uncached_input_price",
  },
  { baseKey: "output", costKey: "output", label: "输出", priceField: "output_price" },
  {
    baseKey: "cache_read_input",
    costKey: "cache_read_input",
    label: "缓存读取",
    priceField: "cache_read_input_price",
  },
  {
    baseKey: "reasoning_output",
    costKey: "reasoning_output",
    label: "reasoning 输出",
    priceField: "reasoning_output_price",
  },
  {
    baseKey: "cache_write_5m_input",
    costKey: "cache_write_5m_input",
    label: "5 分钟缓存写入",
    priceField: "cache_write_5m_input_price",
  },
  {
    baseKey: "cache_write_1h_input",
    costKey: "cache_write_1h_input",
    label: "1 小时缓存写入",
    priceField: "cache_write_1h_input_price",
  },
] as const;

type BaseKey = (typeof CALC_FIELDS)[number]["baseKey"];
type CostKey = (typeof CALC_FIELDS)[number]["costKey"];

type BasePrices = Record<BaseKey, string>;
type CostAmounts = Record<CostKey, string>;

type SavedRatios = {
  topUpRatio: string;
  modelRatio: string;
};

function emptyBasePrices(): BasePrices {
  return {
    uncached_input: "",
    output: "",
    cache_read_input: "",
    reasoning_output: "",
    cache_write_5m_input: "",
    cache_write_1h_input: "",
  };
}

function parseRatio(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** 成本 = 充值倍率 × 模型倍率 × 模型基准价 */
export function calcChannelCostAmount(
  topUpRatio: number,
  modelRatio: number,
  basePrice: number,
): number | null {
  if (!Number.isFinite(basePrice)) return null;
  return topUpRatio * modelRatio * basePrice;
}

function pickCurrentModelPrice(prices: ModelPrice[]): ModelPrice | null {
  const now = Date.now();
  const candidates = prices.filter((p) => {
    if (p.status !== "enabled") return false;
    if (new Date(p.effective_from).getTime() > now) return false;
    if (p.effective_to && new Date(p.effective_to).getTime() <= now) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime(),
  )[0]!;
}

function basePricesFromModelPrice(price: ModelPrice | null): BasePrices {
  if (!price) return emptyBasePrices();
  const out = emptyBasePrices();
  for (const f of CALC_FIELDS) {
    const raw = price[f.priceField];
    if (raw == null || raw === "") continue;
    out[f.baseKey] = trimDecimal(raw);
  }
  return out;
}

function loadSavedRatios(channelId: number): SavedRatios {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${channelId}`);
    if (!raw) return { topUpRatio: "", modelRatio: "" };
    const parsed = JSON.parse(raw) as Partial<SavedRatios>;
    return {
      topUpRatio: parsed.topUpRatio ?? "",
      modelRatio: parsed.modelRatio ?? "",
    };
  } catch {
    return { topUpRatio: "", modelRatio: "" };
  }
}

function saveRatios(channelId: number, ratios: SavedRatios) {
  localStorage.setItem(`${STORAGE_PREFIX}${channelId}`, JSON.stringify(ratios));
}

export function ChannelCostCalculator({
  channelId,
  modelId,
  modelLabel,
  onApply,
}: {
  channelId: number;
  modelId: number | null;
  modelLabel?: string;
  onApply: (costs: Partial<CostAmounts>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topUpRatio, setTopUpRatio] = useState("");
  const [modelRatio, setModelRatio] = useState("");
  const [basePrices, setBasePrices] = useState<BasePrices>(emptyBasePrices);
  const [baseTouched, setBaseTouched] = useState(false);

  const pricesQuery = useQuery({
    queryKey: ["model-prices", modelId],
    queryFn: () => listModelPrices(modelId!),
    enabled: open && modelId != null && modelId > 0,
  });

  const currentModelPrice = useMemo(
    () => pickCurrentModelPrice(pricesQuery.data ?? []),
    [pricesQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    const saved = loadSavedRatios(channelId);
    setTopUpRatio(saved.topUpRatio);
    setModelRatio(saved.modelRatio);
  }, [channelId, open]);

  useEffect(() => {
    setBaseTouched(false);
    setBasePrices(emptyBasePrices());
  }, [modelId]);

  useEffect(() => {
    if (!open || baseTouched || pricesQuery.isPending) return;
    setBasePrices(basePricesFromModelPrice(currentModelPrice));
  }, [baseTouched, currentModelPrice, open, pricesQuery.isPending, modelId]);

  useEffect(() => {
    if (!open) return;
    saveRatios(channelId, { topUpRatio, modelRatio });
  }, [channelId, open, topUpRatio, modelRatio]);

  const topUp = parseRatio(topUpRatio);
  const model = parseRatio(modelRatio);
  const ratiosReady = topUp != null && model != null;

  const computed = useMemo(() => {
    const out: Partial<CostAmounts> = {};
    if (!ratiosReady || topUp == null || model == null) return out;

    for (const f of CALC_FIELDS) {
      const raw = basePrices[f.baseKey].trim();
      if (raw === "") continue;
      const base = Number(raw);
      if (!Number.isFinite(base)) continue;
      const amount = calcChannelCostAmount(topUp, model, base);
      if (amount == null) continue;
      out[f.costKey] = roundPrice3(amount);
    }
    return out;
  }, [basePrices, model, ratiosReady, topUp]);

  const hasComputed = Object.keys(computed).length > 0;
  const hasRequiredBase =
    basePrices.uncached_input.trim() !== "" && basePrices.output.trim() !== "";

  const calcSteps = useMemo(() => {
    if (!ratiosReady || topUp == null || model == null) return [];

    return CALC_FIELDS.flatMap((f) => {
      const raw = basePrices[f.baseKey].trim();
      if (raw === "") return [];
      const base = Number(raw);
      if (!Number.isFinite(base)) return [];
      const result = computed[f.costKey];
      if (result == null) return [];
      return [
        {
          label: f.label,
          expression: `${topUpRatio} × ${modelRatio} × ${trimDecimal(raw)} = ${result}`,
        },
      ];
    });
  }, [basePrices, computed, model, modelRatio, ratiosReady, topUp, topUpRatio]);

  function applyCosts() {
    if (!hasComputed) return;
    onApply(computed);
    setOpen(false);
  }

  const canOpen = modelId != null && modelId > 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={!canOpen}
        onClick={() => setOpen(true)}
      >
        <CalculatorIcon data-icon="inline-start" />
        成本换算
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <DetailSheetContent
          side="right"
          size="md"
          className="z-[60] sm:max-w-md"
          overlayClassName="z-[60]"
          closeOnOutsideClick
        >
          <SheetHeader>
            <SheetTitle>成本换算</SheetTitle>
            <SheetDescription>
              成本 = 充值倍率 × 模型倍率 × 模型基准价
              {modelLabel ? ` · ${modelLabel}` : ""}
            </SheetDescription>
          </SheetHeader>

          <SheetMain className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldCompact
                id="calc_top_up"
                label="充值倍率"
                hint="实际支付相对平台额度的倍率，如充 1 元得 10 美元额度时常见 0.07。"
                value={topUpRatio}
                onChange={setTopUpRatio}
                placeholder="0.07"
              />
              <FieldCompact
                id="calc_model"
                label="模型倍率"
                hint="该渠道在平台上的模型倍率，乘以模型基准价得到上游展示价。"
                value={modelRatio}
                onChange={setModelRatio}
                placeholder="2.8"
              />
            </div>

            {pricesQuery.isPending ? (
              <Skeleton className="h-32 w-full" />
            ) : !currentModelPrice && !baseTouched ? (
              <p className="text-amber-600 dark:text-amber-400 text-xs">
                该模型暂无生效中的基准售价，请手动填写基准价。
              </p>
            ) : null}

            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 text-xs font-medium">
                <div>分项</div>
                <div>模型基准价</div>
                <div>换算成本</div>
              </div>
              {CALC_FIELDS.map((f) => (
                <div
                  key={f.baseKey}
                  className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 border-t px-3 py-2"
                >
                  <div className="text-sm">{f.label}</div>
                  <Input
                    value={basePrices[f.baseKey]}
                    onChange={(e) => {
                      setBaseTouched(true);
                      setBasePrices((s) => ({ ...s, [f.baseKey]: e.target.value }));
                    }}
                    placeholder="—"
                    inputMode="decimal"
                    className="h-8"
                  />
                  <div className="text-muted-foreground tabular-nums text-sm">
                    {computed[f.costKey] ?? "—"}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-muted/20 px-3 py-2.5">
              <div className="text-xs font-medium">计算公式</div>
              <p className="text-muted-foreground mt-1 tabular-nums text-xs">
                成本 = 充值倍率 × 模型倍率 × 模型基准价
              </p>
              <div className="mt-2.5 text-xs font-medium">计算步骤</div>
              {!ratiosReady ? (
                <p className="text-muted-foreground mt-1 text-xs">请先填写充值倍率和模型倍率</p>
              ) : calcSteps.length === 0 ? (
                <p className="text-muted-foreground mt-1 text-xs">填写模型基准价后展示各分项计算</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {calcSteps.map((step) => (
                    <li key={step.label} className="tabular-nums text-xs">
                      <span className="text-muted-foreground">{step.label}：</span>
                      {step.expression}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SheetMain>

          <SheetFooter className="border-t flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              disabled={!hasComputed || !hasRequiredBase}
              onClick={applyCosts}
            >
              填入成本
            </Button>
          </SheetFooter>
        </DetailSheetContent>
      </Sheet>
    </>
  );
}

function FieldCompact({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <HintLabel htmlFor={id} hint={hint}>
        {label}
      </HintLabel>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="h-8"
      />
    </div>
  );
}
