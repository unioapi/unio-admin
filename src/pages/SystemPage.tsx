import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  HeartPulseIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  listChannelHealth,
  listRecoveryJobs,
  type ChannelHealth,
  type ChannelHealthBucket,
} from "@/lib/api/system";
import { listSyncJobs } from "@/lib/api/capability";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfigurableDataTable, TableToolbarSelect } from "@/components/data-table";
import {
  BUCKET_META,
  channelHealthColumns,
  recoveryJobColumns,
  syncJobColumns,
} from "@/components/ops-tables/system-columns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/common/TablePagination";

const SYSTEM_VIEW_OPTIONS = [
  { value: "recovery", label: "结算补偿任务" },
  { value: "sync", label: "同步任务" },
  { value: "health", label: "渠道健康" },
] as const;

const PAGE_SIZE = 20;

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
      <CardContent className="flex flex-col gap-4 pt-6">
        <TableToolbarSelect
          value={tab}
          onValueChange={setTab}
          options={SYSTEM_VIEW_OPTIONS}
          triggerClassName="w-44"
        />

        {tab === "recovery" ? <RecoveryTab /> : null}
        {tab === "sync" ? <SyncJobsTab /> : null}
        {tab === "health" ? <ChannelHealthTab /> : null}
      </CardContent>
    </Card>
  );
}

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

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : (
        <>
          <ConfigurableDataTable
            storageKey="system:recovery-jobs"
            data={items}
            columns={recoveryJobColumns()}
            loading={query.isPending}
            pinnedColumnId="id"
            bordered={false}
            emptyContent={<RecoveryEmpty />}
            getRowId={(r) => String(r.id)}
            tableClassName={query.isFetching && !query.isPending ? "opacity-60" : undefined}
            toolbarStart={
              <>
                <TableToolbarSelect
                  value={status}
                  onValueChange={resetPage(setStatus)}
                  options={RECOVERY_STATUS_OPTIONS}
                  triggerClassName="w-36"
                />
                <Input
                  placeholder="用户 ID"
                  value={userIdInput}
                  onChange={(e) => resetPage(setUserIdInput)(e.target.value)}
                  inputMode="numeric"
                  className="w-32"
                />
              </>
            }
          />

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
      <p className="text-muted-foreground text-xs">
        models.dev 同步任务审计（只读）。触发同步请到「模型 → 参考目录」。
      </p>

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
        <ConfigurableDataTable
          storageKey="system:sync-jobs"
          data={query.data ?? []}
          columns={syncJobColumns()}
          pinnedColumnId="id"
          bordered={false}
          emptyMessage="还没有同步任务"
          getRowId={(r) => String(r.id)}
          tableClassName={query.isFetching ? "opacity-60" : undefined}
          toolbarEnd={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="刷新"
              onClick={() => query.refetch()}
            >
              <RefreshCwIcon />
            </Button>
          }
        />
      )}
    </div>
  );
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
      <p className="text-muted-foreground max-w-xl text-xs">
        按区间内 request_attempts 成功率派生的渠道健康近似。熔断器是 gateway
        进程内内存态、跨进程不可见，这里不代表实时电路状态。
      </p>

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

          <ConfigurableDataTable
            storageKey="system:channel-health"
            data={items}
            columns={channelHealthColumns()}
            pinnedColumnId="name"
            bordered={false}
            emptyContent={<HealthEmpty />}
            getRowId={(r) => String(r.channel_id)}
            tableClassName={query.isFetching ? "opacity-60" : undefined}
            toolbarStart={
              <TableToolbarSelect
                value={range}
                onValueChange={setRange}
                options={HEALTH_RANGES}
                triggerClassName="w-36"
              />
            }
          />
        </>
      )}
    </div>
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
