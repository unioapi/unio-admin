import { useMemo, useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon } from "lucide-react";
import {
  createChannelPrice,
  findOverlappingChannelPrices,
  listChannelPrices,
  pickCurrentChannelPrice,
  updateChannelPrice,
  type ChannelPrice,
} from "@/lib/api/channelPrices";
import { listChannelModels } from "@/lib/api/channelModels";
import { type Channel } from "@/lib/api/channels";
import { apiErrorCode, apiErrorMessage } from "@/lib/api/client";
import {
  formatDateTime,
  localToRFC3339,
  rfc3339ToLocal,
  roundPrice3,
  trimDecimal,
} from "@/lib/format";
import { cn } from "@/lib/utils";
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
  DialogFooter,
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
import { ChannelCostCalculator } from "@/components/channels/ChannelCostCalculator";

const MONEY_PATTERN = /^\d+(\.\d+)?$/;

// 成本分项：六个分项，前两个（未缓存输入/输出）成本必填（DEC-026：渠道只录成本）。
const COST_FIELDS = [
  { key: "uncached_input", label: "未缓存输入", required: true },
  { key: "output", label: "输出", required: true },
  { key: "cache_read_input", label: "缓存读取输入", required: false },
  { key: "reasoning_output", label: "reasoning 输出", required: false },
  { key: "cache_write_5m_input", label: "5 分钟缓存写入", required: false },
  { key: "cache_write_1h_input", label: "1 小时缓存写入", required: false },
  { key: "cache_write_30m_input", label: "30 分钟缓存写入", required: false },
] as const;

type CostFieldKey = (typeof COST_FIELDS)[number]["key"];

const COST_PRICE_FIELD: Record<
  CostFieldKey,
  | "uncached_input_cost"
  | "output_cost"
  | "cache_read_input_cost"
  | "reasoning_output_cost"
  | "cache_write_5m_input_cost"
  | "cache_write_1h_input_cost"
  | "cache_write_30m_input_cost"
> = {
  uncached_input: "uncached_input_cost",
  output: "output_cost",
  cache_read_input: "cache_read_input_cost",
  reasoning_output: "reasoning_output_cost",
  cache_write_5m_input: "cache_write_5m_input_cost",
  cache_write_1h_input: "cache_write_1h_input_cost",
  cache_write_30m_input: "cache_write_30m_input_cost",
};

const COST_TABLE_GRID =
  "grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,0.75fr)] gap-2";

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
      <DialogContent className="sm:max-w-4xl">
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
          onSaved={invalidate}
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
              <ChannelPriceRow
                key={p.id}
                price={p}
                prices={prices}
                onChanged={invalidate}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// 待确认的一次「覆盖现有价」创建：新价窗口 + 命中重叠的启用中历史价（按 effective_from 倒序）。
type PendingOverwrite = {
  effectiveFrom: string;
  effectiveTo: string | null;
  overlapping: ChannelPrice[];
};

function ChannelPriceForm({
  channelId,
  bindings,
  bindingsLoading,
  onCancel,
  onSaved,
  onCreated,
}: {
  channelId: number;
  bindings: { model_id: number; model_external_id: string }[];
  bindingsLoading: boolean;
  onCancel: () => void;
  onSaved: () => void;
  onCreated: () => void;
}) {
  const [modelId, setModelId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [cost, setCost] = useState<Record<CostFieldKey, string>>(emptyAmounts);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [status, setStatus] = useState("enabled");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [continueAfterCreate, setContinueAfterCreate] = useState(false);
  // 待用户在「覆盖现有价」弹窗中确认的一次创建：命中重叠历史价时暂存，确认后先关旧窗口再建新价。
  const [pendingOverwrite, setPendingOverwrite] =
    useState<PendingOverwrite | null>(null);

  const pricesQuery = useQuery({
    queryKey: ["channel-prices", channelId],
    queryFn: () => listChannelPrices(channelId),
    enabled: Number(modelId) > 0,
  });

  const currentPrice = useMemo(
    () => pickCurrentChannelPrice(pricesQuery.data ?? [], Number(modelId)),
    [modelId, pricesQuery.data],
  );

  const mutation = useMutation({
    // vars.overlapping：建新价前需先消解窗口重叠的启用中历史价（见 resolveOverlap 的两种处理）。
    mutationFn: async (vars: {
      effectiveFrom: string;
      effectiveTo: string | null;
      overlapping: ChannelPrice[];
    }) => {
      const fromMs = new Date(vars.effectiveFrom).getTime();
      for (const old of vars.overlapping) {
        if (new Date(old.effective_from).getTime() < fromMs) {
          // 旧价开始更早：收口到新价开始时间，保留其历史区间且仍启用（[oldFrom, newFrom)）。
          await updateChannelPrice({
            id: old.id,
            status: old.status,
            effective_to: vars.effectiveFrom,
          });
        } else {
          // 旧价开始不早于新价：无法向左收口（会得到零/负区间），新价已从更早或同一时刻覆盖它 → 停用。
          await updateChannelPrice({
            id: old.id,
            status: "disabled",
            effective_to: old.effective_to,
          });
        }
      }
      return createChannelPrice({
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
        cache_write_30m_input_cost: optionalMoney(cost.cache_write_30m_input),
        status,
        effective_from: vars.effectiveFrom,
        effective_to: vars.effectiveTo,
      });
    },
    onSuccess: (created) => {
      setPendingOverwrite(null);
      toast.success(`已为「${created.model_external_id}」新增渠道-模型成本价`);
      if (continueAfterCreate) {
        onSaved();
        resetForm();
        setContinueAfterCreate(false);
      } else {
        onCreated();
      }
    },
    onError: (err) => {
      setPendingOverwrite(null);
      setContinueAfterCreate(false);
      toast.error(apiErrorMessage(err));
    },
  });

  function resetForm() {
    setModelId("");
    setCost(emptyAmounts());
    setEffectiveFrom("");
    setEffectiveTo("");
    setStatus("enabled");
    setErrors({});
  }

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

    // 生效开始留空即默认取创建时间；仅当填了结束时间时校验须晚于开始（留空时以「现在」为准）。
    if (effectiveTo.trim() !== "") {
      const fromForCheck = effectiveFrom.trim() ? new Date(effectiveFrom) : new Date();
      if (new Date(effectiveTo) <= fromForCheck) {
        next.effective_to = effectiveFrom.trim()
          ? "结束时间须晚于开始时间"
          : "结束时间须晚于当前时间";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(continueEditing: boolean) {
    if (!validate()) return;
    // 开始时间留空 → 默认取当前时间（创建即生效），省去每次手动选。
    const from = effectiveFrom.trim()
      ? localToRFC3339(effectiveFrom)
      : new Date().toISOString();
    const to = effectiveTo.trim() ? localToRFC3339(effectiveTo) : null;

    // 停用价不参与窗口重叠校验（与后端一致），直接创建。
    const overlapping =
      status === "enabled"
        ? findOverlappingChannelPrices(
            pricesQuery.data ?? [],
            Number(modelId),
            from,
            to,
          )
        : [];

    setContinueAfterCreate(continueEditing);

    if (overlapping.length > 0) {
      // 有历史价：弹窗展示当前价 vs 新价对比，确认后再关旧窗口 + 建新价。
      setPendingOverwrite({ effectiveFrom: from, effectiveTo: to, overlapping });
      return;
    }

    mutation.mutate({ effectiveFrom: from, effectiveTo: to, overlapping: [] });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(false);
  }

  function handleCreateAndContinue(e: FormEvent) {
    e.preventDefault();
    submit(true);
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
          <div className="mt-2">
            <ChannelCostCalculator
              channelId={channelId}
              modelId={Number(modelId) > 0 ? Number(modelId) : null}
              modelLabel={
                bindings.find((b) => String(b.model_id) === modelId)?.model_external_id
              }
              onApply={(amounts) =>
                setCost((prev) => ({
                  ...prev,
                  ...amounts,
                }))
              }
            />
          </div>
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
        <div className={cn("bg-muted/40 text-muted-foreground px-3 py-2 text-xs font-medium", COST_TABLE_GRID)}>
          <div>分项</div>
          <div>当前价</div>
          <div>成本</div>
          <div>差额</div>
        </div>
        {COST_FIELDS.map((f) => (
          <CostRow
            key={f.key}
            label={f.label}
            required={f.required}
            cost={cost[f.key]}
            currentCost={readCurrentCost(currentPrice, f.key)}
            costError={errors[`cost_${f.key}`]}
            onCost={(v) => setCost((s) => ({ ...s, [f.key]: v }))}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!errors.effective_from}>
          <HintLabel
            htmlFor="cp_from"
            hint="该成本价开始生效的时间点；留空默认取创建时间（立即生效）。"
          >
            生效开始（可选）
          </HintLabel>
          <DateTimePicker
            id="cp_from"
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            placeholder="留空默认创建时间"
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
          返回
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={handleCreateAndContinue}
        >
          {mutation.isPending && continueAfterCreate && (
            <Spinner data-icon="inline-start" />
          )}
          创建并继续
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && !continueAfterCreate && (
            <Spinner data-icon="inline-start" />
          )}
          {mutation.isPending && !continueAfterCreate ? "保存中..." : "创建"}
        </Button>
      </div>

      <PriceOverwriteDialog
        pending={pendingOverwrite}
        currency={currency.trim() || "USD"}
        newCost={cost}
        busy={mutation.isPending}
        onCancel={() => {
          if (mutation.isPending) return;
          setPendingOverwrite(null);
          setContinueAfterCreate(false);
        }}
        onConfirm={() => {
          if (pendingOverwrite) mutation.mutate(pendingOverwrite);
        }}
      />
    </form>
  );
}

function PriceOverwriteDialog({
  pending,
  currency,
  newCost,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: PendingOverwrite | null;
  currency: string;
  newCost: Record<CostFieldKey, string>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // 取最近生效的一条作为「当前价」做逐项对比。
  const current = pending?.overlapping[0] ?? null;
  const fromMs = pending ? new Date(pending.effectiveFrom).getTime() : 0;

  return (
    <Dialog
      open={pending != null}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>覆盖现有成本价？</DialogTitle>
          <DialogDescription>
            {current
              ? `「${current.model_external_id}」已有与新价时间重叠的成本价。确认后：开始早于新价的会在新价生效时间收口，开始不早于新价的会被停用；随后新价生效，彼此不再重叠。`
              : "已有生效中的成本价，确认后将消解重叠并生效新价。"}
          </DialogDescription>
        </DialogHeader>

        {pending && current && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-md border">
              <div
                className={cn(
                  "bg-muted/40 text-muted-foreground px-3 py-2 text-xs font-medium",
                  COST_TABLE_GRID,
                )}
              >
                <div>分项</div>
                <div>当前价</div>
                <div>新价</div>
                <div>差额</div>
              </div>
              {COST_FIELDS.map((f) => {
                const cur = readCurrentCost(current, f.key);
                const next = newCost[f.key].trim();
                return (
                  <div
                    key={f.key}
                    className={cn("items-center border-t px-3 py-2", COST_TABLE_GRID)}
                  >
                    <div className="text-sm">{f.label}</div>
                    <div className="text-muted-foreground tabular-nums text-sm">
                      {cur ?? "—"}
                    </div>
                    <div className="tabular-nums text-sm">
                      {next === "" ? "—" : next}
                    </div>
                    <div className="flex items-center">
                      <CostDelta current={cur} next={newCost[f.key]} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="text-muted-foreground">
                币种：<span className="text-foreground">{currency}</span>
                <span className="mx-2">·</span>
                新价窗口：
                <span className="text-foreground tabular-nums">
                  {formatDateTime(pending.effectiveFrom)} ~{" "}
                  {pending.effectiveTo
                    ? formatDateTime(pending.effectiveTo)
                    : "长期"}
                </span>
              </div>

              <div className="overflow-hidden rounded-md border">
                <div className="bg-muted/40 text-muted-foreground px-3 py-1.5">
                  确认后将处理 {pending.overlapping.length} 条重叠的历史价：
                </div>
                <ul className="divide-border divide-y">
                  {pending.overlapping.map((o) => {
                    const willClose =
                      new Date(o.effective_from).getTime() < fromMs;
                    return (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-3 px-3 py-1.5"
                      >
                        <span className="text-muted-foreground tabular-nums">
                          {formatDateTime(o.effective_from)} ~{" "}
                          {o.effective_to
                            ? formatDateTime(o.effective_to)
                            : "长期"}
                        </span>
                        {willClose ? (
                          <Badge variant="secondary" className="shrink-0">
                            收口于 {formatDateTime(pending.effectiveFrom)}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="shrink-0">
                            停用
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            取消
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? "处理中…" : "确认继续"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CostRow({
  label,
  required,
  cost,
  currentCost,
  costError,
  onCost,
}: {
  label: string;
  required: boolean;
  cost: string;
  currentCost: string | null;
  costError?: string;
  onCost: (v: string) => void;
}) {
  return (
    <div className={cn("items-start border-t px-3 py-2", COST_TABLE_GRID)}>
      <div className="pt-2 text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </div>
      <div className="text-muted-foreground pt-2 tabular-nums text-sm">
        {currentCost ?? "—"}
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
      <div className="flex items-center pt-2">
        <CostDelta current={currentCost} next={cost} />
      </div>
    </div>
  );
}

function CostDelta({ current, next }: { current: string | null; next: string }) {
  const nextTrimmed = next.trim();
  if (current == null || nextTrimmed === "" || !MONEY_PATTERN.test(nextTrimmed)) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const cur = Number(current);
  const n = Number(nextTrimmed);
  if (!Number.isFinite(cur) || !Number.isFinite(n)) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const delta = n - cur;
  if (delta === 0) {
    return <span className="text-muted-foreground tabular-nums text-sm">0</span>;
  }

  const abs = roundPrice3(Math.abs(delta));
  if (delta > 0) {
    return (
      <span className="text-destructive inline-flex items-center gap-0.5 tabular-nums text-sm">
        +{abs}
        <ArrowUpIcon className="size-3.5 shrink-0" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums text-sm text-emerald-600 dark:text-emerald-400">
      -{abs}
      <ArrowDownIcon className="size-3.5 shrink-0" />
    </span>
  );
}

function readCurrentCost(
  price: ChannelPrice | null,
  key: CostFieldKey,
): string | null {
  if (!price) return null;
  const raw = price[COST_PRICE_FIELD[key]];
  if (raw == null || raw === "") return null;
  return trimDecimal(String(raw));
}

function ChannelPriceRow({
  price,
  prices,
  onChanged,
}: {
  price: ChannelPrice;
  prices: ChannelPrice[];
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
    onError: (err, vars) => {
      // 窗口重叠（启用/改结束时间时最常见）：透出后端英文 message 没意义，改成中文引导并点名冲突价。
      if (apiErrorCode(err) === "admin_pricing_window_overlap") {
        setPendingStatus(null);
        const conflicts = findOverlappingChannelPrices(
          prices,
          price.model_id,
          price.effective_from,
          vars.effective_to,
          price.id,
        );
        toast.error(overlapMessage(price, conflicts, vars.status));
        return;
      }
      toast.error(apiErrorMessage(err));
    },
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

// overlapMessage 把「窗口重叠」错误翻成中文引导：点名冲突价的生效区间，提示如何避开，而不自动改数据。
function overlapMessage(
  price: ChannelPrice,
  conflicts: ChannelPrice[],
  attemptedStatus: string,
): string {
  const action = attemptedStatus === "enabled" ? "启用" : "保存";
  const win = (p: ChannelPrice) =>
    `${formatDateTime(p.effective_from)} ~ ${
      p.effective_to ? formatDateTime(p.effective_to) : "长期"
    }`;
  if (conflicts.length === 0) {
    return `无法${action}：本条成本价的生效区间与「${price.model_external_id}」另一条启用中的价重叠。请调整两者的生效时间使其不重叠后再试。`;
  }
  const first = conflicts[0]!;
  const more = conflicts.length > 1 ? `等 ${conflicts.length} 条` : "";
  return `无法${action}：本条生效区间与「${price.model_external_id}」启用中的价（${win(first)}${more}）重叠。请调整本条或该冲突价的生效时间，使两者不重叠后再试。`;
}

function emptyAmounts(): Record<CostFieldKey, string> {
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
