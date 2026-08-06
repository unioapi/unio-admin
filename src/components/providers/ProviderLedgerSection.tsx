import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { SquareArrowOutUpRightIcon, WalletCardsIcon } from "lucide-react";
import {
  getProviderLedgerEntries,
  type ProviderLedgerEntry,
} from "@/lib/api/providerBalance";
import type { RangeQuery } from "@/lib/api/dashboard";
import { formatDateTime, formatUSDPrecise } from "@/lib/format";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import { ColumnHeader } from "@/components/openstatus-table/column-header";
import { TruncateCell } from "@/components/openstatus-table/truncate-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionEmpty } from "@/components/common/detail-section";

const PAGE_SIZE = 20;

const ENTRY_TYPE_LABEL: Record<ProviderLedgerEntry["entry_type"], string> = {
  usage_debit: "请求消费",
  probe_debit: "模型探测",
  adjustment_credit: "增加余额",
  adjustment_debit: "扣减余额",
};

const ENTRY_TYPE_OPTIONS = [
  { value: "usage_debit", label: "请求消费" },
  { value: "probe_debit", label: "模型探测" },
  { value: "adjustment_credit", label: "增加余额" },
  { value: "adjustment_debit", label: "扣减余额" },
];

const COLUMN_LABELS: Record<string, string> = {
  created_at: "时间",
  entry_type: "类型",
  amount: "金额",
  balance: "余额变化",
  request: "请求",
  channel: "渠道",
  model: "模型",
  reason: "原因",
};

function columns(): ColumnDef<ProviderLedgerEntry, unknown>[] {
  return [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="时间" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap text-xs tabular-nums">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "entry_type",
      accessorKey: "entry_type",
      header: ({ column }) => <ColumnHeader column={column} title="类型" />,
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={row.original.entry_type === "adjustment_credit" ? "default" : "secondary"}>
          {ENTRY_TYPE_LABEL[row.original.entry_type]}
        </Badge>
      ),
    },
    {
      id: "amount",
      accessorFn: (row) => Number(row.amount),
      header: ({ column }) => <ColumnHeader column={column} title="金额" />,
      enableSorting: false,
      cell: ({ row }) => {
        const credit = row.original.entry_type === "adjustment_credit";
        return (
          <span
            className={
              credit
                ? "font-medium text-emerald-600 tabular-nums dark:text-emerald-400"
                : "font-medium tabular-nums"
            }
          >
            {credit ? "+" : "-"}{formatUSDPrecise(row.original.amount)}
          </span>
        );
      },
    },
    {
      id: "balance",
      header: ({ column }) => <ColumnHeader column={column} title="余额变化" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs tabular-nums">
          {formatUSDPrecise(row.original.balance_before)} → {formatUSDPrecise(row.original.balance_after)}
        </span>
      ),
    },
    {
      id: "request",
      accessorKey: "request_id",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.request_id ? (
          <Button asChild variant="link" className="h-auto max-w-52 justify-start p-0 font-mono text-xs">
            <Link to={`/requests?q=${encodeURIComponent(row.original.request_id)}`}>
              <span className="truncate">{row.original.request_id}</span>
              <SquareArrowOutUpRightIcon />
            </Link>
          </Button>
        ) : row.original.provider_probe_record_id ? (
          <span className="text-muted-foreground text-xs">模型探测 #{row.original.provider_probe_record_id}</span>
        ) : (
          <span className="text-muted-foreground text-xs">无关联请求</span>
        ),
    },
    {
      id: "channel",
      accessorKey: "channel_name",
      header: ({ column }) => <ColumnHeader column={column} title="渠道" />,
      enableSorting: false,
      cell: ({ row }) => <TruncateCell text={row.original.channel_name ?? "—"} />,
    },
    {
      id: "model",
      accessorKey: "upstream_model",
      header: ({ column }) => <ColumnHeader column={column} title="模型" />,
      enableSorting: false,
      cell: ({ row }) => (
        <TruncateCell text={row.original.upstream_model ?? "—"} className="font-mono text-xs" />
      ),
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: ({ column }) => <ColumnHeader column={column} title="原因" />,
      enableSorting: false,
      cell: ({ row }) => <TruncateCell text={row.original.reason} />,
    },
  ];
}

export function ProviderLedgerSection({
  providerId,
  range,
}: {
  providerId: number;
  range: RangeQuery;
}) {
  const { page, setPage } = useServerList({
    urlKey: `provider:${providerId}:ledger`,
    pageSize: PAGE_SIZE,
  });
  const [entryType, setEntryType] = useState("");
  const [requestID, setRequestID] = useState("");
  const deferredRequestID = useDeferredValue(requestID.trim());
  const tableColumns = useMemo(() => columns(), []);

  useEffect(() => setPage(1), [deferredRequestID, entryType, range.from, range.to, setPage]);

  const query = useQuery({
    queryKey: [
      "provider",
      providerId,
      "ledger",
      { page, entryType, requestID: deferredRequestID, from: range.from, to: range.to },
    ],
    queryFn: () =>
      getProviderLedgerEntries(providerId, {
        page,
        page_size: PAGE_SIZE,
        entry_type: entryType || undefined,
        request_id: deferredRequestID || undefined,
        from: range.from,
        to: range.to,
      }),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  return (
    <ServerDataTable
      storageKey={`provider:${providerId}:ledger`}
      columns={tableColumns}
      data={query.data?.items ?? []}
      columnLabels={COLUMN_LABELS}
      total={total}
      page={page}
      pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
      onPageChange={setPage}
      pageSize={PAGE_SIZE}
      loading={query.isPending && !query.data}
      refetching={query.isFetching && !query.isPending}
      showViewOptions={false}
      bordered={false}
      searchValue={requestID}
      onSearchChange={setRequestID}
      searchPlaceholder="搜索请求编号"
      toolbarFilters={
        <FacetFilterButton
          label="流水类型"
          value={entryType ? [entryType] : []}
          options={ENTRY_TYPE_OPTIONS}
          onChange={(value) => setEntryType(value[0] ?? "")}
        />
      }
      emptyContent={
        <SectionEmpty
          icon={WalletCardsIcon}
          title="暂无账本流水"
          description="当前筛选范围内没有余额变化"
        />
      }
      getRowId={(row) => String(row.id)}
    />
  );
}
