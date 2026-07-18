import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { WalletIcon } from "lucide-react";
import { listBillingExceptions, listLedgerEntries } from "@/lib/api/ledger";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import {
  billingExceptionOsColumns,
  ledgerEntryOsColumns,
  LEDGER_ENTRY_OS_COLUMN_LABELS,
  BILLING_EXCEPTION_OS_COLUMN_LABELS,
  EVENT_TYPE_FILTER_OPTIONS,
  REASON_CODE_FILTER_OPTIONS,
} from "@/components/openstatus-table/ledger-os-columns";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecoveryJobsPanel } from "@/components/ledger/RecoveryJobsPanel";

const PAGE_SIZE = 20;

const LEDGER_VIEW_OPTIONS = [
  { value: "entries", label: "流水" },
  { value: "exceptions", label: "计费异常" },
  { value: "recovery", label: "结算补偿" },
] as const;

type LedgerTab = (typeof LEDGER_VIEW_OPTIONS)[number]["value"];

export function LedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: LedgerTab = LEDGER_VIEW_OPTIONS.some((o) => o.value === raw)
    ? (raw as LedgerTab)
    : "entries";
  const setTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (v === "entries") sp.delete("tab");
        else sp.set("tab", v);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-4">
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
        {/* 结算补偿任务：上游已扣费但 settlement 未确认的补偿队列(原系统页迁入)。 */}
        <TabsContent value="recovery" className="pt-4">
          <RecoveryJobsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EntriesPanel() {
  const [searchParams] = useSearchParams();
  const [userIdInput, setUserIdInput] = useState(
    () => searchParams.get("userId") ?? "",
  );
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    urlKey: "ledger:entries",
    defaultSort: { id: "created_at", desc: true },
  });
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["ledger-entries", { userId, page, sort }],
    queryFn: () => listLedgerEntries({ page, pageSize: PAGE_SIZE, sort, userId }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  if (query.isError) return <ErrorAlert message={query.error.message} />;

  return (
    <ServerDataTable
      storageKey="ledger:entries"
      columns={ledgerEntryOsColumns()}
      data={items}
      columnLabels={LEDGER_ENTRY_OS_COLUMN_LABELS}
      total={total}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      sorting={sorting}
      onSortingChange={setSorting}
      getRowId={(r) => String(r.id)}
      loading={query.isPending}
      refetching={query.isFetching && !query.isPending}
      emptyContent={<PanelEmpty label="账本流水" />}
      toolbarFilters={
        <Input
          placeholder="用户 ID"
          value={userIdInput}
          onChange={(e) => {
            setUserIdInput(e.target.value);
            setPage(1);
          }}
          inputMode="numeric"
          className="h-8 w-28"
        />
      }
    />
  );
}

function ExceptionsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [userIdInput, setUserIdInput] = useState("");
  const [eventType, setEventType] = useState("");
  // reason_code 从 URL 读取，便于「孤儿清扫观测视图」等深链直达（?tab=exceptions&reason_code=orphan_reservation_swept）。
  const reasonCode = searchParams.get("reason_code") ?? "";
  const setReasonCode = (v: string) => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (v) sp.set("reason_code", v);
        else sp.delete("reason_code");
        return sp;
      },
      { replace: true },
    );
  };
  const { page, setPage, sorting, setSorting, sort } = useServerList({
    urlKey: "ledger:exceptions",
    defaultSort: { id: "created_at", desc: true },
  });
  const userId = useDebouncedValue(parsePositiveInt(userIdInput), 300);

  const query = useQuery({
    queryKey: ["billing-exceptions", { userId, eventType, reasonCode, page, sort }],
    queryFn: () =>
      listBillingExceptions({
        page,
        pageSize: PAGE_SIZE,
        sort,
        userId,
        eventType: eventType || undefined,
        reasonCode: reasonCode || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  if (query.isError) return <ErrorAlert message={query.error.message} />;

  return (
    <ServerDataTable
      storageKey="ledger:exceptions"
      columns={billingExceptionOsColumns()}
      data={items}
      columnLabels={BILLING_EXCEPTION_OS_COLUMN_LABELS}
      total={total}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      sorting={sorting}
      onSortingChange={setSorting}
      getRowId={(r) => String(r.id)}
      loading={query.isPending}
      refetching={query.isFetching && !query.isPending}
      emptyContent={<PanelEmpty label="计费异常" />}
      toolbarFilters={
        <>
          <FacetFilterButton
            label="类型"
            multiple={false}
            value={eventType ? [eventType] : []}
            options={[...EVENT_TYPE_FILTER_OPTIONS]}
            onChange={(v) => {
              setEventType(v[0] ?? "");
              setPage(1);
            }}
          />
          <FacetFilterButton
            label="原因码"
            multiple={false}
            value={reasonCode ? [reasonCode] : []}
            options={REASON_CODE_FILTER_OPTIONS}
            onChange={(v) => {
              setReasonCode(v[0] ?? "");
              setPage(1);
            }}
          />
          <Input
            placeholder="用户 ID"
            value={userIdInput}
            onChange={(e) => {
              setUserIdInput(e.target.value);
              setPage(1);
            }}
            inputMode="numeric"
            className="h-8 w-28"
          />
        </>
      }
    />
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
