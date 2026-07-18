import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { listChannelModels } from "@/lib/api/channelModels";
import { listChannelPrices } from "@/lib/api/channelPrices";
import { listChannelCostMultipliers } from "@/lib/api/channelCostMultipliers";
import {
  listChannelRechargeFactors,
  pickCurrentChannelRechargeFactor,
} from "@/lib/api/channelRechargeFactors";
import { getModelsOpsTable } from "@/lib/api/modelsOps";
import {
  costBaseFromOpsBase,
  resolveChannelIOCost,
} from "@/lib/billing/resolveChannelCost";
import { cn } from "@/lib/utils";
import {
  applyRouteRatio,
  formatRouteDelta,
  formatRoutePrice,
  marginTone,
  parseRouteRatio,
} from "@/components/routes/route-pricing";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ChannelOption = {
  id: number;
  name: string;
  provider_name: string;
  protocol: string;
};

type MarginRow = {
  key: string;
  channelId: number;
  channelName: string;
  modelId: string;
  inputCost: number | null;
  outputCost: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  inputDelta: number | null;
  outputDelta: number | null;
};

type ChannelCostBundle = {
  /** 该渠道已启用绑定的模型内部 id；未加载完成时为 null。 */
  boundModelIds: Set<number> | null;
  prices: Awaited<ReturnType<typeof listChannelPrices>>;
  multipliers: Awaited<ReturnType<typeof listChannelCostMultipliers>>;
  rechargeFactor: string | null;
};

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

function buildMarginRows(
  channels: ChannelOption[],
  channelIds: number[],
  models: Awaited<ReturnType<typeof getModelsOpsTable>>["items"],
  bundles: ChannelCostBundle[],
  ratio: number | null,
): MarginRow[] {
  const channelMap = Object.fromEntries(channels.map((c) => [c.id, c.name]));
  const modelById = new Map(models.map((m) => [m.id, m]));
  const rows: MarginRow[] = [];

  channelIds.forEach((channelId, idx) => {
    const bundle = bundles[idx];
    if (!bundle?.boundModelIds) return;
    const channelName = channelMap[channelId] ?? `渠道 #${channelId}`;

    for (const modelId of bundle.boundModelIds) {
      const model = modelById.get(modelId);
      if (!model) continue;

      const cost = resolveChannelIOCost({
        modelId: model.id,
        absolutePrices: bundle.prices,
        multipliers: bundle.multipliers,
        rechargeFactor: bundle.rechargeFactor,
        costBase: costBaseFromOpsBase({
          uncached_input_price: model.base_uncached_input_price,
          output_price: model.base_output_price,
          cache_read_input_price: model.base_cache_read_input_price,
          reasoning_output_price: model.base_reasoning_output_price,
          cache_write_5m_input_price: model.base_cache_write_5m_input_price,
          cache_write_1h_input_price: model.base_cache_write_1h_input_price,
          cache_write_30m_input_price: model.base_cache_write_30m_input_price,
        }),
      });
      if (!cost) continue;

      const inputCost = Number(cost.input);
      const outputCost = Number(cost.output);
      if (!Number.isFinite(inputCost) || !Number.isFinite(outputCost)) continue;

      const inputPrice =
        ratio != null ? applyRouteRatio(model.base_uncached_input_price, ratio) : null;
      const outputPrice = ratio != null ? applyRouteRatio(model.base_output_price, ratio) : null;
      const inputDelta = inputPrice != null ? inputPrice - inputCost : null;
      const outputDelta = outputPrice != null ? outputPrice - outputCost : null;

      rows.push({
        key: `${channelId}-${model.id}`,
        channelId,
        channelName,
        modelId: model.model_id,
        inputCost,
        outputCost,
        inputPrice,
        outputPrice,
        inputDelta,
        outputDelta,
      });
    }
  });

  return rows.sort((a, b) => {
    const byChannel = a.channelName.localeCompare(b.channelName);
    if (byChannel !== 0) return byChannel;
    return a.modelId.localeCompare(b.modelId);
  });
}

export function RouteChannelMarginTable({
  channels,
  channelIds,
  onToggleChannel,
  priceRatio,
  fixedSingle,
  readOnly = false,
  tableMaxHeight = "max-h-56",
}: {
  channels: ChannelOption[];
  channelIds: number[];
  onToggleChannel?: (id: number) => void;
  priceRatio: string;
  fixedSingle?: boolean;
  /** 详情页只读：隐藏渠道勾选，固定展示 channelIds。 */
  readOnly?: boolean;
  tableMaxHeight?: string;
}) {
  const ratio = parseRouteRatio(priceRatio);

  const modelsQ = useQuery({
    queryKey: ["models", "ops-table", "route-channel-margin"],
    queryFn: () =>
      getModelsOpsTable({ range: "all", page: 1, page_size: 200, sort: "name" }),
    enabled: channelIds.length > 0,
  });

  const channelCostQueries = useQueries({
    queries: channelIds.map((channelId) => ({
      queryKey: ["channel-cost-bundle", channelId, "route-margin-table"],
      queryFn: async (): Promise<ChannelCostBundle> => {
        const [boundModels, prices, multipliers, factors] = await Promise.all([
          listChannelModels(channelId),
          listChannelPrices(channelId),
          listChannelCostMultipliers(channelId),
          listChannelRechargeFactors(channelId),
        ]);
        return {
          boundModelIds: new Set(
            boundModels
              .filter((m) => m.status === "enabled")
              .map((m) => m.model_id),
          ),
          prices,
          multipliers,
          rechargeFactor: pickCurrentChannelRechargeFactor(factors)?.factor ?? null,
        };
      },
      enabled: channelIds.length > 0,
    })),
  });

  const bundles = channelCostQueries.map((q) => q.data);
  const models = useMemo(() => modelsQ.data?.items ?? [], [modelsQ.data]);

  const rows = useMemo(
    () =>
      buildMarginRows(
        channels,
        channelIds,
        models,
        bundles.map(
          (b) =>
            b ?? {
              boundModelIds: null,
              prices: [],
              multipliers: [],
              rechargeFactor: null,
            },
        ),
        ratio,
      ),
    [channels, channelIds, models, bundles, ratio],
  );

  const loading =
    channelIds.length > 0 &&
    (modelsQ.isPending || channelCostQueries.some((q) => q.isPending));

  return (
    <div className="overflow-hidden rounded-md border">
      {!readOnly ? (
        <div className="bg-muted/20 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto border-b p-2">
          {channels.length === 0 ? (
            <p className="text-muted-foreground p-1 text-xs">暂无渠道</p>
          ) : (
            channels.map((c) => {
              const checked = channelIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    "hover:bg-muted/60 flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                    checked && "border-primary/40 bg-primary/5",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={checked}
                    onChange={() => onToggleChannel?.(c.id)}
                  />
                  <span className="max-w-[140px] truncate font-medium">{c.name}</span>
                </label>
              );
            })
          )}
        </div>
      ) : null}

      <div className={cn("overflow-auto", tableMaxHeight)}>
        {loading ? (
          <Skeleton className="m-2 h-32 w-[calc(100%-1rem)] rounded-md" />
        ) : channelIds.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-xs">
            {fixedSingle ? "请选择一条渠道" : "请至少选择一条渠道，下方将展示成本与售价对比"}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-xs">
            所选渠道暂无已绑定且已配置成本的模型（需渠道模型绑定 + 基准价与成本倍率，或绝对成本覆盖）
          </p>
        ) : (
          <Table containerClassName="overflow-visible">
            <TableHeader>
              <TableRow className="bg-background sticky top-0 z-[1]">
                <TableHead className="text-xs">渠道</TableHead>
                <TableHead className="text-xs">模型</TableHead>
                <TableHead className="text-right text-xs">输入成本</TableHead>
                <TableHead className="text-right text-xs">输出成本</TableHead>
                <TableHead className="text-right text-xs">输入价格</TableHead>
                <TableHead className="text-right text-xs">输出价格</TableHead>
                <TableHead className="text-right text-xs">差异</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const inTone = marginTone(row.inputDelta);
                const outTone = marginTone(row.outputDelta);
                return (
                  <TableRow key={row.key}>
                    <TableCell className="max-w-[100px] truncate text-xs font-medium">
                      {row.channelName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.modelId}</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums text-xs">
                      {formatRoutePrice(row.inputCost)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums text-xs">
                      {formatRoutePrice(row.outputCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatRoutePrice(row.inputPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatRoutePrice(row.outputPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      <span className={deltaClass(inTone)}>{formatRouteDelta(row.inputDelta)}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className={deltaClass(outTone)}>{formatRouteDelta(row.outputDelta)}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      {rows.length > 0 ? (
        <p className="text-muted-foreground border-t px-2 py-1.5 text-[10px]">
          价格 = 模型基准 × 倍率 · 差异 = 价格 − 成本 · USD / 1M tokens · 共 {rows.length} 行
        </p>
      ) : null}
    </div>
  );
}
