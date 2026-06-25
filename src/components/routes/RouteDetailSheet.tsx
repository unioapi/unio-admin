import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { deleteRoute, getRoute, type Route } from "@/lib/api/routes";
import { apiErrorMessage } from "@/lib/api/client";
import {
  getRouteOpsBindings,
  getRouteOpsChannelPool,
  getRouteOpsDetail,
  getRouteOpsModels,
  getRouteOpsPerformance,
  getRouteOpsRequests,
  type RouteOpsRow,
} from "@/lib/api/routesOps";
import type { RangeQuery } from "@/lib/api/dashboard";
import { formatCompact, formatLatencyMs, formatPercent } from "@/lib/format";
import { col } from "@/lib/table-columns";
import { RouteFormDialog } from "@/components/routes/RouteFormDialog";
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

export function RouteDetailSheet({
  route,
  range,
  onClose,
  onChanged,
}: {
  route: RouteOpsRow | null;
  range: RangeQuery;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Sheet open={route != null} onOpenChange={(o) => !o && onClose()}>
      <DetailSheetContent size="lg">
        {route ? <Body row={route} range={range} onChanged={onChanged} onClose={onClose} /> : null}
      </DetailSheetContent>
    </Sheet>
  );
}

function Body({
  row,
  range,
  onChanged,
  onClose,
}: {
  row: RouteOpsRow;
  range: RangeQuery;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const routeQ = useQuery({ queryKey: ["route", row.id], queryFn: () => getRoute(row.id) });

  const del = useMutation({
    mutationFn: () => deleteRoute(row.id),
    onSuccess: () => {
      toast.success("已删除线路");
      onChanged();
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {row.name}
          {row.is_builtin ? <Badge variant="outline">内置</Badge> : null}
          <Badge variant={row.status === "enabled" ? "default" : "outline"}>
            {row.status === "enabled" ? "启用" : "停用"}
          </Badge>
          {row.serviceable ? <Badge variant="default">可服务</Badge> : <Badge variant="destructive">不可服务</Badge>}
        </SheetTitle>
        <SheetDescription>
          {row.mode} · {row.pool_kind === "all" ? "全量动态" : "手挑渠道"} · 绑定 项目 {row.bound_projects} / Key {row.bound_keys}
        </SheetDescription>
      </SheetHeader>

      <SheetToolbar>
        <Button size="sm" variant="outline" disabled={!routeQ.data || row.is_builtin} onClick={() => setEditOpen(true)}>编辑</Button>
        {!row.is_builtin ? (
          <Button size="sm" variant="outline" onClick={() => del.mutate()} disabled={del.isPending}>删除</Button>
        ) : null}
      </SheetToolbar>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 shrink-0 self-start flex-wrap">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="pool">渠道池</TabsTrigger>
          <TabsTrigger value="performance">路由表现</TabsTrigger>
          <TabsTrigger value="models">模型</TabsTrigger>
          <TabsTrigger value="bindings">绑定</TabsTrigger>
          <TabsTrigger value="requests">请求</TabsTrigger>
        </TabsList>
        <SheetMain className="pt-3">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="pool" className="mt-0">
            <PoolTab id={row.id} poolKind={row.pool_kind} />
          </TabsContent>
          <TabsContent value="performance" className="mt-0">
            <PerformanceTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="models" className="mt-0">
            <ModelsTab id={row.id} range={range} />
          </TabsContent>
          <TabsContent value="bindings" className="mt-0">
            <BindingsTab id={row.id} />
          </TabsContent>
          <TabsContent value="requests" className="mt-0">
            <RequestsTab id={row.id} range={range} />
          </TabsContent>
        </SheetMain>
      </Tabs>

      {routeQ.data ? (
        <RouteFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          route={routeQ.data as Route}
          onSaved={() => {
            setEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ["route", row.id] });
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}

function OverviewTab({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["route", id, "ops-detail", range],
    queryFn: () => getRouteOpsDetail(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-32 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  const d = q.data;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat label="请求" value={formatCompact(d.request_total)} />
      <Stat label="成功率" value={formatPercent(d.success_rate)} />
      <Stat label="Fallback 率" value={formatPercent(d.fallback_rate)} />
      <Stat label="无可用渠道" value={String(d.no_channel_total)} />
      <Stat label="P50 延迟" value={formatLatencyMs(d.latency_p50)} />
      <Stat label="P95 延迟" value={formatLatencyMs(d.latency_p95)} />
    </div>
  );
}

function PoolTab({ id, poolKind }: { id: number; poolKind: string }) {
  const q = useQuery({ queryKey: ["route", id, "ops-pool"], queryFn: () => getRouteOpsChannelPool(id) });
  if (poolKind === "all")
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        全量动态线路：自动使用每个模型的全部可用渠道，无固定渠道池。
      </p>
    );
  if (q.isPending) return <Skeleton className="h-32 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0)
    return <p className="text-muted-foreground py-10 text-center text-sm">渠道池为空</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={col.primary}>渠道</TableHead>
          <TableHead className={col.text}>服务商</TableHead>
          <TableHead className={col.status}>状态</TableHead>
          <TableHead className={col.numSm}>优先级</TableHead>
          <TableHead className={col.action}>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {q.data.map((c) => (
          <TableRow key={c.channel_id}>
            <TableCell className="text-sm font-medium">{c.channel_name}</TableCell>
            <TableCell className="text-xs">{c.provider_name}</TableCell>
            <TableCell>
              <Badge variant={c.channel_status === "enabled" ? "default" : "outline"}>
                {c.channel_status === "enabled" ? "启用" : "停用"}
              </Badge>
            </TableCell>
            <TableCell className="text-xs tabular-nums">{c.priority}</TableCell>
            <TableCell>
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
    queryKey: ["route", id, "ops-perf", range],
    queryFn: () => getRouteOpsPerformance(id, range),
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

function ModelsTab({ id, range }: { id: number; range: RangeQuery }) {
  const q = useQuery({
    queryKey: ["route", id, "ops-models", range],
    queryFn: () => getRouteOpsModels(id, range),
    placeholderData: keepPreviousData,
  });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  if (q.data.length === 0)
    return <p className="text-muted-foreground py-12 text-center text-sm">区间内暂无模型流量</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={col.primaryLg}>模型</TableHead>
          <TableHead className={col.num}>请求</TableHead>
          <TableHead className={col.percent}>成功率</TableHead>
          <TableHead className={col.action}>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {q.data.map((m) => (
          <TableRow key={m.model_id}>
            <TableCell className="text-sm font-medium">{m.model_id}</TableCell>
            <TableCell className="text-xs tabular-nums">{formatCompact(m.request_total)}</TableCell>
            <TableCell className="text-xs tabular-nums">{formatPercent(m.success_rate)}</TableCell>
            <TableCell>
              <Button asChild size="sm" variant="ghost">
                <Link to={`/models?q=${encodeURIComponent(m.model_id)}`}>打开</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BindingsTab({ id }: { id: number }) {
  const q = useQuery({ queryKey: ["route", id, "ops-bindings"], queryFn: () => getRouteOpsBindings(id) });
  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (q.isError) return <ErrorBox message={(q.error as Error).message} />;
  const { projects, keys } = q.data;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-muted-foreground mb-1 text-xs">默认线路指向本线路的项目（{projects.length}）</div>
        {projects.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">无</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <Button key={p.id} asChild size="sm" variant="outline">
                <Link to={`/projects?q=${encodeURIComponent(p.name)}`}>{p.name}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-xs">绑定本线路的 API Key（{keys.length}）</div>
        {keys.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">无</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={col.primary}>Key</TableHead>
                <TableHead className={col.status}>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="text-sm">{k.name}</TableCell>
                  <TableCell>
                    <Badge variant={k.status === "active" ? "default" : "outline"}>{k.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="text-muted-foreground text-xs">改线路前请确认上述绑定不受影响。</p>
    </div>
  );
}

function RequestsTab({ id, range }: { id: number; range: RangeQuery }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["route", id, "ops-requests", range, page],
    queryFn: () => getRouteOpsRequests(id, { ...range, page, page_size: 10 }),
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
            <TableHead className={col.textLg}>模型</TableHead>
            <TableHead className={col.badge}>状态</TableHead>
            <TableHead className={col.mono}>请求</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data.items.map((rq, i) => (
            <TableRow key={`${rq.request_id}-${i}`}>
              <TableCell className="text-xs">{fmtTs(rq.at)}</TableCell>
              <TableCell className="text-xs">{rq.model_id}</TableCell>
              <TableCell className="text-xs">{rq.status}</TableCell>
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
