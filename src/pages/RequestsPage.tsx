import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ActivityIcon, EyeIcon, SearchIcon } from "lucide-react";
import { listRequests } from "@/lib/api/requests";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { RequestDetailDialog } from "@/components/requests/RequestDetailDialog";

const COLS = 7;
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

  const [status, setStatus] = useState("all");
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
        <div className="flex flex-wrap items-center gap-3">
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

          <div className="relative w-full max-w-xs">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="按模型筛选"
              value={modelInput}
              onChange={(e) => resetPage(setModelInput)(e.target.value)}
              className="pl-8"
            />
          </div>

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
                  <TableHead>请求 ID</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>流式</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-16 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-44" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-10" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto size-8" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLS} className="h-48">
                      <RequestsEmpty />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-44 truncate font-mono text-xs">
                        {r.request_id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.requested_model_id}
                      </TableCell>
                      <TableCell>
                        <RequestStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.stream ? "是" : "否"}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {r.user_id}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <RequestDetailDialog requestId={r.request_id}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="详情"
                          >
                            <EyeIcon />
                          </Button>
                        </RequestDetailDialog>
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
