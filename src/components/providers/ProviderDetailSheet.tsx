import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Provider } from "@/lib/api/providers";
import {
  getProviderOpsChannels,
  getProviderOpsDetail,
  getProviderOpsErrors,
  getProviderOpsPerformance,
  type ProviderOpsRow,
} from "@/lib/api/providersOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { formatCompact, formatInt, formatLatencyMs, formatPercent } from "@/lib/format";
import { HEALTH_LABEL, HEALTH_VARIANT } from "@/components/channels/health";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import { DeleteProviderDialog } from "@/components/providers/DeleteProviderDialog";
import { ProviderStatusToggle } from "@/components/providers/ProviderStatusToggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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

export function ProviderDetailSheet({
  provider,
  range,
  onClose,
}: {
  provider: ProviderOpsRow | null;
  range: RangeQuery;
  onClose: () => void;
}) {
  return (
    <Sheet open={provider != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        {provider ? <Body row={provider} range={range} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function Body({ row, range }: { row: ProviderOpsRow; range: RangeQuery }) {
  const [tab, setTab] = useState("overview");
  const provider: Provider = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    created_at: "",
    updated_at: "",
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {row.name}
          <Badge variant={row.status === "enabled" ? "default" : "outline"}>
            {row.status === "enabled" ? "启用" : "停用"}
          </Badge>
        </SheetTitle>
        <SheetDescription>
          {row.slug} · 渠道 {row.channel_enabled}/{row.channel_total}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap items-center gap-2 px-4">
        <ProviderFormDialog provider={provider}>
          <Button size="sm" variant="outline">编辑</Button>
        </ProviderFormDialog>
        <ProviderStatusToggle provider={provider} />
        <DeleteProviderDialog provider={provider}>
          <Button size="sm" variant="outline">删除</Button>
        </DeleteProviderDialog>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="channels">渠道</TabsTrigger>
          <TabsTrigger value="performance">性能</TabsTrigger>
          <TabsTrigger value="errors">错误</TabsTrigger>
        </TabsList>
        <div className="mt-3 overflow-y-auto">
          <TabsContent value="overview">
            <OverviewTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="channels">
            <ChannelsTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="errors">
            <ErrorsTab id={row.id} range={range} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}

function OverviewTab({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["provider", id, "ops-detail", range],
    queryFn: () => getProviderOpsDetail(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-32 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  const d = q.data;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="渠道" value={`${d.channel_enabled}/${d.channel_total}`} />
      <Stat label="尝试数" value={formatCompact(d.attempt_total)} />
      <Stat label="成功率" value={formatPercent(d.success_rate)} />
      <Stat label="超时" value={formatInt(d.timeout_total)} />
      <Stat label="P50 延迟" value={formatLatencyMs(d.latency_p50)} />
      <Stat label="P95 延迟" value={formatLatencyMs(d.latency_p95)} />
    </div>
  );
}

function ChannelsTab({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["provider", id, "ops-channels", range],
    queryFn: () => getProviderOpsChannels(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">该服务商下暂无渠道</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>渠道</TableHead>
          <TableHead>健康</TableHead>
          <TableHead className="text-right">尝试</TableHead>
          <TableHead className="text-right">成功率</TableHead>
          <TableHead className="text-right">P95</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {q.data.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="text-sm font-medium">{c.name}</TableCell>
            <TableCell>
              <Badge variant={HEALTH_VARIANT[c.health]}>{HEALTH_LABEL[c.health]}</Badge>
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums">{formatCompact(c.attempt_total)}</TableCell>
            <TableCell className="text-right text-xs tabular-nums">{formatPercent(c.success_rate)}</TableCell>
            <TableCell className="text-right text-xs tabular-nums">{formatLatencyMs(c.latency_p95)}</TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="ghost">
                <Link to={`/channels?channel_id=${c.id}`}>打开</Link>
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
    queryKey: ["provider", id, "ops-perf", range],
    queryFn: () => getProviderOpsPerformance(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-[240px] w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">区间内暂无数据</p>;
  const reqConfig: ChartConfig = {
    attempt_total: { label: "尝试", color: "var(--chart-1)" },
    attempt_succeeded: { label: "成功", color: "var(--chart-2)" },
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
          <Area dataKey="attempt_total" type="monotone" stroke="var(--color-attempt_total)" fill="var(--color-attempt_total)" fillOpacity={0.15} />
          <Area dataKey="attempt_succeeded" type="monotone" stroke="var(--color-attempt_succeeded)" fill="var(--color-attempt_succeeded)" fillOpacity={0.15} />
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

function ErrorsTab({ id, range }: { id: number; range: RangeQuery }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["provider", id, "ops-errors", range, page],
    queryFn: () => getProviderOpsErrors(id, { ...range, page, page_size: 10 }),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.items.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">区间内暂无错误</p>;
  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>渠道</TableHead>
            <TableHead>错误码</TableHead>
            <TableHead>请求</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data.items.map((e, i) => (
            <TableRow key={`${e.request_id}-${i}`}>
              <TableCell className="text-xs">{fmtTs(e.at)}</TableCell>
              <TableCell className="text-xs">{e.channel_name}</TableCell>
              <TableCell className="text-xs">{e.error_code || "—"}</TableCell>
              <TableCell>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/requests?q=${e.request_id}`}>{e.request_id.slice(0, 8)}…</Link>
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
