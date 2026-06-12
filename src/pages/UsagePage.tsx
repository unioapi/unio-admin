import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { GaugeIcon, SearchIcon } from "lucide-react";
import { listUsage } from "@/lib/api/usage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime } from "@/lib/format";
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

const COLS = 7;
const PAGE_SIZE = 20;

export function UsagePage() {
  const [modelInput, setModelInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [page, setPage] = useState(1);

  const model = useDebouncedValue(modelInput.trim(), 300);
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["usage", { model, userId, page }],
    queryFn: () => listUsage({ page, pageSize: PAGE_SIZE, model, userId }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (page > pageCount) {
    setPage(pageCount);
  }

  function changeModel(next: string) {
    setModelInput(next);
    setPage(1);
  }

  function changeUserId(next: string) {
    setUserIdInput(next);
    setPage(1);
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>用量</CardTitle>
        <CardDescription>逐请求的 token 用量事实（只读）</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="按模型筛选"
              value={modelInput}
              onChange={(e) => changeModel(e.target.value)}
              className="pl-8"
            />
          </div>
          <Input
            placeholder="用户 ID"
            value={userIdInput}
            onChange={(e) => changeUserId(e.target.value)}
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
                  <TableHead className="text-right">输入</TableHead>
                  <TableHead className="text-right">输出</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: COLS }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLS} className="h-48">
                      <UsageEmpty />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-44 truncate font-mono text-xs">
                        {u.request_id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {u.requested_model_id}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inputTokens(u)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u.output_tokens_total}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.usage_source}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {u.user_id}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDateTime(u.created_at)}
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

// 输入合计：未缓存 + 缓存读取 + 两档缓存写入。
function inputTokens(u: {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_write_5m_input_tokens: number;
  cache_write_1h_input_tokens: number;
}): number {
  return (
    u.uncached_input_tokens +
    u.cache_read_input_tokens +
    u.cache_write_5m_input_tokens +
    u.cache_write_1h_input_tokens
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
