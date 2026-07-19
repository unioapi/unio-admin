import { useEffect, useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
} from "lucide-react";
import {
  createModelPrice,
  listModelPrices,
  updateModelPrice,
  type ModelPrice,
} from "@/lib/api/modelPrices";
import { type Model } from "@/lib/api/models";
import { apiErrorMessage } from "@/lib/api/client";
import {
  formatDateTime,
  localToRFC3339,
  rfc3339ToLocal,
  roundPrice3,
  trimDecimal,
} from "@/lib/format";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { HintLabel } from "@/components/common/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MONEY_PATTERN = /^\d+(\.\d+)?$/;
const MULTIPLIER_PATTERN = /^\d+(\.\d+)?$/;

/** OpenAI GPT-5.4+ / sub2api 官方长上下文阶梯默认值。 */
const DEFAULT_LONG_CONTEXT = {
  threshold: "272000",
  inputMultiplier: "2",
  outputMultiplier: "1.5",
} as const;

// 基准售价分项：六个分项，前两个（未缓存输入/输出）必填。
// 缓存写入按 TTL 分档（DEC-030）：5m/1h 为 Anthropic，30m 为 OpenAI GPT-5.6+。
// 文案与请求列表 / 费用拆分对齐：缓存读取、缓存写入·TTL、推理输出。
const PRICE_FIELDS = [
  { key: "uncached_input", label: "未缓存输入", required: true },
  { key: "output", label: "输出", required: true },
  { key: "cache_read_input", label: "缓存读取", required: false },
  {
    key: "cache_write_5m_input",
    label: "缓存写入·5m",
    required: false,
    vendor: "Anthropic",
  },
  {
    key: "cache_write_1h_input",
    label: "缓存写入·1h",
    required: false,
    vendor: "Anthropic",
  },
  {
    key: "cache_write_30m_input",
    label: "缓存写入·30m",
    required: false,
    vendor: "OpenAI",
  },
  { key: "reasoning_output", label: "推理输出", required: false },
] as const;

type PriceFieldKey = (typeof PRICE_FIELDS)[number]["key"];

/** 相对未缓存输入的官方缓存倍率（DEC-030 / Anthropic passthrough-audit）。仍落库为绝对价。 */
const CACHE_RATIO_FROM_UNCACHED = {
  cache_read_input: 0.1,
  cache_write_5m_input: 1.25,
  cache_write_1h_input: 2,
  cache_write_30m_input: 1.25,
} as const;

type CacheRatioFieldKey = keyof typeof CACHE_RATIO_FROM_UNCACHED;

const CACHE_RATIO_KEYS = Object.keys(
  CACHE_RATIO_FROM_UNCACHED,
) as CacheRatioFieldKey[];

export function ModelPricesDialog({
  open,
  onOpenChange,
  model,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: Model;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {open && <ModelPriceManager model={model} />}
      </DialogContent>
    </Dialog>
  );
}

function ModelPriceManager({ model }: { model: Model }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create">("list");
  const pricesKey = ["model-prices", model.id];

  const pricesQuery = useQuery({
    queryKey: pricesKey,
    queryFn: () => listModelPrices(model.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: pricesKey });
    // 运维列表 [models, "ops-list", ...] 的基准价来自聚合接口，改价后需一并刷新。
    queryClient.invalidateQueries({ queryKey: ["models"] });
  };

  const prices = pricesQuery.data ?? [];

  if (mode === "create") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogHeader className="shrink-0 px-4 pt-4 pr-12">
          <DialogTitle>新建模型基准售价</DialogTitle>
          <DialogDescription>
            为「{model.display_name}」配置基准售价（按每百万 token 计）。客户最终售价 = 基准价 × 线路倍率。
          </DialogDescription>
        </DialogHeader>
        <ModelPriceForm
          modelId={model.id}
          referenceInput={roundPrice3(model.input_price_usd_per_million_tokens)}
          referenceOutput={roundPrice3(model.output_price_usd_per_million_tokens)}
          onCancel={() => setMode("list")}
          onCreated={() => {
            invalidate();
            setMode("list");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 pr-12">
      <DialogHeader className="shrink-0">
        <DialogTitle>模型基准售价</DialogTitle>
        <DialogDescription>
          「{model.display_name}」的基准售价（含历史与停用）。价格不可删，改价请新建一条并关闭旧窗口。
        </DialogDescription>
      </DialogHeader>

      <div className="shrink-0">
        <Button size="sm" onClick={() => setMode("create")}>
          <PlusIcon data-icon="inline-start" />
          新建基准售价
        </Button>
      </div>

      {pricesQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{pricesQuery.error.message}</AlertDescription>
        </Alert>
      ) : pricesQuery.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : prices.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          还没有配置基准售价
        </p>
      ) : (
        <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto rounded-md border">
          {prices.map((p) => (
            <ModelPriceRow key={p.id} price={p} onChanged={invalidate} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ModelPriceForm({
  modelId,
  referenceInput,
  referenceOutput,
  onCancel,
  onCreated,
}: {
  modelId: number;
  referenceInput?: string;
  referenceOutput?: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [currency, setCurrency] = useState("USD");
  const [price, setPrice] = useState<Record<PriceFieldKey, string>>(emptyAmounts);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [status, setStatus] = useState("enabled");
  const [longContextEnabled, setLongContextEnabled] = useState(false);
  const [longContextThreshold, setLongContextThreshold] = useState<string>(
    DEFAULT_LONG_CONTEXT.threshold,
  );
  const [longContextInputMultiplier, setLongContextInputMultiplier] = useState<string>(
    DEFAULT_LONG_CONTEXT.inputMultiplier,
  );
  const [longContextOutputMultiplier, setLongContextOutputMultiplier] = useState<string>(
    DEFAULT_LONG_CONTEXT.outputMultiplier,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOverwriteCache, setConfirmOverwriteCache] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars: { effectiveFrom: string; effectiveTo: string | null }) =>
      createModelPrice({
        modelId,
        currency: currency.trim(),
        pricing_unit: "per_1m_tokens",
        uncached_input_price: price.uncached_input.trim(),
        output_price: price.output.trim(),
        cache_read_input_price: optionalMoney(price.cache_read_input),
        reasoning_output_price: optionalMoney(price.reasoning_output),
        cache_write_5m_input_price: optionalMoney(price.cache_write_5m_input),
        cache_write_1h_input_price: optionalMoney(price.cache_write_1h_input),
        cache_write_30m_input_price: optionalMoney(price.cache_write_30m_input),
        long_context_enabled: longContextEnabled,
        long_context_threshold: longContextEnabled
          ? Number(longContextThreshold.trim())
          : optionalInt(longContextThreshold),
        long_context_input_multiplier: longContextEnabled
          ? longContextInputMultiplier.trim()
          : optionalMoney(longContextInputMultiplier),
        long_context_output_multiplier: longContextEnabled
          ? longContextOutputMultiplier.trim()
          : optionalMoney(longContextOutputMultiplier),
        status,
        effective_from: vars.effectiveFrom,
        effective_to: vars.effectiveTo,
      }),
    onSuccess: () => {
      toast.success("已新增模型基准售价");
      onCreated();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (currency.trim() === "") next.currency = "币种不能为空";

    for (const f of PRICE_FIELDS) {
      const val = price[f.key].trim();
      if (f.required && val === "") {
        next[`price_${f.key}`] = "基准价必填";
      } else if (val !== "" && !MONEY_PATTERN.test(val)) {
        next[`price_${f.key}`] = "需为非负小数";
      }
    }

    if (longContextEnabled) {
      const thr = longContextThreshold.trim();
      if (thr === "" || !/^\d+$/.test(thr) || Number(thr) <= 0) {
        next.long_context_threshold = "须为正整数";
      }
      const inMult = longContextInputMultiplier.trim();
      if (inMult === "" || !MULTIPLIER_PATTERN.test(inMult) || Number(inMult) <= 0) {
        next.long_context_input_multiplier = "须为正数";
      }
      const outMult = longContextOutputMultiplier.trim();
      if (outMult === "" || !MULTIPLIER_PATTERN.test(outMult) || Number(outMult) <= 0) {
        next.long_context_output_multiplier = "须为正数";
      }
    }

    // 生效开始留空即默认取创建时间；仅当填了结束时间时校验须晚于开始（留空时以「现在」为准）。
    if (effectiveTo.trim() !== "") {
      const fromForCheck = effectiveFrom.trim()
        ? new Date(effectiveFrom)
        : new Date();
      if (new Date(effectiveTo) <= fromForCheck) {
        next.effective_to = effectiveFrom.trim()
          ? "结束时间须晚于开始时间"
          : "结束时间须晚于当前时间";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // 开始时间留空 → 默认取当前时间（创建即生效），省去每次手动选。
    const from = effectiveFrom.trim()
      ? localToRFC3339(effectiveFrom)
      : new Date().toISOString();
    const to = effectiveTo.trim() ? localToRFC3339(effectiveTo) : null;
    mutation.mutate({ effectiveFrom: from, effectiveTo: to });
  }

  const hasReference = !!(referenceInput || referenceOutput);
  function fillReference() {
    setPrice((s) => ({
      ...s,
      uncached_input: referenceInput || s.uncached_input,
      output: referenceOutput || s.output,
    }));
  }

  const uncachedBase = price.uncached_input.trim();
  const uncachedBaseOk = MONEY_PATTERN.test(uncachedBase);
  const uncachedBaseNum = uncachedBaseOk ? Number(uncachedBase) : NaN;

  /** 按官方倍率写入缓存分项绝对价；默认只填空，已填需确认后覆盖。 */
  function fillOfficialCacheRatios(overwrite: boolean) {
    if (!uncachedBaseOk) {
      toast.error("请先填写未缓存输入");
      return;
    }
    const emptyKeys = CACHE_RATIO_KEYS.filter((k) => price[k].trim() === "");
    if (!overwrite && emptyKeys.length === 0) {
      setConfirmOverwriteCache(true);
      return;
    }
    const targets = overwrite ? CACHE_RATIO_KEYS : emptyKeys;
    setPrice((s) => {
      const next = { ...s };
      for (const key of targets) {
        next[key] = roundPrice3(
          Number(s.uncached_input.trim()) * CACHE_RATIO_FROM_UNCACHED[key],
        );
      }
      return next;
    });
    setConfirmOverwriteCache(false);
    toast.success(
      overwrite
        ? "已按官方倍率覆盖缓存分项"
        : `已填入 ${targets.length} 项缓存价（官方倍率）`,
    );
  }

  // 校验失败时若长上下文字段有错，自动展开折叠区。
  const longContextHasError =
    !!errors.long_context_threshold ||
    !!errors.long_context_input_multiplier ||
    !!errors.long_context_output_multiplier;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <Field data-invalid={!!errors.currency}>
          <HintLabel htmlFor="mp_currency" hint="基准价计价币种（如 USD）；计价单位为每百万 token。">
            币种
          </HintLabel>
          <Input
            id="mp_currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="USD"
            aria-invalid={!!errors.currency}
            className="max-w-40"
          />
          <FieldError>{errors.currency}</FieldError>
        </Field>

        {hasReference ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              采纳参考价（每百万 token）：输入 {referenceInput || "—"} / 输出{" "}
              {referenceOutput || "—"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto h-7"
              onClick={fillReference}
            >
              填入未缓存输入 / 输出
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            缓存分项可按未缓存输入 × 官方倍率推算：缓存读取 0.1 / 写入·5m·30m 1.25 / 写入·1h 2（仅填空项）
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-7"
            disabled={!uncachedBaseOk}
            onClick={() => fillOfficialCacheRatios(false)}
          >
            按官方倍率填入
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1.4fr_1fr] gap-2 px-3 py-1.5 text-xs font-medium">
            <div>分项</div>
            <div>基准价</div>
          </div>
          {PRICE_FIELDS.map((f) => {
            const ratio =
              f.key in CACHE_RATIO_FROM_UNCACHED
                ? CACHE_RATIO_FROM_UNCACHED[f.key as CacheRatioFieldKey]
                : undefined;
            const suggested =
              ratio != null && uncachedBaseOk
                ? roundPrice3(uncachedBaseNum * ratio)
                : undefined;
            return (
              <PriceRow
                key={f.key}
                label={f.label}
                required={f.required}
                vendor={"vendor" in f ? f.vendor : undefined}
                ratioHint={
                  ratio != null ? `${trimDecimal(String(ratio))}×` : undefined
                }
                price={price[f.key]}
                priceError={errors[`price_${f.key}`]}
                placeholder={suggested}
                onPrice={(v) => setPrice((s) => ({ ...s, [f.key]: v }))}
              />
            );
          })}
        </div>

        <ConfirmActionDialog
          open={confirmOverwriteCache}
          onOpenChange={setConfirmOverwriteCache}
          title="覆盖已填的缓存价？"
          description="缓存读取与各档缓存写入均已有值。确认后将全部按当前未缓存输入 × 官方倍率重算覆盖。"
          confirmLabel="确认覆盖"
          onConfirm={() => fillOfficialCacheRatios(true)}
        />

        <LongContextSection
          enabled={longContextEnabled}
          onEnabledChange={(next) => {
            setLongContextEnabled(next);
            if (next) {
              if (!longContextThreshold.trim()) {
                setLongContextThreshold(DEFAULT_LONG_CONTEXT.threshold);
              }
              if (!longContextInputMultiplier.trim()) {
                setLongContextInputMultiplier(DEFAULT_LONG_CONTEXT.inputMultiplier);
              }
              if (!longContextOutputMultiplier.trim()) {
                setLongContextOutputMultiplier(DEFAULT_LONG_CONTEXT.outputMultiplier);
              }
            }
          }}
          threshold={longContextThreshold}
          onThresholdChange={setLongContextThreshold}
          inputMultiplier={longContextInputMultiplier}
          onInputMultiplierChange={setLongContextInputMultiplier}
          outputMultiplier={longContextOutputMultiplier}
          onOutputMultiplierChange={setLongContextOutputMultiplier}
          errors={errors}
          forceOpen={longContextHasError}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.effective_from}>
            <HintLabel
              htmlFor="mp_from"
              hint="该基准价开始生效的时间点；留空默认取创建时间（立即生效）。"
            >
              生效开始（可选）
            </HintLabel>
            <DateTimePicker
              id="mp_from"
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              placeholder="留空默认创建时间"
              aria-invalid={!!errors.effective_from}
            />
            <FieldError>{errors.effective_from}</FieldError>
          </Field>

          <Field data-invalid={!!errors.effective_to}>
            <HintLabel htmlFor="mp_to" hint="该基准价的失效时间；留空表示长期有效。">
              生效结束（可选）
            </HintLabel>
            <DateTimePicker
              id="mp_to"
              value={effectiveTo}
              onChange={setEffectiveTo}
              placeholder="留空表示长期有效"
              aria-invalid={!!errors.effective_to}
            />
            <FieldError>{errors.effective_to}</FieldError>
          </Field>
        </div>

        <Field>
          <HintLabel htmlFor="mp_status" hint="启用后在其生效区间内参与计费；停用则不参与。">
            状态
          </HintLabel>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="mp_status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled">启用</SelectItem>
              <SelectItem value="disabled">停用</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="bg-muted/50 flex shrink-0 justify-end gap-2 border-t p-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          <ArrowLeftIcon data-icon="inline-start" />
          返回
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          {mutation.isPending ? "保存中..." : "创建"}
        </Button>
      </div>
    </form>
  );
}

function PriceRow({
  label,
  required,
  vendor,
  ratioHint,
  price,
  priceError,
  placeholder,
  onPrice,
}: {
  label: string;
  required: boolean;
  vendor?: "Anthropic" | "OpenAI";
  /** 官方倍率提示，如「0.1×」，展示在分项标签旁。 */
  ratioHint?: string;
  price: string;
  priceError?: string;
  /** 有未缓存输入时可推算的占位值；否则回退必填 0.00 / 选填 —。 */
  placeholder?: string;
  onPrice: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr] items-start gap-2 border-t px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-sm">
        <span>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </span>
        {vendor && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
            {vendor}
          </Badge>
        )}
        {ratioHint && (
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {ratioHint}
          </span>
        )}
      </div>
      <div>
        <Input
          value={price}
          onChange={(e) => onPrice(e.target.value)}
          placeholder={placeholder ?? (required ? "0.00" : "—")}
          inputMode="decimal"
          aria-invalid={!!priceError}
          className="h-8"
        />
        {priceError && (
          <p className="text-destructive mt-1 text-xs">{priceError}</p>
        )}
      </div>
    </div>
  );
}

function ModelPriceRow({
  price,
  onChanged,
}: {
  price: ModelPrice;
  onChanged: () => void;
}) {
  const [draftTo, setDraftTo] = useState(rfc3339ToLocal(price.effective_to));
  const [pendingStatus, setPendingStatus] = useState<"enabled" | "disabled" | null>(
    null,
  );

  const mutation = useMutation({
    mutationFn: (vars: { status: string; effective_to: string | null }) =>
      updateModelPrice({
        id: price.id,
        status: vars.status,
        effective_to: vars.effective_to,
      }),
    onSuccess: () => {
      setPendingStatus(null);
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const enabled = price.status === "enabled";
  const currentTo = rfc3339ToLocal(price.effective_to);
  const dirty = draftTo !== currentTo;
  const busy = mutation.isPending;
  const disabling = pendingStatus === "disabled";

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
      <div className="min-w-48 flex-1">
        <div className="text-muted-foreground text-xs">
          {price.currency} · 基准价 输入 {trimDecimal(price.uncached_input_price)} /
          输出 {trimDecimal(price.output_price)}
        </div>
        <div className="text-muted-foreground text-xs">
          {formatDateTime(price.effective_from)} ~{" "}
          {price.effective_to ? formatDateTime(price.effective_to) : "长期"}
        </div>
        {price.long_context_enabled ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge className="h-5 bg-amber-600/90 px-1.5 text-[10px] font-medium text-white hover:bg-amber-600/90">
              长上下文阶梯
            </Badge>
            <span className="text-muted-foreground text-[11px]">
              &gt;{price.long_context_threshold?.toLocaleString() ?? "—"} tokens · 输入 ×
              {trimDecimal(price.long_context_input_multiplier ?? "—")} · 输出 ×
              {trimDecimal(price.long_context_output_multiplier ?? "—")}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <DateTimePicker
          value={draftTo}
          onChange={setDraftTo}
          placeholder="生效结束时间"
          className="h-8 w-56"
        />
        {dirty && (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="保存结束时间"
            disabled={busy}
            onClick={() =>
              mutation.mutate({
                status: price.status,
                effective_to: draftTo.trim() ? localToRFC3339(draftTo) : null,
              })
            }
          >
            <CheckIcon />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={enabled}
          disabled={busy}
          onCheckedChange={(next) =>
            setPendingStatus(next ? "enabled" : "disabled")
          }
          aria-label={`切换基准价 ${price.id} 状态`}
        />
        <Badge variant={enabled ? "default" : "secondary"}>
          {enabled ? "启用" : "停用"}
        </Badge>
      </div>

      <ConfirmActionDialog
        open={pendingStatus != null}
        onOpenChange={(o) => {
          if (!o && !busy) setPendingStatus(null);
        }}
        title={disabling ? "停用基准售价" : "启用基准售价"}
        description={
          disabling
            ? "确认停用这条基准售价？停用后不再参与计费，可随时重新启用。"
            : "确认启用这条基准售价？启用后将在其生效区间内参与计费。"
        }
        confirmLabel={disabling ? "确认停用" : "确认启用"}
        destructive={disabling}
        pending={busy}
        onConfirm={() =>
          pendingStatus &&
          mutation.mutate({
            status: pendingStatus,
            effective_to: price.effective_to,
          })
        }
      />
    </li>
  );
}

function LongContextSection({
  enabled,
  onEnabledChange,
  threshold,
  onThresholdChange,
  inputMultiplier,
  onInputMultiplierChange,
  outputMultiplier,
  onOutputMultiplierChange,
  errors,
  forceOpen = false,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  threshold: string;
  onThresholdChange: (v: string) => void;
  inputMultiplier: string;
  onInputMultiplierChange: (v: string) => void;
  outputMultiplier: string;
  onOutputMultiplierChange: (v: string) => void;
  errors: Record<string, string>;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const summary = enabled
    ? `已启用 · >${Number(threshold || DEFAULT_LONG_CONTEXT.threshold).toLocaleString()} · 输入 ×${inputMultiplier || DEFAULT_LONG_CONTEXT.inputMultiplier} · 输出 ×${outputMultiplier || DEFAULT_LONG_CONTEXT.outputMultiplier}`
    : "关闭（按基准价计费）";

  return (
    <section
      className={cn(
        "rounded-lg border p-0 transition-colors",
        enabled
          ? "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-orange-500/[0.05]"
          : "border-dashed bg-muted/20",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium tracking-tight">长上下文阶梯</span>
            <Badge
              variant="outline"
              className="h-5 border-amber-600/30 px-1.5 text-[10px] font-normal text-amber-800 dark:text-amber-200"
            >
              GPT-5.4+
            </Badge>
            {enabled ? (
              <Badge className="h-4 bg-amber-600/90 px-1.5 text-[10px] font-medium text-white hover:bg-amber-600/90">
                已启用
              </Badge>
            ) : null}
          </div>
          {!open ? (
            <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-snug">
              {summary}
            </p>
          ) : null}
        </div>
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-amber-500/15 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-muted-foreground text-[11px] leading-snug">
              输入合计超阈值时，整单输入 × 输入倍率、输出 × 输出倍率（售价与成本同步）。
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {enabled ? "已启用" : "关闭"}
              </span>
              <Switch
                checked={enabled}
                onCheckedChange={onEnabledChange}
                aria-label="启用长上下文阶梯"
              />
            </div>
          </div>

          {enabled ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field data-invalid={!!errors.long_context_threshold}>
                <HintLabel
                  htmlFor="mp_lc_threshold"
                  hint="输入侧 token 合计超过该值时触发阶梯（严格大于）。OpenAI 官方为 272000。"
                >
                  阈值（tokens）
                </HintLabel>
                <Input
                  id="mp_lc_threshold"
                  value={threshold}
                  onChange={(e) => onThresholdChange(e.target.value)}
                  inputMode="numeric"
                  placeholder={DEFAULT_LONG_CONTEXT.threshold}
                  aria-invalid={!!errors.long_context_threshold}
                  className="h-9 font-mono text-sm"
                />
                <FieldError>{errors.long_context_threshold}</FieldError>
              </Field>
              <Field data-invalid={!!errors.long_context_input_multiplier}>
                <HintLabel
                  htmlFor="mp_lc_in"
                  hint="触发后，所有输入侧分项单价乘以该倍率（含未缓存输入 / 缓存读取 / 缓存写入）。"
                >
                  输入倍率
                </HintLabel>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs">
                    ×
                  </span>
                  <Input
                    id="mp_lc_in"
                    value={inputMultiplier}
                    onChange={(e) => onInputMultiplierChange(e.target.value)}
                    inputMode="decimal"
                    placeholder={DEFAULT_LONG_CONTEXT.inputMultiplier}
                    aria-invalid={!!errors.long_context_input_multiplier}
                    className="h-9 pl-6 font-mono text-sm"
                  />
                </div>
                <FieldError>{errors.long_context_input_multiplier}</FieldError>
              </Field>
              <Field data-invalid={!!errors.long_context_output_multiplier}>
                <HintLabel
                  htmlFor="mp_lc_out"
                  hint="触发后，输出与推理输出单价乘以该倍率。"
                >
                  输出倍率
                </HintLabel>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs">
                    ×
                  </span>
                  <Input
                    id="mp_lc_out"
                    value={outputMultiplier}
                    onChange={(e) => onOutputMultiplierChange(e.target.value)}
                    inputMode="decimal"
                    placeholder={DEFAULT_LONG_CONTEXT.outputMultiplier}
                    aria-invalid={!!errors.long_context_output_multiplier}
                    className="h-9 pl-6 font-mono text-sm"
                  />
                </div>
                <FieldError>{errors.long_context_output_multiplier}</FieldError>
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function emptyAmounts(): Record<PriceFieldKey, string> {
  return {
    uncached_input: "",
    output: "",
    cache_read_input: "",
    reasoning_output: "",
    cache_write_5m_input: "",
    cache_write_1h_input: "",
    cache_write_30m_input: "",
  };
}

function optionalMoney(raw: string): string | null {
  const s = raw.trim();
  return s === "" ? null : s;
}

function optionalInt(raw: string): number | null {
  const s = raw.trim();
  if (s === "" || !/^\d+$/.test(s)) return null;
  return Number(s);
}
