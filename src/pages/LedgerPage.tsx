import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { WalletIcon } from "lucide-react";
import { listBillingExceptions, listLedgerEntries } from "@/lib/api/ledger";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import type { FilterChip } from "@/components/openstatus-table";
import {
  billingExceptionColumns,
  billingExceptionEventLabel,
  billingExceptionReasonCodeLabel,
  ledgerEntryColumns,
  EVENT_TYPE_FILTER_OPTIONS,
  REASON_CODE_FILTER_OPTIONS,
} from "@/components/detail-tables/ledger-columns";
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

const PAGE_SIZE = 20;

const ENTRY_LABELS: Record<string, string> = {
  user_id: "用户",
  entry_type: "类型",
  amount: "金额",
  balance_after: "余额",
  reason: "原因",
  created_at: "时间",
};

const EXCEPTION_LABELS: Record<string, string> = {
  user_id: "用户",
  event_type: "类型",
  platform_amount: "平台承担",
  reason_code: "原因码",
  reason: "原因",
  created_at: "时间",
};

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
      </Tabs>
    </div>
  );
}

function userChip(userId: number | undefined, onRemove: () => void): FilterChip[] {
  return userId != null
    ? [{ id: "user", label: `用户 · ${userId}`, onRemove }]
    : [];
}

function EntriesPanel() {
  const [searchParams] = useSearchParams();
  const [userIdInput, setUserIdInput] = useState(
    () => searchParams.get("userId") ?? "",
  );
  const { page, setPage, sorting, setSorting, sort } = useServerList({
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
      columns={ledgerEntryColumns()}
      data={items}
      columnLabels={ENTRY_LABELS}
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
      chips={userChip(userId, () => {
        setUserIdInput("");
        setPage(1);
      })}
      onClearChips={() => {
        setUserIdInput("");
        setPage(1);
      }}
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

  const chips: FilterChip[] = [
    ...userChip(userId, () => {
      setUserIdInput("");
      setPage(1);
    }),
  ];
  if (eventType) {
    chips.push({
      id: `event:${eventType}`,
      label: `类型 · ${billingExceptionEventLabel(eventType)}`,
      onRemove: () => {
        setEventType("");
        setPage(1);
      },
    });
  }
  if (reasonCode) {
    chips.push({
      id: `reason:${reasonCode}`,
      label: `原因码 · ${billingExceptionReasonCodeLabel(reasonCode)}`,
      onRemove: () => {
        setReasonCode("");
        setPage(1);
      },
    });
  }

  return (
    <ServerDataTable
      storageKey="ledger:exceptions"
      columns={billingExceptionColumns()}
      data={items}
      columnLabels={EXCEPTION_LABELS}
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
      chips={chips}
      onClearChips={() => {
        setUserIdInput("");
        setEventType("");
        setReasonCode("");
        setPage(1);
      }}
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
            options={[...REASON_CODE_FILTER_OPTIONS]}
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
