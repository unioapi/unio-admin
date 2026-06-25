import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { GaugeIcon } from "lucide-react";
import { listUsage } from "@/lib/api/usage";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfigurableDataTable, TableToolbarSearch } from "@/components/data-table";
import { usageListColumns } from "@/components/ops-tables/usage-columns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TablePagination } from "@/components/common/TablePagination";

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
        {query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <ConfigurableDataTable
              storageKey="usage:list"
              data={items}
              columns={usageListColumns()}
              loading={query.isPending}
              pinnedColumnId="request_id"
              bordered={false}
              emptyContent={<UsageEmpty />}
              getRowId={(r) => String(r.id)}
              tableClassName={query.isFetching && !query.isPending ? "opacity-60" : undefined}
              toolbarStart={
                <>
                  <TableToolbarSearch
                    value={modelInput}
                    onChange={changeModel}
                    placeholder="按模型筛选"
                    className="max-w-xs w-full"
                  />
                  <Input
                    placeholder="用户 ID"
                    value={userIdInput}
                    onChange={(e) => changeUserId(e.target.value)}
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
      </CardContent>
    </Card>
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
