import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ActivityIcon } from "lucide-react";
import { listRequests } from "@/lib/api/requests";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { useRangeQuery } from "@/hooks/useRangeQuery";
import { RangeFilter } from "@/components/common/RangeFilter";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import type { FilterChip } from "@/components/openstatus-table";
import {
  requestOsColumns,
  REQUEST_OS_COLUMN_LABELS,
  REQUEST_STATUS_OPTIONS,
} from "@/components/openstatus-table/requests-os-columns";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";

const PAGE_SIZE = 20;

export function RequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepRequestId = searchParams.get("request_id") ?? searchParams.get("q");
  const closeDeep = () => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.delete("request_id");
        sp.delete("q");
        return sp;
      },
      { replace: true },
    );
  };

  const statusParam = searchParams.get("status");
  const [status, setStatus] = useState(
    statusParam && REQUEST_STATUS_OPTIONS.some((o) => o.value === statusParam)
      ? statusParam
      : "",
  );
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
  const columns = useMemo(() => requestOsColumns(setSelectedRequestId), []);

  const query = useQuery({
    queryKey: ["requests", { status, model, userId, page, sort, range: rangeParams }],
    queryFn: () =>
      listRequests({
        page,
        pageSize: PAGE_SIZE,
        sort,
        status: status || undefined,
        model,
        userId,
        from: rangeParams.from,
        to: rangeParams.to,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.items.some(
        (r) => r.status === "running" || r.status === "pending",
      )
        ? 5000
        : false,
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
    const label = REQUEST_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
    chips.push({ id: `status:${status}`, label: `状态 · ${label}`, onRemove: () => reset(setStatus)("") });
  }
  if (model) {
    chips.push({ id: "model", label: `模型 · ${model}`, onRemove: () => reset(setModelInput)("") });
  }
  if (userId != null) {
    chips.push({ id: "user", label: `用户 · ${userId}`, onRemove: () => reset(setUserIdInput)("") });
  }

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
          storageKey="requests"
          columns={columns}
          data={items}
          columnLabels={REQUEST_OS_COLUMN_LABELS}
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(r) => String(r.id)}
          loading={query.isPending}
          refetching={query.isFetching && !query.isPending}
          emptyContent={<RequestsEmpty />}
          searchValue={modelInput}
          onSearchChange={reset(setModelInput)}
          searchPlaceholder="按模型筛选"
          chips={chips}
          onClearChips={() => {
            reset(setStatus)("");
            setModelInput("");
            setUserIdInput("");
            setPage(1);
          }}
          toolbarFilters={
            <>
              <FacetFilterButton
                label="状态"
                multiple={false}
                value={status ? [status] : []}
                options={REQUEST_STATUS_OPTIONS}
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

function RequestsEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ActivityIcon />
        </EmptyMedia>
        <EmptyTitle>暂无请求</EmptyTitle>
        <EmptyDescription>没有匹配当前筛选条件的请求记录。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
