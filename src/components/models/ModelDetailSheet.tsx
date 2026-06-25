import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { getModel } from "@/lib/api/models";
import {
  getModelOpsChannels,
  getModelOpsDetail,
  getModelOpsPerformance,
  getModelOpsRequests,
  type ModelOpsRow,
} from "@/lib/api/modelsOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import {
  formatCompact,
  formatLatencyMs,
  formatPercent,
  formatTPS,
} from "@/lib/format";
import { col } from "@/lib/table-columns";
import { HEALTH_LABEL, HEALTH_VARIANT, healthBucketOf } from "@/components/channels/health";
import { ModelFormDialog } from "@/components/models/ModelFormDialog";
import { ModelStatusToggle } from "@/components/models/ModelStatusToggle";
import { ModelCapabilitiesDialog } from "@/components/models/ModelCapabilitiesDialog";
import { DeleteModelDialog } from "@/components/models/DeleteModelDialog";
import {
  Sheet,
  DetailSheetContent,
  SheetDescription,
  SheetHeader,
  SheetMain,
  SheetTitle,
  SheetToolbar,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

function fmtTs(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-heading mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>加载失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function ModelDetailSheet({
  model,
  range,
  onClose,
}: {
  model: ModelOpsRow | null;
  range: RangeQuery;
  onClose: () => void;
}) {
  return (
    <Sheet open={model != null} onOpenChange={(o) => !o && onClose()}>
      <DetailSheetContent size="lg">
        {model ? <Body row={model} range={range} /> : null}
      </DetailSheetContent>
    </Sheet>
  );
}

function Body({ row, range }: { row: ModelOpsRow; range: RangeQuery }) {
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const modelQ = useQuery({ queryKey: ["model", row.id], queryFn: () => getModel(row.id) });
  const model = modelQ.data;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {row.model_id}
          <Badge variant={row.status === "enabled" ? "default" : "outline"}>
            {row.status === "enabled" ? "启用" : "停用"}
          </Badge>
          {row.sellable ? (
            <Badge variant="default">可售</Badge>
          ) : (
            <Badge variant="destructive">不可售</Badge>
          )}
        </SheetTitle>
        <SheetDescription>
          {row.display_name} · {row.owned_by} · 可用渠道 {row.bindings_available}/{row.bindings_total}
        </SheetDescription>
      </SheetHeader>

      <SheetToolbar>
        <Button size="sm" variant="outline" disabled={!model} onClick={() => setEditOpen(true)}>编辑</Button>
        {model ? (
          <>
            <ModelStatusToggle model={model} />
            <ModelCapabilitiesDialog model={model}>
              <Button size="sm" variant="outline">能力</Button>
            </ModelCapabilitiesDialog>
            <DeleteModelDialog model={model}>
              <Button size="sm" variant="outline">删除</Button>
            </DeleteModelDialog>
          </>
        ) : null}
      </SheetToolbar>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 shrink-0 self-start flex-wrap">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="channels">渠道</TabsTrigger>
          <TabsTrigger value="performance">性能</TabsTrigger>
          <TabsTrigger value="requests">请求</TabsTrigger>
        </TabsList>
        <SheetMain className="pt-3">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab id={row.id} range={range} marginUsd={row.margin_usd} revenueUsd={row.revenue_usd} marginRate={row.margin_rate} />
          </TabsContent>
          <TabsContent value="channels" className="mt-0">
            <ChannelsTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="performance" className="mt-0">
            <PerformanceTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="requests" className="mt-0">
            <RequestsTab id={row.id} range={range} />
          </TabsContent>
        </SheetMain>
      </Tabs>

      {model ? <ModelFormDialog model={model} open={editOpen} onOpenChange={setEditOpen} /> : null}
    </>
  );
}

function OverviewTab({
  id,
  range,
  marginUsd,
  revenueUsd,
  marginRate,
}: {
  id: number;
  range: RangeQuery;
  marginUsd: string;
  revenueUsd: string;
  marginRate: number;
}) {
  const q = useQuery({
    queryKey: ["model", id, "ops-detail", range],
    queryFn: () => getModelOpsDetail(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  const d = q.data;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="请求" value={formatCompact(d.request_total)} />
      <Stat label="成功率" value={formatPercent(d.success_rate)} />
      <Stat label="P95 延迟" value={formatLatencyMs(d.latency_p95)} />
      <Stat label="TPS" value={formatTPS(d.tps)} />
      <Stat label="缓存命中率" value={formatPercent(d.cache_read_rate)} />
      <Stat label="输出 Token" value={formatCompact(d.output_tokens)} />
      <Stat label="收入 (USD)" value={`$${revenueUsd}`} />
      <Stat label="毛利 (USD)" value={`$${marginUsd}`} />
      <Stat label="毛利率" value={formatPercent(marginRate)} />
    </div>
  );
}

function ChannelsTab({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["model", id, "ops-channels", range],
    queryFn: () => getModelOpsChannels(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">该模型暂无承载渠道</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={col.primary}>渠道</TableHead>
          <TableHead className={col.badge}>健康</TableHead>
          <TableHead className={col.num}>尝试</TableHead>
          <TableHead className={col.percent}>成功率</TableHead>
          <TableHead className={col.latency}>P95</TableHead>
          <TableHead className={col.price}>价格</TableHead>
          <TableHead className={col.action}>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {q.data.map((c) => (
          <TableRow key={c.channel_id}>
            <TableCell className="text-sm font-medium">{c.channel_name}</TableCell>
            <TableCell>
              <Badge variant={HEALTH_VARIANT[healthBucketOf(c.attempt_succeeded, c.attempt_total)]}>
                {HEALTH_LABEL[healthBucketOf(c.attempt_succeeded, c.attempt_total)]}
              </Badge>
            </TableCell>
            <TableCell className="text-xs tabular-nums">{formatCompact(c.attempt_total)}</TableCell>
            <TableCell className="text-xs tabular-nums">{formatPercent(c.success_rate)}</TableCell>
            <TableCell className="text-xs tabular-nums">{formatLatencyMs(c.latency_p95)}</TableCell>
            <TableCell>
              {c.has_price ? <Badge variant="default">已配置</Badge> : <Badge variant="destructive">缺价</Badge>}
            </TableCell>
            <TableCell >
              <Button asChild size="sm" variant="ghost">
                <Link to={`/channels?channel_id=${c.channel_id}`}>打开</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PerformanceTab({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["model", id, "ops-perf", range],
    queryFn: () => getModelOpsPerformance(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-[240px] w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">区间内暂无数据</p>;
  const reqConfig: ChartConfig = {
    request_total: { label: "请求", color: "var(--chart-1)" },
    request_succeeded: { label: "成功", color: "var(--chart-2)" },
  };
  const latConfig: ChartConfig = { latency_p95: { label: "P95(ms)", color: "var(--chart-3)" } };
  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={reqConfig} className="h-[180px] w-full">
        <AreaChart data={q.data} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtTs} />
          <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => fmtTs(String(p?.[0]?.payload.bucket))} />} />
          <Area dataKey="request_total" type="monotone" stroke="var(--color-request_total)" fill="var(--color-request_total)" fillOpacity={0.15} />
          <Area dataKey="request_succeeded" type="monotone" stroke="var(--color-request_succeeded)" fill="var(--color-request_succeeded)" fillOpacity={0.15} />
        </AreaChart>
      </ChartContainer>
      <ChartContainer config={latConfig} className="h-[180px] w-full">
        <LineChart data={q.data} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtTs} />
          <YAxis tickLine={false} axisLine={false} width={44} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => fmtTs(String(p?.[0]?.payload.bucket))} />} />
          <Line dataKey="latency_p95" type="monotone" stroke="var(--color-latency_p95)" dot={false} strokeWidth={2} />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function RequestsTab({ id, range }: { id: number; range: RangeQuery }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["model", id, "ops-requests", range, page],
    queryFn: () => getModelOpsRequests(id, { ...range, page, page_size: 10 }),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.items.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">区间内暂无请求</p>;
  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={col.time}>时间</TableHead>
            <TableHead className={col.badge}>状态</TableHead>
            <TableHead className={col.latency}>延迟</TableHead>
            <TableHead className={col.mono}>请求</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data.items.map((rq, i) => (
            <TableRow key={`${rq.request_id}-${i}`}>
              <TableCell className="text-xs">{fmtTs(rq.at)}</TableCell>
              <TableCell className="text-xs">{rq.status}</TableCell>
              <TableCell className="text-xs tabular-nums">
                {rq.latency_ms != null ? formatLatencyMs(rq.latency_ms) : "—"}
              </TableCell>
              <TableCell>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/requests?q=${rq.request_id}`}>{rq.request_id.slice(0, 8)}…</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
        <Button size="sm" variant="outline" disabled={page * 10 >= q.data.total} onClick={() => setPage((p) => p + 1)}>下一页</Button>
      </div>
    </div>
  );
}
