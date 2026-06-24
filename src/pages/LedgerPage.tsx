import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { WalletIcon } from "lucide-react";
import {
  listBillingExceptions,
  listLedgerEntries,
} from "@/lib/api/ledger";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime, trimDecimal } from "@/lib/format";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

const PAGE_SIZE = 20;

export function LedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: "entries" | "exceptions" =
    searchParams.get("tab") === "exceptions" ? "exceptions" : "entries";
  const setTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (v === "exceptions") sp.set("tab", "exceptions");
        else sp.delete("tab");
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>账本</CardTitle>
        <CardDescription>计费流水与计费异常（只读）</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="entries">流水</TabsTrigger>
            <TabsTrigger value="exceptions">计费异常</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "entries" ? <EntriesPanel /> : <ExceptionsPanel />}
      </CardContent>
    </Card>
  );
}

function EntriesPanel() {
  const [userIdInput, setUserIdInput] = useState("");
  const [page, setPage] = useState(1);
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["ledger-entries", { userId, page }],
    queryFn: () => listLedgerEntries({ page, pageSize: PAGE_SIZE, userId }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pageCount) setPage(pageCount);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="用户 ID"
        value={userIdInput}
        onChange={(e) => {
          setUserIdInput(e.target.value);
          setPage(1);
        }}
        inputMode="numeric"
        className="w-32"
      />

      {query.isError ? (
        <ErrorAlert message={query.error.message} />
      ) : (
        <>
          <Table className={query.isFetching ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-right">余额</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending ? (
                <SkeletonRows cols={6} />
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48">
                    <PanelEmpty label="账本流水" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {e.user_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.entry_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {trimDecimal(e.amount)} {e.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {trimDecimal(e.balance_after)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">
                      {e.reason}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDateTime(e.created_at)}
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
    </div>
  );
}

function ExceptionsPanel() {
  const [userIdInput, setUserIdInput] = useState("");
  const [page, setPage] = useState(1);
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["billing-exceptions", { userId, page }],
    queryFn: () => listBillingExceptions({ page, pageSize: PAGE_SIZE, userId }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pageCount) setPage(pageCount);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="用户 ID"
        value={userIdInput}
        onChange={(e) => {
          setUserIdInput(e.target.value);
          setPage(1);
        }}
        inputMode="numeric"
        className="w-32"
      />

      {query.isError ? (
        <ErrorAlert message={query.error.message} />
      ) : (
        <>
          <Table className={query.isFetching ? "opacity-60" : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">平台承担</TableHead>
                <TableHead>原因码</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending ? (
                <SkeletonRows cols={6} />
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48">
                    <PanelEmpty label="计费异常" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {x.user_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{x.event_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {trimDecimal(x.platform_amount)} {x.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {x.reason_code}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">
                      {x.reason}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDateTime(x.created_at)}
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
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-20" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>加载失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function PanelEmpty({ label }: { label: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WalletIcon />
        </EmptyMedia>
        <EmptyTitle>暂无{label}</EmptyTitle>
        <EmptyDescription>没有匹配当前筛选条件的记录。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function parsePositiveInt(raw: string): number | undefined {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
