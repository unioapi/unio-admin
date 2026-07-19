import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, CalculatorIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { listChannelPrices } from "@/lib/api/channelPrices";
import { listChannelCostMultipliers } from "@/lib/api/channelCostMultipliers";
import {
  listChannelRechargeFactors,
  pickCurrentChannelRechargeFactor,
} from "@/lib/api/channelRechargeFactors";
import { getModelsOpsTable, type ModelOpsRow } from "@/lib/api/modelsOps";
import {
  costBaseFromOpsBase,
  resolveChannelIOCost,
} from "@/lib/billing/resolveChannelCost";
import { cn } from "@/lib/utils";
import { roundPrice3, trimDecimal } from "@/lib/format";
import {
  applyRouteRatio,
  formatRouteRatioInput,
  formatRouteDelta,
  formatRoutePrice,
  marginTone,
  parseRouteRatio,
} from "@/components/routes/route-pricing";
import { HintLabel } from "@/components/common/field-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DetailSheetContent,
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetMain,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

function isSelectLayerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-slot="select-content"], [data-slot="select-trigger"]'));
}

function parseRatio(raw: string): number | null {
  return parseRouteRatio(raw);
}

function applyRatio(base: string | null | undefined, ratio: number): number | null {
  return applyRouteRatio(base, ratio);
}

function fmtDelta(sell: number | null, cost: number | null): { text: string; tone: ReturnType<typeof marginTone> } {
  if (sell == null || cost == null) return { text: "—", tone: "na" };
  const d = sell - cost;
  if (Math.abs(d) < 0.0005) return { text: "0", tone: "flat" };
  return { text: formatRouteDelta(d), tone: marginTone(d) };
}

function validateRatio(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return null;
  if (!/^\d+(\.\d+)?$/.test(s) || Number(s) < 0) {
    return "需为 ≥ 0 的倍率（如 1、1.5、0.8）";
  }
  return null;
}

function deltaClass(tone: ReturnType<typeof marginTone>): string {
  switch (tone) {
    case "up":
      return "text-emerald-600 dark:text-emerald-400";
    case "down":
      return "text-destructive";
    case "flat":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function RouteRatioBadge({ ratioRaw }: { ratioRaw: string }) {
  const ratio = parseRatio(ratioRaw);
  if (ratio == null) return null;
  if (ratio === 1) return <Badge variant="secondary">原价</Badge>;
  if (ratio > 1) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
        加价 {trimDecimal(roundPrice3((ratio - 1) * 100))}%
      </Badge>
    );
  }
  return <Badge variant="destructive">折扣 {trimDecimal(roundPrice3(ratio * 100))}%</Badge>;
}

function RatioBadge({ ratio }: { ratio: number | null }) {
  if (ratio == null) return null;
  if (ratio === 1) return <Badge variant="secondary">原价</Badge>;
  if (ratio > 1) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
        加价 {trimDecimal(roundPrice3((ratio - 1) * 100))}%
      </Badge>
    );
  }
  return <Badge variant="destructive">折扣 {trimDecimal(roundPrice3(ratio * 100))}%</Badge>;
}

type ChannelCost = {
  channelId: number;
  channelName: string;
  input: number;
  output: number;
};

type ChannelCostBundle = {
  prices: Awaited<ReturnType<typeof listChannelPrices>>;
  multipliers: Awaited<ReturnType<typeof listChannelCostMultipliers>>;
  rechargeFactor: string | null;
};

function listChannelCosts(
  model: ModelOpsRow,
  channelIds: number[],
  channelNames: Record<number, string> | undefined,
  bundles: ChannelCostBundle[],
): ChannelCost[] {
  const costBase = costBaseFromOpsBase({
    uncached_input_price: model.base_uncached_input_price,
    output_price: model.base_output_price,
    cache_read_input_price: model.base_cache_read_input_price,
    reasoning_output_price: model.base_reasoning_output_price,
    cache_write_5m_input_price: model.base_cache_write_5m_input_price,
    cache_write_1h_input_price: model.base_cache_write_1h_input_price,
    cache_write_30m_input_price: model.base_cache_write_30m_input_price,
  });
  const rows: ChannelCost[] = [];
  channelIds.forEach((channelId, idx) => {
    const bundle = bundles[idx];
    if (!bundle) return;
    const cost = resolveChannelIOCost({
      modelId: model.id,
      absolutePrices: bundle.prices,
      multipliers: bundle.multipliers,
      rechargeFactor: bundle.rechargeFactor,
      costBase,
    });
    if (!cost) return;
    const input = Number(cost.input);
    const output = Number(cost.output);
    if (!Number.isFinite(input) || !Number.isFinite(output)) return;
    rows.push({
      channelId,
      channelName: channelNames?.[channelId] ?? `渠道 #${channelId}`,
      input,
      output,
    });
  });
  return rows.sort((a, b) => a.channelName.localeCompare(b.channelName));
}

function SellPriceBar({
  baseIn,
  baseOut,
  sellIn,
  sellOut,
  ratio,
}: {
  baseIn: number | null;
  baseOut: number | null;
  sellIn: number | null;
  sellOut: number | null;
  ratio: number | null;
}) {
  return (
    <div className="flex min-w-0 items-stretch gap-1.5 rounded-lg border bg-muted/20 p-2">
      <div className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 py-2">
        <div className="text-muted-foreground text-[10px] font-medium">模型基准</div>
        <div className="mt-1 tabular-nums text-xs font-semibold">
          {baseIn != null && baseOut != null
            ? `${formatRoutePrice(baseIn)} / ${formatRoutePrice(baseOut)}`
            : "缺价"}
        </div>
      </div>
      <div className="text-muted-foreground flex shrink-0 flex-col items-center justify-center gap-0.5 px-0.5">
        <span className="font-mono text-[10px]">×{ratio != null ? trimDecimal(String(ratio)) : "?"}</span>
        <ArrowRightIcon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="text-[10px] font-medium text-emerald-800/70 dark:text-emerald-400/80">线路售价</div>
        <div className="mt-1 tabular-nums text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          {sellIn != null && sellOut != null
            ? `${formatRoutePrice(sellIn)} / ${formatRoutePrice(sellOut)}`
            : "缺价"}
        </div>
      </div>
    </div>
  );
}

function ChannelMarginRow({
  channel,
  sellIn,
  sellOut,
}: {
  channel: ChannelCost;
  sellIn: number | null;
  sellOut: number | null;
}) {
  const dIn = fmtDelta(sellIn, channel.input);
  const dOut = fmtDelta(sellOut, channel.output);

  return (
    <li className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{channel.channelName}</div>
          <div className="text-muted-foreground mt-0.5 tabular-nums text-[11px]">
            成本 In {formatRoutePrice(channel.input)} / Out {formatRoutePrice(channel.output)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-muted-foreground text-[10px]">输入毛利</div>
          <div className={cn("text-sm font-semibold tabular-nums", deltaClass(dIn.tone))}>
            {dIn.text}
          </div>
          <div className="text-muted-foreground mt-1 text-[10px]">输出毛利</div>
          <div className={cn("text-sm font-semibold tabular-nums", deltaClass(dOut.tone))}>
            {dOut.text}
          </div>
        </div>
      </div>
    </li>
  );
}

function RoutePriceCalculatorPanel({
  priceRatio,
  channelIds,
  channelNames,
}: {
  priceRatio: string;
  channelIds: number[];
  channelNames?: Record<number, string>;
}) {
  const ratio = parseRatio(priceRatio);
  const [previewModelId, setPreviewModelId] = useState<string>("");
  const [showAll, setShowAll] = useState(false);

  const modelsQ = useQuery({
    queryKey: ["models", "ops-table", "route-price-preview"],
    queryFn: () =>
      getModelsOpsTable({ range: "all", page: 1, page_size: 200, sort: "name" }),
  });

  const channelCostQueries = useQueries({
    queries: channelIds.map((channelId) => ({
      queryKey: ["channel-cost-bundle", channelId, "route-preview"],
      queryFn: async (): Promise<ChannelCostBundle> => {
        const [prices, multipliers, factors] = await Promise.all([
          listChannelPrices(channelId),
          listChannelCostMultipliers(channelId),
          listChannelRechargeFactors(channelId),
        ]);
        return {
          prices,
          multipliers,
          rechargeFactor: pickCurrentChannelRechargeFactor(factors)?.factor ?? null,
        };
      },
      enabled: channelIds.length > 0,
    })),
  });

  const models = useMemo(() => {
    const items = modelsQ.data?.items ?? [];
    return [...items].sort((a, b) => a.model_id.localeCompare(b.model_id));
  }, [modelsQ.data]);

  const bundles = useMemo(
    () =>
      channelCostQueries.map(
        (q) =>
          q.data ?? {
            prices: [],
            multipliers: [],
            rechargeFactor: null,
          },
      ),
    [channelCostQueries],
  );

  const previewModel = useMemo(
    () => models.find((m) => String(m.id) === previewModelId) ?? models[0] ?? null,
    [models, previewModelId],
  );

  useEffect(() => {
    if (models.length === 0) return;
    if (previewModelId && models.some((m) => String(m.id) === previewModelId)) return;
    const withBase = models.find(
      (m) => m.base_uncached_input_price != null && m.base_output_price != null,
    );
    setPreviewModelId(String((withBase ?? models[0]).id));
  }, [models, previewModelId]);

  const channelCosts = useMemo(() => {
    if (!previewModel || channelIds.length === 0) return [];
    return listChannelCosts(previewModel, channelIds, channelNames, bundles);
  }, [previewModel, channelIds, channelNames, bundles]);

  const baseIn =
    previewModel?.base_uncached_input_price != null
      ? Number(previewModel.base_uncached_input_price)
      : null;
  const baseOut =
    previewModel?.base_output_price != null ? Number(previewModel.base_output_price) : null;
  const sellIn = ratio != null && baseIn != null ? applyRatio(String(baseIn), ratio) : null;
  const sellOut = ratio != null && baseOut != null ? applyRatio(String(baseOut), ratio) : null;

  const allRows = useMemo(() => {
    return models.map((m) => {
      const costs = listChannelCosts(m, channelIds, channelNames, bundles);
      const sIn = ratio != null ? applyRatio(m.base_uncached_input_price, ratio) : null;
      const sOut = ratio != null ? applyRatio(m.base_output_price, ratio) : null;
      return { model: m, costs, sellIn: sIn, sellOut: sOut };
    });
  }, [models, channelIds, channelNames, bundles, ratio]);

  const channelsLoading = channelIds.length > 0 && channelCostQueries.some((q) => q.isPending);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">预览模型</span>
        {models.length > 0 ? (
          <Select value={previewModelId} onValueChange={setPreviewModelId}>
            <SelectTrigger className="h-8 w-full font-mono text-xs">
              <SelectValue placeholder="选模型" />
            </SelectTrigger>
            <SelectContent className="z-[70]" position="popper">
              {models.map((m) => (
                <SelectItem key={m.id} value={String(m.id)} className="font-mono text-xs">
                  {m.model_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {modelsQ.isPending || channelsLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !previewModel ? (
        <p className="text-muted-foreground text-xs">暂无模型数据</p>
      ) : (
        <>
          <SellPriceBar
            baseIn={baseIn}
            baseOut={baseOut}
            sellIn={sellIn}
            sellOut={sellOut}
            ratio={ratio}
          />

          {channelIds.length === 0 ? (
            <p className="text-muted-foreground rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed">
              请在线路表单中勾选渠道，此处会列出每个渠道的成本与毛利。
            </p>
          ) : channelCosts.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              所选渠道尚未配置该模型的成本（需基准价 + 成本倍率，或绝对成本覆盖）。
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground text-xs font-medium">
                各渠道毛利（{channelCosts.length} 个）
              </div>
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-0.5">
                {channelCosts.map((ch) => (
                  <ChannelMarginRow
                    key={ch.channelId}
                    channel={ch}
                    sellIn={sellIn}
                    sellOut={sellOut}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {models.length > 0 ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-xs"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? <ChevronUpIcon data-icon="inline-start" /> : <ChevronDownIcon data-icon="inline-start" />}
            {showAll ? "收起全部模型" : `查看全部 ${models.length} 个模型`}
          </Button>
          {showAll ? (
            <div className="mt-2 overflow-hidden rounded-lg border">
              <ul className="max-h-56 divide-y overflow-y-auto">
                {allRows.map(({ model: m, costs, sellIn: sIn, sellOut: sOut }) => (
                  <li key={m.id} className="px-3 py-2">
                    <div className="font-mono text-[11px] font-medium">{m.model_id}</div>
                    <div className="text-muted-foreground mt-0.5 text-[10px]">
                      基准{" "}
                      {m.base_uncached_input_price != null
                        ? `${formatRoutePrice(Number(m.base_uncached_input_price))}/${m.base_output_price != null ? formatRoutePrice(Number(m.base_output_price)) : "—"}`
                        : "—"}
                      {" · "}
                      售价{" "}
                      {sIn != null && sOut != null
                        ? `${formatRoutePrice(sIn)}/${formatRoutePrice(sOut)}`
                        : "—"}
                    </div>
                    {costs.length > 0 ? (
                      <ul className="mt-1.5 space-y-1">
                        {costs.map((ch) => {
                          const dIn = fmtDelta(sIn, ch.input);
                          return (
                            <li
                              key={ch.channelId}
                              className="flex justify-between gap-2 text-[10px] tabular-nums"
                            >
                              <span className="text-muted-foreground truncate">{ch.channelName}</span>
                              <span>
                                <span className="text-amber-700/90 dark:text-amber-400">
                                  {formatRoutePrice(ch.input)}/{formatRoutePrice(ch.output)}
                                </span>
                                <span className={cn("ml-1.5", deltaClass(dIn.tone))}>
                                  ({dIn.text})
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function RoutePriceCalculator({
  priceRatio,
  onChange,
  channelIds,
  channelNames,
}: {
  priceRatio: string;
  onChange: (priceRatio: string) => void;
  channelIds: number[];
  channelNames?: Record<number, string>;
}) {
  const [open, setOpen] = useState(false);
  const [ratioError, setRatioError] = useState<string | null>(null);

  const parsedRatio = parseRatio(priceRatio);

  function handleRatioChange(next: string) {
    onChange(next);
    setRatioError(null);
  }

  function closeDrawer() {
    setRatioError(null);
    setOpen(false);
  }

  function confirmDrawer() {
    const err = validateRatio(priceRatio);
    if (err) {
      setRatioError(err);
      return;
    }
    onChange(formatRouteRatioInput(priceRatio));
    closeDrawer();
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Input
          id="rt_ratio"
          className="min-w-0 flex-1"
          value={priceRatio}
          onChange={(e) => handleRatioChange(e.target.value)}
          placeholder="1.0"
          inputMode="decimal"
          aria-invalid={!!ratioError}
        />
        <RouteRatioBadge ratioRaw={priceRatio} />
      </div>
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        <CalculatorIcon data-icon="inline-start" />
        倍率试算
      </Button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDrawer())}>
        <DetailSheetContent
          side="right"
          size="md"
          className="z-[60] sm:max-w-md"
          overlayClassName="z-[60]"
          closeOnOutsideClick
          onPointerDownOutside={(e) => {
            if (isSelectLayerTarget(e.target)) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isSelectLayerTarget(e.target)) e.preventDefault();
          }}
        >
          <SheetHeader>
            <SheetTitle>倍率试算</SheetTitle>
            <SheetDescription>
              客户售价 = 模型基准价 × 倍率 · 对比各渠道上游成本与毛利 · USD / 1M tokens
            </SheetDescription>
          </SheetHeader>

          <SheetMain className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-1.5">
              <HintLabel
                htmlFor="route_calc_ratio"
                hint="1=原价，1.5=加价 50%，0.8=8 折。与表单同步，可直接在此修改。"
              >
                售价倍率
              </HintLabel>
              <Input
                id="route_calc_ratio"
                value={priceRatio}
                onChange={(e) => handleRatioChange(e.target.value)}
                placeholder="1.0"
                inputMode="decimal"
                aria-invalid={!!ratioError}
                className="h-9"
              />
              {ratioError ? (
                <p className="text-destructive text-xs">{ratioError}</p>
              ) : (
                <RatioBadge ratio={parsedRatio} />
              )}
            </div>

            <RoutePriceCalculatorPanel
              priceRatio={priceRatio}
              channelIds={channelIds}
              channelNames={channelNames}
            />
          </SheetMain>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button type="button" variant="outline" onClick={closeDrawer}>
              取消
            </Button>
            <Button type="button" disabled={parsedRatio == null} onClick={confirmDrawer}>
              完成
            </Button>
          </SheetFooter>
        </DetailSheetContent>
      </Sheet>
    </>
  );
}
