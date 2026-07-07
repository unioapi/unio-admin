import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ActivityIcon, RefreshCwIcon } from "lucide-react";
import { listRecoveryJobs, getSystemConfig } from "@/lib/api/system";
import { listSyncJobs } from "@/lib/api/capability";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import type { FilterChip } from "@/components/openstatus-table";
import {
  recoveryJobOsColumns,
  syncJobOsColumns,
  RECOVERY_OS_COLUMN_LABELS,
  SYNC_OS_COLUMN_LABELS,
  RECOVERY_STATUS_OPTIONS,
} from "@/components/openstatus-table/system-os-columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnthropicBetaPolicyCard } from "@/components/system/AnthropicBetaPolicyCard";

const PAGE_SIZE = 20;

const SYSTEM_TABS = ["recovery", "sync", "config", "providers"] as const;
type SystemTab = (typeof SYSTEM_TABS)[number];

export function SystemPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: SystemTab = SYSTEM_TABS.includes(raw as SystemTab)
    ? (raw as SystemTab)
    : "recovery";
  const setTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (v === "recovery") sp.delete("tab");
        else sp.set("tab", v);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="recovery">结算补偿任务</TabsTrigger>
          <TabsTrigger value="sync">同步任务</TabsTrigger>
          <TabsTrigger value="config">网关配置</TabsTrigger>
          <TabsTrigger value="providers">Provider 设置</TabsTrigger>
        </TabsList>
        <TabsContent value="recovery" className="pt-4">
          <RecoveryTab />
        </TabsContent>
        <TabsContent value="sync" className="pt-4">
          <SyncJobsTab />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <ConfigTab />
        </TabsContent>
        <TabsContent value="providers" className="pt-4">
          <AnthropicBetaPolicyCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConfigTab() {
  const query = useQuery({
    queryKey: ["system-config"],
    queryFn: getSystemConfig,
  });

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  const config = query.data;

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>只读配置</AlertTitle>
        <AlertDescription>{config.note}</AlertDescription>
      </Alert>
      <div className="grid gap-4 md:grid-cols-2">
        {config.groups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="text-sm">{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {group.entries.map((entry) => (
                  <div key={entry.env} className="flex flex-col">
                    <dt className="text-muted-foreground text-xs">{entry.label}</dt>
                    <dd className="font-medium tabular-nums break-all">{entry.value}</dd>
                    <dd className="text-muted-foreground/70 font-mono text-[10px] break-all">
                      {entry.env}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RecoveryTab() {
  const [status, setStatus] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    defaultSort: { id: "created_at", desc: true },
  });
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["recovery-jobs", { status, userId, page, sort }],
    queryFn: () =>
      listRecoveryJobs({
        page,
        pageSize: PAGE_SIZE,
        sort,
        status: status || undefined,
        userId,
      }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  function reset<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const chips: FilterChip[] = [];
  if (status) {
    const label = RECOVERY_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
    chips.push({ id: `status:${status}`, label: `状态 · ${label}`, onRemove: () => reset(setStatus)("") });
  }
  if (userId != null) {
    chips.push({ id: "user", label: `用户 · ${userId}`, onRemove: () => reset(setUserIdInput)("") });
  }

  return (
    <>
      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : (
        <ServerDataTable
          storageKey="system:recovery-jobs"
          columns={recoveryJobOsColumns()}
          data={items}
          columnLabels={RECOVERY_OS_COLUMN_LABELS}
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(r) => String(r.id)}
          loading={query.isPending}
          refetching={query.isFetching && !query.isPending}
          emptyContent={<RecoveryEmpty />}
          chips={chips}
          onClearChips={() => {
            setStatus("");
            setUserIdInput("");
            setPage(1);
          }}
          toolbarFilters={
            <>
              <FacetFilterButton
                label="状态"
                multiple={false}
                value={status ? [status] : []}
                options={[...RECOVERY_STATUS_OPTIONS]}
                onChange={(v) => reset(setStatus)(v[0] ?? "")}
              />
              <Input
                placeholder="用户 ID"
                value={userIdInput}
                onChange={(e) => reset(setUserIdInput)(e.target.value)}
                inputMode="numeric"
                className="h-8 w-28"
              />
            </>
          }
        />
      )}
    </>
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
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    defaultSort: { id: "created_at", desc: true },
  });

  const query = useQuery({
    queryKey: ["system-sync-jobs", page, sort],
    queryFn: () => listSyncJobs({ page, pageSize: PAGE_SIZE, sort }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  return (
    <>
      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : (
        <ServerDataTable
          storageKey="system:sync-jobs"
          columns={syncJobOsColumns()}
          data={items}
          columnLabels={SYNC_OS_COLUMN_LABELS}
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(r) => String(r.id)}
          loading={query.isPending}
          refetching={query.isFetching && !query.isPending}
          emptyMessage="还没有同步任务"
          toolbarActions={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="刷新"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCwIcon className={query.isFetching ? "animate-spin" : undefined} />
            </Button>
          }
        />
      )}
    </>
  );
}

function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
