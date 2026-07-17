import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ActivityIcon } from "lucide-react";
import { listRequests, type RequestListItem } from "@/lib/api/requests";
import {
  formatLatencyMs,
  formatTokenScale,
  formatUSDPrecise,
} from "@/lib/format";
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

/** 按当前行真实展示文案估算列宽（避免假最长样本把列撑开）。 */
function requestAutoSizeValue(row: RequestListItem, columnId: string): unknown {
  switch (columnId) {
    case "status": {
      const map: Record<string, string> = {
        succeeded: "成功",
        failed: "失败",
        running: "进行中",
        pending: "待处理",
        canceled: "已取消",
      };
      return map[row.status] ?? row.status;
    }
    case "stream":
      return row.stream ? "流式" : "非流式";
    case "user_id":
      return row.api_key_name || `Key #${row.api_key_id}`;
    case "tokens": {
      const total =
        row.uncached_input_tokens +
        row.cache_read_input_tokens +
        row.cache_write_5m_input_tokens +
        row.cache_write_1h_input_tokens +
        row.cache_write_30m_input_tokens +
        row.output_tokens;
      if (total === 0) return "—";
      // 主行决定列宽；副行更小字号，不参与撑宽。
      return `↓${formatTokenScale(row.uncached_input_tokens)} / ↑${formatTokenScale(row.output_tokens)}`;
    }
    case "timing": {
      // 只按主行总耗时估宽。副行「首字 · t/s」是 10px，按正文估会把列撑太宽，挤占线路。
      if (row.latency_ms == null && row.ttft_ms == null && row.tps == null) return "—";
      return row.latency_ms != null ? formatLatencyMs(row.latency_ms) : "—";
    }
    case "cost":
      return row.user_charge_usd == null ? "—" : formatUSDPrecise(row.user_charge_usd);
    case "request_id": {
      const id = row.request_id;
      return id.length > 14 ? `${id.slice(0, 14)}…` : id;
    }
    case "model":
      return row.requested_model_id;
    case "route": {
      const name = row.route_name || "—";
      const chain = row.channel_chain || "";
      const channelCount = chain
        ? chain.split(" → ").filter(Boolean).length
        : row.final_channel_name
          ? 1
          : 0;
      // 渠道数徽章占位，避免线路名被截断后徽章还在。
      return channelCount > 0 ? `${name}  ${channelCount}` : name;
    }
    case "reasoning":
      return !row.reasoning_effort || row.reasoning_effort === "none"
        ? "—"
        : row.reasoning_effort.toUpperCase();
    case "endpoint":
      return row.operation || row.ingress_protocol || "—";
    case "ip":
      return row.client_ip || "—";
    default:
      return undefined;
  }
}

export interface RequestsListProps {
  /** 锁定用户：始终带 user_id 查询，隐藏用户筛选与用户/Key 列。 */
  fixedUserId?: number;
  /** 列布局 localStorage 键；嵌入页与请求中心分开存。 */
  storageKey?: string;
  /** 外部时间区间（详情页与页头 RangeFilter 共用）；缺省则组件内自建区间。 */
  rangeParams?: { from?: string; to?: string };
  /** 是否在表格工具栏展示 RangeFilter；详情页由页头控制时应为 false。 */
  showRangeFilter?: boolean;
  /** 是否同步 URL 上的 request_id / q 深链打开详情（请求中心用）。 */
  syncUrlDeepLink?: boolean;
}

/** 请求记录列表：请求中心与用户详情等场景共用。 */
export function RequestsList({
  fixedUserId,
  storageKey = "requests",
  rangeParams: externalRangeParams,
  showRangeFilter = true,
  syncUrlDeepLink = false,
}: RequestsListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepRequestId = syncUrlDeepLink
    ? (searchParams.get("request_id") ?? searchParams.get("q"))
    : null;
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

  const statusParam = syncUrlDeepLink ? searchParams.get("status") : null;
  const [status, setStatus] = useState(
    statusParam && REQUEST_STATUS_OPTIONS.some((o) => o.value === statusParam)
      ? statusParam
      : "",
  );
  const [modelInput, setModelInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const internalRange = useRangeQuery("24h");
  const rangeParams = externalRangeParams ?? internalRange.params;
  const useInternalRangeFilter = showRangeFilter && externalRangeParams == null;

  const { page, setPage, sorting, setSorting, sort } = useServerList({
    defaultSort: { id: "created_at", desc: true },
  });

  const model = useDebouncedValue(modelInput.trim(), 300);
  const parsedUserId = useDebouncedValue(parsePositiveInt(userIdInput), 300);
  const userId = fixedUserId ?? parsedUserId;

  const allColumns = useMemo(() => requestOsColumns(setSelectedRequestId), []);
  const columns = useMemo(
    () =>
      fixedUserId != null
        ? allColumns.filter((col) => col.id !== "user_id")
        : allColumns,
    [allColumns, fixedUserId],
  );

  const query = useQuery({
    queryKey: [
      "requests",
      storageKey,
      { status, model, userId, page, sort, range: rangeParams },
    ],
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
  // 状态已在 FacetFilterButton 内展示，不再单独出 chip。
  if (model) {
    chips.push({
      id: "model",
      label: `模型 · ${model}`,
      onRemove: () => reset(setModelInput)(""),
    });
  }
  if (fixedUserId == null && userId != null) {
    chips.push({
      id: "user",
      label: `用户 · ${userId}`,
      onRemove: () => reset(setUserIdInput)(""),
    });
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
          storageKey={storageKey}
          columns={columns}
          data={items}
          columnLabels={REQUEST_OS_COLUMN_LABELS}
          getAutoSizeValue={requestAutoSizeValue}
          columnFlexMode="content"
          total={total}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(r) => String(r.id)}
          loading={query.isPending}
          // 有进行中请求时每 5s 后台轮询：keepPreviousData 已保底，不再整表 opacity 闪烁。
          refetching={false}
          emptyContent={<RequestsEmpty />}
          searchValue={modelInput}
          onSearchChange={reset(setModelInput)}
          searchPlaceholder="按模型筛选"
          chips={chips}
          onClearChips={() => {
            reset(setStatus)("");
            setModelInput("");
            if (fixedUserId == null) setUserIdInput("");
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
              {fixedUserId == null ? (
                <Input
                  placeholder="用户 ID"
                  value={userIdInput}
                  onChange={(e) => reset(setUserIdInput)(e.target.value)}
                  inputMode="numeric"
                  className="h-8 w-28"
                />
              ) : null}
            </>
          }
          toolbarActions={
            useInternalRangeFilter ? (
              <RangeFilter
                value={internalRange.value}
                onChange={(v) => {
                  internalRange.setRange(v);
                  setPage(1);
                }}
                refreshedAt={internalRange.refreshedAt}
                onRefresh={internalRange.refresh}
              />
            ) : null
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
