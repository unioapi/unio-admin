import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { listChannelPrices, pickCurrentChannelPrice } from "@/lib/api/channelPrices";
import { getModelsOpsTable } from "@/lib/api/modelsOps";
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
  priceLists: Awaited<ReturnType<typeof listChannelPrices>>[],
  ratio: number | null,
): MarginRow[] {
  const channelMap = Object.fromEntries(channels.map((c) => [c.id, c.name]));
  const rows: MarginRow[] = [];

  channelIds.forEach((channelId, idx) => {
    const prices = priceLists[idx] ?? [];
    const channelName = channelMap[channelId] ?? `渠道 #${channelId}`;

    for (const model of models) {
      const cost = pickCurrentChannelPrice(prices, model.id);
      if (!cost) continue;

      const inputCost = Number(cost.uncached_input_cost);
      const outputCost = Number(cost.output_cost);
      if (!Number.isFinite(inputCost) || !Number.isFinite(outputCost)) continue;

      const inputPrice =
        ratio != null ? applyRouteRatio(model.base_uncached_input_price, ratio) : null;
      const outputPrice = ratio != null ? applyRouteRatio(model.base_output_price, ratio) : null;
      const inputDelta =
        inputPrice != null ? inputPrice - inputCost : null;
      const outputDelta =
        outputPrice != null ? outputPrice - outputCost : null;

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
}: {
  channels: ChannelOption[];
  channelIds: number[];
  onToggleChannel: (id: number) => void;
  priceRatio: string;
  fixedSingle?: boolean;
}) {
  const ratio = parseRouteRatio(priceRatio);

  const modelsQ = useQuery({
    queryKey: ["models", "ops-table", "route-channel-margin"],
    queryFn: () =>
      getModelsOpsTable({ range: "all", page: 1, page_size: 200, sort: "name" }),
    enabled: channelIds.length > 0,
  });

  const channelPricesQueries = useQueries({
    queries: channelIds.map((channelId) => ({
      queryKey: ["channel-prices", channelId, "route-margin-table"],
      queryFn: () => listChannelPrices(channelId),
      enabled: channelIds.length > 0,
    })),
  });

  const priceLists = channelPricesQueries.map((q) => q.data ?? []);
  const models = modelsQ.data?.items ?? [];

  const rows = useMemo(
    () => buildMarginRows(channels, channelIds, models, priceLists, ratio),
    [channels, channelIds, models, priceLists, ratio],
  );

  const loading =
    channelIds.length > 0 &&
    (modelsQ.isPending || channelPricesQueries.some((q) => q.isPending));

  return (
    <div className="overflow-hidden rounded-md border">
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
                  onChange={() => onToggleChannel(c.id)}
                />
                <span className="max-w-[140px] truncate font-medium">{c.name}</span>
              </label>
            );
          })
        )}
      </div>

      <div className="max-h-56 overflow-auto">
        {loading ? (
          <Skeleton className="m-2 h-32 w-[calc(100%-1rem)] rounded-md" />
        ) : channelIds.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-xs">
            {fixedSingle ? "请选择一条渠道" : "请至少选择一条渠道，下方将展示成本与售价对比"}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-xs">
            所选渠道暂无已配置成本的模型
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
