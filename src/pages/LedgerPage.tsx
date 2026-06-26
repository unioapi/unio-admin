import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { WalletIcon } from "lucide-react";
import {
  listBillingExceptions,
  listLedgerEntries,
} from "@/lib/api/ledger";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ConfigurableDataTable } from "@/components/data-table";
import {
  billingExceptionColumns,
  ledgerEntryColumns,
} from "@/components/ops-tables/ledger-columns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 20;

const LEDGER_VIEW_OPTIONS = [
  { value: "entries", label: "流水" },
  { value: "exceptions", label: "计费异常" },
] as const;

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
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {LEDGER_VIEW_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="entries" className="pt-4">
            <EntriesPanel />
          </TabsContent>
          <TabsContent value="exceptions" className="pt-4">
            <ExceptionsPanel />
          </TabsContent>
        </Tabs>
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
      {query.isError ? (
        <ErrorAlert message={query.error.message} />
      ) : (
        <>
          <ConfigurableDataTable
            storageKey="ledger:entries"
            data={items}
            columns={ledgerEntryColumns()}
            loading={query.isPending}
            pinnedColumnId="user_id"
            bordered={false}
            emptyContent={<PanelEmpty label="账本流水" />}
            getRowId={(r) => String(r.id)}
            tableClassName={query.isFetching && !query.isPending ? "opacity-60" : undefined}
            toolbarStart={
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
      {query.isError ? (
        <ErrorAlert message={query.error.message} />
      ) : (
        <>
          <ConfigurableDataTable
            storageKey="ledger:exceptions"
            data={items}
            columns={billingExceptionColumns()}
            loading={query.isPending}
            pinnedColumnId="user_id"
            bordered={false}
            emptyContent={<PanelEmpty label="计费异常" />}
            getRowId={(r) => String(r.id)}
            tableClassName={query.isFetching && !query.isPending ? "opacity-60" : undefined}
            toolbarStart={
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
    </div>
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
