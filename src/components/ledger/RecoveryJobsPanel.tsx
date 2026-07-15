import { useState, useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ActivityIcon } from "lucide-react";
import { listRecoveryJobs } from "@/lib/api/system";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import type { FilterChip } from "@/components/openstatus-table";
import {
  recoveryJobOsColumns,
  RECOVERY_OS_COLUMN_LABELS,
  RECOVERY_STATUS_OPTIONS,
} from "@/components/openstatus-table/system-os-columns";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PAGE_SIZE = 20;

// 结算补偿任务列表（账本页「结算补偿」Tab；原系统页迁入——补偿任务属结算域,与流水/计费异常同屏）。
// 任务语义：上游已成功且有可靠 usage、但 settlement 确认前失败的持久化补偿队列;
// dead(死信)= 自动重试耗尽,已由 worker 收口(释放冻结+记风险敞口),需人工关注。
export function RecoveryJobsPanel() {
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
          storageKey="ledger:recovery-jobs"
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

function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
