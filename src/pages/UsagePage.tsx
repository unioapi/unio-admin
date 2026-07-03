import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { GaugeIcon } from "lucide-react";
import { listUsage } from "@/lib/api/usage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { ServerDataTable } from "@/components/openstatus-table";
import type { FilterChip } from "@/components/openstatus-table";
import {
  usageOsColumns,
  USAGE_OS_COLUMN_LABELS,
} from "@/components/openstatus-table/usage-os-columns";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";
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

export function UsagePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepRequestId = searchParams.get("request_id");
  const closeDeep = () => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.delete("request_id");
        return sp;
      },
      { replace: true },
    );
  };

  const [modelInput, setModelInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const { value: range, setRange, params: rangeParams, refresh, refreshedAt } =
    useRangeQuery("24h");
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    defaultSort: { id: "created_at", desc: true },
  });

  const model = useDebouncedValue(modelInput.trim(), 300);
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);
  const columns = useMemo(() => usageOsColumns(setSelectedRequestId), []);

  const query = useQuery({
    queryKey: ["usage", { model, userId, page, sort, range: rangeParams }],
    queryFn: () =>
      listUsage({
        page,
        pageSize: PAGE_SIZE,
        sort,
        model,
        userId,
        from: rangeParams.from,
        to: rangeParams.to,
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
  if (model) chips.push({ id: "model", label: `模型 · ${model}`, onRemove: () => reset(setModelInput)("") });
  if (userId != null) chips.push({ id: "user", label: `用户 · ${userId}`, onRemove: () => reset(setUserIdInput)("") });

  return (
    <div className="flex flex-col gap-4">
      {deepRequestId ? (
        <RequestDetailDialog
          requestId={deepRequestId}
          open
          onOpenChange={(o) => {
            if (!o) closeDeep();
          }}
        />
      ) : null}
      {selectedRequestId ? (
        <RequestDetailDialog
          requestId={selectedRequestId}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedRequestId(null);
          }}
        />
      ) : null}

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : (
        <ServerDataTable
          storageKey="usage"
          columns={columns}
          data={items}
          columnLabels={USAGE_OS_COLUMN_LABELS}
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(r) => String(r.id)}
          loading={query.isPending}
          refetching={query.isFetching && !query.isPending}
          emptyContent={<UsageEmpty />}
          searchValue={modelInput}
          onSearchChange={reset(setModelInput)}
          searchPlaceholder="按模型筛选"
          chips={chips}
          onClearChips={() => {
            setModelInput("");
            setUserIdInput("");
            setPage(1);
          }}
          toolbarFilters={
            <Input
              placeholder="用户 ID"
              value={userIdInput}
              onChange={(e) => reset(setUserIdInput)(e.target.value)}
              inputMode="numeric"
              className="h-8 w-28"
            />
          }
          toolbarActions={
            <RangeFilter
              value={range}
              onChange={(v) => {
                setRange(v);
                setPage(1);
              }}
              refreshedAt={refreshedAt}
              onRefresh={refresh}
            />
          }
        />
      )}
    </div>
  );
}

function UsageEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GaugeIcon />
        </EmptyMedia>
        <EmptyTitle>暂无用量</EmptyTitle>
        <EmptyDescription>没有匹配当前筛选条件的用量记录。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
