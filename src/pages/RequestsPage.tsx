import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ActivityIcon, RefreshCwIcon } from "lucide-react";
import { listRequests } from "@/lib/api/requests";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfigurableDataTable, TableToolbarSearch } from "@/components/data-table";
import { requestListColumns } from "@/components/ops-tables/requests-columns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/common/TablePagination";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "succeeded", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "running", label: "进行中" },
  { value: "pending", label: "待处理" },
  { value: "canceled", label: "已取消" },
];

export function RequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // 深链：?request_id= 或 ?q= 自动打开证据中心详情（来自渠道/模型/线路等抽屉）。
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
    statusParam && STATUS_OPTIONS.some((o) => o.value === statusParam)
      ? statusParam
      : "all",
  );
  const [modelInput, setModelInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [page, setPage] = useState(1);

  const model = useDebouncedValue(modelInput.trim(), 300);
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["requests", { status, model, userId, page }],
    queryFn: () =>
      listRequests({
        page,
        pageSize: PAGE_SIZE,
        status: status === "all" ? undefined : status,
        model,
        userId,
      }),
    placeholderData: keepPreviousData,
    // 列表里只要还有进行中/待处理的请求就每 5s 轮询，使其自动翻成最终态；
    // 全部终态后停止轮询（页面失焦时 React Query 默认也不轮询），避免无谓查询压力。
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
    <Card>
      {deepRequestId ? (
        <RequestDetailDialog
          requestId={deepRequestId}
          open
          onOpenChange={(o) => {
            if (!o) closeDeep();
          }}
        />
      ) : null}
      <CardHeader className="border-b">
        <CardTitle>请求</CardTitle>
        <CardDescription>网关请求记录（只读）与上游尝试链路</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <ConfigurableDataTable
              storageKey="requests:list"
              data={items}
              columns={requestListColumns()}
              loading={query.isPending}
              pinnedColumnId="request_id"
              bordered={false}
              emptyContent={<RequestsEmpty />}
              getRowId={(r) => String(r.id)}
              tableClassName={query.isFetching && !query.isPending ? "opacity-60" : undefined}
              toolbarStart={
                <>
                  <Select value={status} onValueChange={resetPage(setStatus)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TableToolbarSearch
                    value={modelInput}
                    onChange={resetPage(setModelInput)}
                    placeholder="按模型筛选"
                    className="max-w-xs w-full"
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
              toolbarEnd={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => query.refetch()}
                  disabled={query.isFetching}
                  aria-label="刷新"
                >
                  <RefreshCwIcon className={query.isFetching ? "animate-spin" : undefined} />
                </Button>
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
      </CardContent>
    </Card>
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

// 空串或非正整数 → undefined（不参与筛选）。
function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
