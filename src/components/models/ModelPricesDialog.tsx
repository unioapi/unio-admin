import { useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, PlusIcon } from "lucide-react";
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

// 基准售价分项：六个分项，前两个（未缓存输入/输出）必填。
const PRICE_FIELDS = [
  { key: "uncached_input", label: "未缓存输入", required: true },
  { key: "output", label: "输出", required: true },
  { key: "cache_read_input", label: "缓存读取输入", required: false },
  { key: "reasoning_output", label: "reasoning 输出", required: false },
  { key: "cache_write_5m_input", label: "5 分钟缓存写入", required: false },
  { key: "cache_write_1h_input", label: "1 小时缓存写入", required: false },
] as const;

type PriceFieldKey = (typeof PRICE_FIELDS)[number]["key"];

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
      <DialogContent className="sm:max-w-3xl">
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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: pricesKey });

  const prices = pricesQuery.data ?? [];

  if (mode === "create") {
    return (
      <>
        <DialogHeader>
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
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>模型基准售价</DialogTitle>
        <DialogDescription>
          「{model.display_name}」的基准售价（含历史与停用）。价格不可删，改价请新建一条并关闭旧窗口。
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div>
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
          <ul className="divide-border max-h-[60vh] divide-y overflow-y-auto rounded-md border">
            {prices.map((p) => (
              <ModelPriceRow key={p.id} price={p} onChanged={invalidate} />
            ))}
          </ul>
        )}
      </div>
    </>
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
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
        status,
        effective_from: localToRFC3339(effectiveFrom),
        effective_to: effectiveTo.trim() ? localToRFC3339(effectiveTo) : null,
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

    if (effectiveFrom.trim() === "") next.effective_from = "请选择生效开始时间";
    if (
      effectiveTo.trim() !== "" &&
      effectiveFrom.trim() !== "" &&
      new Date(effectiveTo) <= new Date(effectiveFrom)
    ) {
      next.effective_to = "结束时间须晚于开始时间";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  const hasReference = !!(referenceInput || referenceOutput);
  function fillReference() {
    setPrice((s) => ({
      ...s,
      uncached_input: referenceInput || s.uncached_input,
      output: referenceOutput || s.output,
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

      {/* 基准售价：每个分项一栏（前两项必填）。 */}
      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1.4fr_1fr] gap-2 px-3 py-2 text-xs font-medium">
          <div>分项</div>
          <div>基准价</div>
        </div>
        {PRICE_FIELDS.map((f) => (
          <PriceRow
            key={f.key}
            label={f.label}
            required={f.required}
            price={price[f.key]}
            priceError={errors[`price_${f.key}`]}
            onPrice={(v) => setPrice((s) => ({ ...s, [f.key]: v }))}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!errors.effective_from}>
          <HintLabel htmlFor="mp_from" hint="该基准价开始生效的时间点。">
            生效开始
          </HintLabel>
          <DateTimePicker
            id="mp_from"
            value={effectiveFrom}
            onChange={setEffectiveFrom}
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

      <div className="mt-2 flex justify-end gap-2">
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
  price,
  priceError,
  onPrice,
}: {
  label: string;
  required: boolean;
  price: string;
  priceError?: string;
  onPrice: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr] items-start gap-2 border-t px-3 py-2">
      <div className="pt-2 text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </div>
      <div>
        <Input
          value={price}
          onChange={(e) => onPrice(e.target.value)}
          placeholder={required ? "0.00" : "—"}
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

function emptyAmounts(): Record<PriceFieldKey, string> {
  return {
    uncached_input: "",
    output: "",
    cache_read_input: "",
    reasoning_output: "",
    cache_write_5m_input: "",
    cache_write_1h_input: "",
  };
}

function optionalMoney(raw: string): string | null {
  const s = raw.trim();
  return s === "" ? null : s;
}
