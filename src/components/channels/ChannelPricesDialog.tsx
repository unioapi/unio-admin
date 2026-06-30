import { useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, PlusIcon } from "lucide-react";
import {
  createChannelPrice,
  listChannelPrices,
  updateChannelPrice,
  type ChannelPrice,
} from "@/lib/api/channelPrices";
import { listChannelModels } from "@/lib/api/channelModels";
import { type Channel } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import {
  formatDateTime,
  localToRFC3339,
  rfc3339ToLocal,
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

// 成本分项：六个分项，前两个（未缓存输入/输出）成本必填（DEC-026：渠道只录成本）。
const COST_FIELDS = [
  { key: "uncached_input", label: "未缓存输入", required: true },
  { key: "output", label: "输出", required: true },
  { key: "cache_read_input", label: "缓存读取输入", required: false },
  { key: "reasoning_output", label: "reasoning 输出", required: false },
  { key: "cache_write_5m_input", label: "5 分钟缓存写入", required: false },
  { key: "cache_write_1h_input", label: "1 小时缓存写入", required: false },
] as const;

type CostFieldKey = (typeof COST_FIELDS)[number]["key"];

export function ChannelPricesDialog({
  open,
  onOpenChange,
  channel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {open && <ChannelPriceManager channel={channel} />}
      </DialogContent>
    </Dialog>
  );
}

function ChannelPriceManager({ channel }: { channel: Channel }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create">("list");
  const pricesKey = ["channel-prices", channel.id];

  const pricesQuery = useQuery({
    queryKey: pricesKey,
    queryFn: () => listChannelPrices(channel.id),
  });

  const bindingsQuery = useQuery({
    queryKey: ["channel-models", channel.id],
    queryFn: () => listChannelModels(channel.id),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: pricesKey });

  const prices = pricesQuery.data ?? [];

  if (mode === "create") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>新建渠道-模型成本价</DialogTitle>
          <DialogDescription>
            为「{channel.name}」的某个已绑定模型配置上游成本价（按每百万 token 计）。
            客户售价 = 模型基准价 × 线路倍率（与渠道解耦），此处只录成本。
          </DialogDescription>
        </DialogHeader>
        <ChannelPriceForm
          channelId={channel.id}
          bindings={bindingsQuery.data ?? []}
          bindingsLoading={bindingsQuery.isPending}
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
        <DialogTitle>渠道-模型成本价</DialogTitle>
        <DialogDescription>
          「{channel.name}」各模型的上游成本价（含历史与停用）。价格不可删，改价请新建一条并关闭旧窗口。
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div>
          <Button size="sm" onClick={() => setMode("create")}>
            <PlusIcon data-icon="inline-start" />
            新建渠道-模型成本价
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
            还没有配置渠道-模型成本价
          </p>
        ) : (
          <ul className="divide-border max-h-[60vh] divide-y overflow-y-auto rounded-md border">
            {prices.map((p) => (
              <ChannelPriceRow key={p.id} price={p} onChanged={invalidate} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ChannelPriceForm({
  channelId,
  bindings,
  bindingsLoading,
  onCancel,
  onCreated,
}: {
  channelId: number;
  bindings: { model_id: number; model_external_id: string }[];
  bindingsLoading: boolean;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [modelId, setModelId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [cost, setCost] = useState<Record<CostFieldKey, string>>(emptyAmounts);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [status, setStatus] = useState("enabled");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      createChannelPrice({
        channelId,
        modelId: Number(modelId),
        currency: currency.trim(),
        pricing_unit: "per_1m_tokens",
        uncached_input_cost: cost.uncached_input.trim(),
        output_cost: cost.output.trim(),
        cache_read_input_cost: optionalMoney(cost.cache_read_input),
        reasoning_output_cost: optionalMoney(cost.reasoning_output),
        cache_write_5m_input_cost: optionalMoney(cost.cache_write_5m_input),
        cache_write_1h_input_cost: optionalMoney(cost.cache_write_1h_input),
        status,
        effective_from: localToRFC3339(effectiveFrom),
        effective_to: effectiveTo.trim() ? localToRFC3339(effectiveTo) : null,
      }),
    onSuccess: (created) => {
      toast.success(`已为「${created.model_external_id}」新增渠道-模型成本价`);
      onCreated();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!(Number(modelId) > 0)) next.model_id = "请选择模型";
    if (currency.trim() === "") next.currency = "币种不能为空";

    for (const f of COST_FIELDS) {
      const costVal = cost[f.key].trim();
      if (f.required && costVal === "") {
        next[`cost_${f.key}`] = "成本必填";
      } else if (costVal !== "" && !MONEY_PATTERN.test(costVal)) {
        next[`cost_${f.key}`] = "需为非负小数";
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!errors.model_id}>
          <HintLabel htmlFor="cp_model" hint="为该渠道下哪个已绑定模型录入成本价；需先绑定模型。">
            模型
          </HintLabel>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger
              id="cp_model"
              className="w-full"
              aria-invalid={!!errors.model_id}
            >
              <SelectValue
                placeholder={
                  bindingsLoading
                    ? "加载中…"
                    : bindings.length === 0
                      ? "请先绑定模型"
                      : "选择模型"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {bindings.map((b) => (
                <SelectItem key={b.model_id} value={String(b.model_id)}>
                  {b.model_external_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{errors.model_id}</FieldError>
        </Field>

        <Field data-invalid={!!errors.currency}>
          <HintLabel htmlFor="cp_currency" hint="成本计价币种（如 USD）；计价单位为每百万 token。">
            币种
          </HintLabel>
          <Input
            id="cp_currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="USD"
            aria-invalid={!!errors.currency}
          />
          <FieldError>{errors.currency}</FieldError>
        </Field>
      </div>

      {/* 只录成本：每个分项一栏成本（前两项必填）。 */}
      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1.4fr_1fr] gap-2 px-3 py-2 text-xs font-medium">
          <div>分项</div>
          <div>成本</div>
        </div>
        {COST_FIELDS.map((f) => (
          <CostRow
            key={f.key}
            label={f.label}
            required={f.required}
            cost={cost[f.key]}
            costError={errors[`cost_${f.key}`]}
            onCost={(v) => setCost((s) => ({ ...s, [f.key]: v }))}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!errors.effective_from}>
          <HintLabel htmlFor="cp_from" hint="该成本价开始生效的时间点。">
            生效开始
          </HintLabel>
          <DateTimePicker
            id="cp_from"
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            aria-invalid={!!errors.effective_from}
          />
          <FieldError>{errors.effective_from}</FieldError>
        </Field>

        <Field data-invalid={!!errors.effective_to}>
          <HintLabel htmlFor="cp_to" hint="该成本价的失效时间；留空表示长期有效。">
            生效结束（可选）
          </HintLabel>
          <DateTimePicker
            id="cp_to"
            value={effectiveTo}
            onChange={setEffectiveTo}
            placeholder="留空表示长期有效"
            aria-invalid={!!errors.effective_to}
          />
          <FieldError>{errors.effective_to}</FieldError>
        </Field>
      </div>

      <Field>
        <HintLabel htmlFor="cp_status" hint="启用后在其生效区间内参与计费；停用则不参与。渠道只录成本，不含售价。">
          状态
        </HintLabel>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="cp_status" className="w-full">
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

function CostRow({
  label,
  required,
  cost,
  costError,
  onCost,
}: {
  label: string;
  required: boolean;
  cost: string;
  costError?: string;
  onCost: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr] items-start gap-2 border-t px-3 py-2">
      <div className="pt-2 text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </div>
      <div>
        <Input
          value={cost}
          onChange={(e) => onCost(e.target.value)}
          placeholder={required ? "0.00" : "—"}
          inputMode="decimal"
          aria-invalid={!!costError}
          className="h-8"
        />
        {costError && (
          <p className="text-destructive mt-1 text-xs">{costError}</p>
        )}
      </div>
    </div>
  );
}

function ChannelPriceRow({
  price,
  onChanged,
}: {
  price: ChannelPrice;
  onChanged: () => void;
}) {
  const [draftTo, setDraftTo] = useState(rfc3339ToLocal(price.effective_to));
  const [pendingStatus, setPendingStatus] = useState<"enabled" | "disabled" | null>(
    null,
  );

  const mutation = useMutation({
    mutationFn: (vars: { status: string; effective_to: string | null }) =>
      updateChannelPrice({
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
        <div className="font-medium">{price.model_external_id}</div>
        <div className="text-muted-foreground text-xs">
          {price.currency} · 成本 输入 {trimDecimal(price.uncached_input_cost)} /
          输出 {trimDecimal(price.output_cost)}
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
          aria-label={`切换价格 ${price.id} 状态`}
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
        title={disabling ? "停用渠道-模型成本价" : "启用渠道-模型成本价"}
        description={
          disabling
            ? `确认停用「${price.model_external_id}」的这条成本价？停用后不再参与计费，可随时重新启用。`
            : `确认启用「${price.model_external_id}」的这条成本价？启用后将在其生效区间内参与计费。`
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

function emptyAmounts(): Record<CostFieldKey, string> {
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
