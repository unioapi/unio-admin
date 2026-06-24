import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { getChannel } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import {
  getChannelOpsDetail,
  getChannelOpsErrors,
  getChannelOpsModels,
  getChannelOpsPerformance,
  getChannelOpsRoutes,
} from "@/lib/api/channelsOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import {
  formatCompact,
  formatInt,
  formatLatencyMs,
  formatPercent,
  formatRelativeTime,
} from "@/lib/format";
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
import { ChannelModelsDialog } from "@/components/channels/ChannelModelsDialog";
import { ChannelPricesDialog } from "@/components/channels/ChannelPricesDialog";
import { RotateCredentialDialog } from "@/components/channels/RotateCredentialDialog";
import { ChannelFormDialog } from "@/components/channels/ChannelFormDialog";

function fmtTs(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ChannelDetailSheet({
  channelId,
  range,
  onClose,
}: {
  channelId: number | null;
  range: RangeQuery;
  onClose: () => void;
}) {
  const open = channelId != null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        {channelId != null ? (
          <ChannelDetailBody channelId={channelId} range={range} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ChannelDetailBody({
  channelId,
  range,
}: {
  channelId: number;
  range: RangeQuery;
}) {
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);

  const channelQ = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => getChannel(channelId),
  });
  const channel = channelQ.data;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {channel?.name ?? `渠道 #${channelId}`}
          {channel ? (
            <Badge variant={channel.status === "enabled" ? "default" : "outline"}>
              {channel.status === "enabled" ? "启用" : "停用"}
            </Badge>
          ) : null}
        </SheetTitle>
        <SheetDescription>
          {channel
            ? `${channel.provider_name} · ${channel.protocol} · ${channel.base_url}`
            : "加载中…"}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap gap-2 px-4">
        <Button size="sm" variant="outline" disabled={!channel} onClick={() => setEditOpen(true)}>
          编辑
        </Button>
        <Button size="sm" variant="outline" disabled={!channel} onClick={() => setModelsOpen(true)}>
          管理模型
        </Button>
        <Button size="sm" variant="outline" disabled={!channel} onClick={() => setPricesOpen(true)}>
          价格
        </Button>
        <Button size="sm" variant="outline" disabled={!channel} onClick={() => setCredOpen(true)}>
          轮换凭据
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="performance">性能</TabsTrigger>
          <TabsTrigger value="errors">错误</TabsTrigger>
          <TabsTrigger value="models">模型</TabsTrigger>
          <TabsTrigger value="routes">线路</TabsTrigger>
          <TabsTrigger value="credential">凭据</TabsTrigger>
          <TabsTrigger value="audit">审计</TabsTrigger>
        </TabsList>

        <div className="mt-3 overflow-y-auto">
          <TabsContent value="overview">
            <OverviewTab channelId={channelId} range={range} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceTab channelId={channelId} range={range} />
          </TabsContent>
          <TabsContent value="errors">
            <ErrorsTab channelId={channelId} range={range} />
          </TabsContent>
          <TabsContent value="models">
            <ModelsTab channelId={channelId} range={range} onManage={() => setModelsOpen(true)} />
          </TabsContent>
          <TabsContent value="routes">
            <RoutesTab channelId={channelId} />
          </TabsContent>
          <TabsContent value="credential">
            <div className="flex flex-col gap-3 py-2 text-sm">
              <p className="text-muted-foreground">
                凭据只写不回显。最近更新：{channel ? formatRelativeTime(channel.updated_at) : "—"}。
              </p>
              <div>
                <Button size="sm" disabled={!channel} onClick={() => setCredOpen(true)}>
                  轮换凭据
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="audit">
            <p className="text-muted-foreground py-6 text-center text-sm">审计日志（P1）</p>
          </TabsContent>
        </div>
      </Tabs>

      {channel ? (
        <>
          <ChannelFormDialog open={editOpen} onOpenChange={setEditOpen} channel={channel} />
          <ChannelModelsDialog open={modelsOpen} onOpenChange={setModelsOpen} channel={channel} />
          <ChannelPricesDialog open={pricesOpen} onOpenChange={setPricesOpen} channel={channel} />
          <RotateCredentialDialog open={credOpen} onOpenChange={setCredOpen} channel={channel} />
        </>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border p-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-heading mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function OverviewTab({ channelId, range }: { channelId: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-detail", range],
    queryFn: () => getChannelOpsDetail(channelId, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError)
    return <ErrorBox message={(q.error as Error).message} />;
  const d = q.data;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="尝试数" value={formatCompact(d.attempt_total)} />
      <Stat label="成功率" value={formatPercent(d.success_rate)} />
      <Stat label="超时" value={formatInt(d.timeout_total)} />
      <Stat label="P95 延迟" value={formatLatencyMs(d.latency_p95)} />
      <Stat label="平均延迟" value={formatLatencyMs(d.latency_avg)} />
      <Stat label="P99 延迟" value={formatLatencyMs(d.latency_p99)} />
      <Stat label="最近成功" value={d.last_success_at ? formatRelativeTime(d.last_success_at) : "—"} />
      <Stat label="最近失败" value={d.last_failure_at ? formatRelativeTime(d.last_failure_at) : "—"} />
    </div>
  );
}

function PerformanceTab({ channelId, range }: { channelId: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-perf", range],
    queryFn: () => getChannelOpsPerformance(channelId, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-[240px] w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  const points = q.data;
  if (points.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">区间内暂无数据</p>;

  const reqConfig: ChartConfig = {
    attempt_total: { label: "尝试", color: "var(--chart-1)" },
    attempt_succeeded: { label: "成功", color: "var(--chart-2)" },
  };
  const latConfig: ChartConfig = {
    latency_p95: { label: "P95 延迟(ms)", color: "var(--chart-3)" },
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-muted-foreground mb-1 text-xs">尝试量</div>
        <ChartContainer config={reqConfig} className="h-[180px] w-full">
          <AreaChart data={points} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtTs} />
            <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => fmtTs(String(p?.[0]?.payload.bucket))} />} />
            <Area dataKey="attempt_total" type="monotone" stroke="var(--color-attempt_total)" fill="var(--color-attempt_total)" fillOpacity={0.15} />
            <Area dataKey="attempt_succeeded" type="monotone" stroke="var(--color-attempt_succeeded)" fill="var(--color-attempt_succeeded)" fillOpacity={0.15} />
          </AreaChart>
        </ChartContainer>
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-xs">P95 延迟</div>
        <ChartContainer config={latConfig} className="h-[180px] w-full">
          <LineChart data={points} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={fmtTs} />
            <YAxis tickLine={false} axisLine={false} width={44} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => fmtTs(String(p?.[0]?.payload.bucket))} />} />
            <Line dataKey="latency_p95" type="monotone" stroke="var(--color-latency_p95)" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}

function ErrorsTab({ channelId, range }: { channelId: number; range: RangeQuery }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-errors", range, page],
    queryFn: () => getChannelOpsErrors(channelId, { ...range, page, page_size: 10 }),
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
            <TableHead>模型</TableHead>
            <TableHead>错误码</TableHead>
            <TableHead className="text-right">HTTP</TableHead>
            <TableHead>请求</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data.items.map((e, i) => (
            <TableRow key={`${e.request_id}-${i}`}>
              <TableCell className="text-xs">{fmtTs(e.at)}</TableCell>
              <TableCell className="text-xs">{e.upstream_model}</TableCell>
              <TableCell className="text-xs">{e.error_code || "—"}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">{e.upstream_status_code ?? "—"}</TableCell>
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
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page * 10 >= q.data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

function ModelsTab({
  channelId,
  range,
  onManage,
}: {
  channelId: number;
  range: RangeQuery;
  onManage: () => void;
}) {
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-models", range],
    queryFn: () => getChannelOpsModels(channelId, range),
    placeholderData: keepPreviousData,
    retry: false,
  });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onManage}>
          管理绑定
        </Button>
      </div>
      {q.isPending ? (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
        </div>
      ) : q.isError ? (
        <ErrorBox message={apiErrorMessage(q.error)} />
      ) : q.data.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">暂无绑定模型</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>模型</TableHead>
              <TableHead>上游名</TableHead>
              <TableHead className="text-right">尝试</TableHead>
              <TableHead className="text-right">成功率</TableHead>
              <TableHead className="text-right">P95</TableHead>
              <TableHead>价格</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((m) => (
              <TableRow key={m.model_id}>
                <TableCell className="text-xs font-medium">{m.model_ref}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{m.upstream_model}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatCompact(m.attempt_total)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatPercent(m.success_rate)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatLatencyMs(m.latency_p95)}</TableCell>
                <TableCell>
                  {m.has_price ? (
                    <Badge variant="default">已配置</Badge>
                  ) : (
                    <Badge variant="destructive">缺价</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function RoutesTab({ channelId }: { channelId: number }) {
  const q = useQuery({
    queryKey: ["channel", channelId, "ops-routes"],
    queryFn: () => getChannelOpsRoutes(channelId),
  });
  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0)
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        无显式线路池引用本渠道（全量动态线路按模型自动纳入）
      </p>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>线路</TableHead>
          <TableHead>策略</TableHead>
          <TableHead>池</TableHead>
          <TableHead>状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {q.data.map((rt) => (
          <TableRow key={rt.id}>
            <TableCell className="text-sm font-medium">
              {rt.name}
              {rt.is_builtin ? <Badge variant="outline" className="ml-1">内置</Badge> : null}
            </TableCell>
            <TableCell className="text-xs">{rt.mode}</TableCell>
            <TableCell className="text-xs">{rt.pool_kind}</TableCell>
            <TableCell>
              <Badge variant={rt.status === "enabled" ? "default" : "outline"}>
                {rt.status === "enabled" ? "启用" : "停用"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
