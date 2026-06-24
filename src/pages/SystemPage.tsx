import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  EyeIcon,
  HeartPulseIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  listChannelHealth,
  listRecoveryJobs,
  type ChannelHealth,
  type ChannelHealthBucket,
} from "@/lib/api/system";
import { listSyncJobs, type SyncJob } from "@/lib/api/capability";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime, trimDecimal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/common/TablePagination";
import { RecoveryStatusBadge } from "@/components/system/RecoveryStatusBadge";
import { RecoveryJobDetailDialog } from "@/components/system/RecoveryJobDetailDialog";

export function SystemPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // ?tab= 深链同步；概览「结算补偿」行动项用 tab=jobs → 映射到补偿任务页。
  const raw = searchParams.get("tab");
  const tab = raw === "sync" ? "sync" : raw === "health" ? "health" : "recovery";
  const setTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set("tab", v);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>系统设置</CardTitle>
        <CardDescription>
          结算补偿任务、models.dev 同步任务与渠道健康（横切运营视图，只读）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="recovery">结算补偿任务</TabsTrigger>
            <TabsTrigger value="sync">同步任务</TabsTrigger>
            <TabsTrigger value="health">渠道健康</TabsTrigger>
          </TabsList>

          <TabsContent value="recovery" className="pt-4">
            <RecoveryTab />
          </TabsContent>
          <TabsContent value="sync" className="pt-4">
            <SyncJobsTab />
          </TabsContent>
          <TabsContent value="health" className="pt-4">
            <ChannelHealthTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

const RECOVERY_COLS = 7;
const PAGE_SIZE = 20;

const RECOVERY_STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待执行" },
  { value: "running", label: "运行中" },
  { value: "succeeded", label: "已完成" },
  { value: "dead", label: "已死信" },
];

function RecoveryTab() {
  const [status, setStatus] = useState("all");
  const [userIdInput, setUserIdInput] = useState("");
  const [page, setPage] = useState(1);

  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["recovery-jobs", { status, userId, page }],
    queryFn: () =>
      listRecoveryJobs({
        page,
        pageSize: PAGE_SIZE,
        status: status === "all" ? undefined : status,
        userId,
      }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (page > pageCount) {
    setPage(pageCount);
  }

  function resetPage<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        上游已成功、settlement 确认前的补偿任务。dead 表示自动重试已耗尽，需人工介入。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={resetPage(setStatus)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECOVERY_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="用户 ID"
          value={userIdInput}
          onChange={(e) => resetPage(setUserIdInput)(e.target.value)}
          inputMode="numeric"
          className="w-32"
        />
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Table className={query.isFetching ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>用户 / 渠道</TableHead>
                <TableHead>重试</TableHead>
                <TableHead>冻结金额</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-16 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: RECOVERY_COLS }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={RECOVERY_COLS} className="h-48">
                    <RecoveryEmpty />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {j.id}
                    </TableCell>
                    <TableCell>
                      <RecoveryStatusBadge status={j.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {j.user_id} / {j.channel_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {j.attempt_count} / {j.max_attempts}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {trimDecimal(j.authorized_amount)} {j.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDateTime(j.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RecoveryJobDetailDialog jobId={j.id}>
                        <Button variant="ghost" size="icon-sm" aria-label="详情">
                          <EyeIcon />
                        </Button>
                      </RecoveryJobDetailDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            page={page}
            pageCount={pageCount}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function RecoveryEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ActivityIcon />
        </EmptyMedia>
        <EmptyTitle>暂无补偿任务</EmptyTitle>
        <EmptyDescription>没有匹配当前筛选条件的结算补偿任务。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function SyncJobsTab() {
  const query = useQuery({
    queryKey: ["system-sync-jobs"],
    queryFn: () => listSyncJobs(20),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          models.dev 同步任务审计（只读）。触发同步请到「模型 → 参考目录」。
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="刷新"
          onClick={() => query.refetch()}
        >
          <RefreshCwIcon />
        </Button>
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          还没有同步任务
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>结束时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(query.data ?? []).map((job) => (
              <SyncJobRow key={job.id} job={job} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SyncJobRow({ job }: { job: SyncJob }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">
        {job.id}
      </TableCell>
      <TableCell>{job.source}</TableCell>
      <TableCell>
        <SyncStatusBadge status={job.status} />
        {job.error_text && (
          <div className="text-destructive mt-1 max-w-xs truncate text-xs">
            {job.error_text}
          </div>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {formatDateTime(job.created_at)}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {job.finished_at ? formatDateTime(job.finished_at) : "—"}
      </TableCell>
    </TableRow>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  if (status === "succeeded") return <Badge variant="default">成功</Badge>;
  if (status === "running") return <Badge variant="secondary">运行中</Badge>;
  if (status === "failed") return <Badge variant="destructive">失败</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const HEALTH_RANGES = [
  { value: "24h", label: "近 24 小时", hours: 24 },
  { value: "7d", label: "近 7 天", hours: 24 * 7 },
  { value: "30d", label: "近 30 天", hours: 24 * 30 },
];

// range → from 的 RFC3339 起点；在取数回调里调用（非 render 期），避免纯度告警。
function rangeToFrom(range: string): string {
  const hours = HEALTH_RANGES.find((r) => r.value === range)?.hours ?? 168;
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

const BUCKET_META: Record<
  ChannelHealthBucket,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  healthy: { label: "健康", badge: "default" },
  degraded: { label: "降级", badge: "secondary" },
  unhealthy: { label: "异常", badge: "destructive" },
  no_data: { label: "无数据", badge: "outline" },
};

function ChannelHealthTab() {
  const [range, setRange] = useState("7d");

  const query = useQuery({
    // from 在 queryFn（取数时）计算，避免在 render 期调用 Date.now（纯度规则）。
    queryKey: ["channel-health", range],
    queryFn: () => listChannelHealth({ from: rangeToFrom(range) }),
    placeholderData: keepPreviousData,
  });

  const items = query.data ?? [];
  const dist = useMemo(() => bucketDistribution(query.data ?? []), [query.data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-xl text-xs">
          按区间内 request_attempts 成功率派生的渠道健康近似。熔断器是 gateway
          进程内内存态、跨进程不可见，这里不代表实时电路状态。
        </p>
        <div className="flex gap-1">
          {HEALTH_RANGES.map((r) => (
            <Button
              key={r.value}
              variant={range === r.value ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BUCKET_META) as ChannelHealthBucket[]).map((b) => (
              <Badge key={b} variant={BUCKET_META[b].badge}>
                {BUCKET_META[b].label} {dist[b]}
              </Badge>
            ))}
          </div>

          <Table className={query.isFetching ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>渠道</TableHead>
                <TableHead>健康</TableHead>
                <TableHead className="text-right">成功率</TableHead>
                <TableHead className="text-right">尝试（成功/失败）</TableHead>
                <TableHead>最近尝试</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32">
                    <HealthEmpty />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((c) => <ChannelHealthRow key={c.channel_id} ch={c} />)
              )}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

function ChannelHealthRow({ ch }: { ch: ChannelHealth }) {
  const meta = BUCKET_META[ch.bucket];
  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">
        {ch.channel_id}
      </TableCell>
      <TableCell className="font-medium">
        {ch.name}
        {ch.status !== "enabled" && (
          <Badge variant="outline" className="ml-2 text-xs">
            {ch.status}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {ch.attempt_total === 0 ? "—" : `${(ch.success_rate * 100).toFixed(1)}%`}
      </TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {ch.attempt_total}（{ch.attempt_succeeded}/{ch.attempt_failed}）
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {ch.last_attempt_at ? formatDateTime(ch.last_attempt_at) : "—"}
      </TableCell>
    </TableRow>
  );
}

function HealthEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HeartPulseIcon />
        </EmptyMedia>
        <EmptyTitle>暂无渠道</EmptyTitle>
        <EmptyDescription>当前没有可统计健康的渠道。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function bucketDistribution(
  items: ChannelHealth[],
): Record<ChannelHealthBucket, number> {
  const out: Record<ChannelHealthBucket, number> = {
    healthy: 0,
    degraded: 0,
    unhealthy: 0,
    no_data: 0,
  };
  for (const c of items) out[c.bucket] += 1;
  return out;
}

// 空串或非正整数 → undefined（不参与筛选）。
function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
