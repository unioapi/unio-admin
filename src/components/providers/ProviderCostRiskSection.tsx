import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangleIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import {
  getProviderCostRisks,
  getProviderCostRiskSummary,
  type ProviderCostRisk,
} from "@/lib/api/providerBalance";
import { formatDateTime, formatUSDPrecise } from "@/lib/format";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import { ColumnHeader } from "@/components/openstatus-table/column-header";
import { TruncateCell } from "@/components/openstatus-table/truncate-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionEmpty } from "@/components/common/detail-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PAGE_SIZE = 20;

const COLUMN_LABELS: Record<string, string> = {
  created_at: "时间",
  status: "状态",
  amount: "估算风险",
  source: "来源",
  request: "请求",
  channel: "渠道",
  model: "模型",
  reason: "原因",
};

function columns(): ColumnDef<ProviderCostRisk, unknown>[] {
  return [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => <ColumnHeader column={column} title="时间" />,
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap text-xs tabular-nums">{formatDateTime(row.original.created_at)}</span>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="状态" />,
      enableSorting: false,
      cell: ({ row }) => <Badge variant={row.original.status === "unresolved" ? "destructive" : "secondary"}>{row.original.status === "unresolved" ? "待对账" : "已对账"}</Badge>,
    },
    {
      id: "amount",
      accessorKey: "estimated_amount",
      header: ({ column }) => <ColumnHeader column={column} title="估算风险" />,
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.estimated_amount == null ? "金额未知" : formatUSDPrecise(row.original.estimated_amount)}</span>,
    },
    {
      id: "source",
      accessorKey: "source_type",
      header: ({ column }) => <ColumnHeader column={column} title="来源" />,
      enableSorting: false,
      cell: ({ row }) => row.original.source_type === "request" ? "请求" : "模型探测",
    },
    {
      id: "request",
      accessorKey: "request_id",
      header: ({ column }) => <ColumnHeader column={column} title="请求" />,
      enableSorting: false,
      cell: ({ row }) => row.original.request_id ? (
        <Button asChild variant="link" className="h-auto max-w-52 justify-start p-0 font-mono text-xs">
          <Link to={`/requests?q=${encodeURIComponent(row.original.request_id)}`}>
            <span className="truncate">{row.original.request_id}</span>
            <SquareArrowOutUpRightIcon />
          </Link>
        </Button>
      ) : row.original.provider_probe_record_id ? (
        <span className="text-muted-foreground text-xs">探测 #{row.original.provider_probe_record_id}</span>
      ) : "—",
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
      cell: ({ row }) => <TruncateCell text={row.original.upstream_model ?? "—"} className="font-mono text-xs" />,
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

export function ProviderCostRiskSection({ providerId }: { providerId: number }) {
  const { page, setPage } = useServerList({ urlKey: `provider:${providerId}:cost-risks`, pageSize: PAGE_SIZE });
  const [status, setStatus] = useState("unresolved");
  const tableColumns = useMemo(() => columns(), []);

  useEffect(() => setPage(1), [status, setPage]);

  const query = useQuery({
    queryKey: ["provider", providerId, "cost-risks", { page, status }],
    queryFn: () => getProviderCostRisks(providerId, { page, page_size: PAGE_SIZE, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ["provider", providerId, "cost-risks", "summary"],
    queryFn: () => getProviderCostRiskSummary(providerId),
  });
  const total = query.data?.total ?? 0;

  return (
    <div className="space-y-4">
      {summary.data && summary.data.unresolved_count > 0 ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>{summary.data.unresolved_count} 笔成本待对账</AlertTitle>
          <AlertDescription>
            已知估算金额 {formatUSDPrecise(summary.data.estimated_amount_usd)}
            {summary.data.unknown_amount_count > 0 ? `，另有 ${summary.data.unknown_amount_count} 笔金额未知` : ""}
          </AlertDescription>
        </Alert>
      ) : null}
      <ServerDataTable
      storageKey={`provider:${providerId}:cost-risks`}
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
      toolbarFilters={
        <FacetFilterButton
          label="对账状态"
          value={status ? [status] : []}
          options={[{ value: "unresolved", label: "待对账" }, { value: "reconciled", label: "已对账" }]}
          onChange={(value) => setStatus(value[0] ?? "")}
        />
      }
      emptyContent={<SectionEmpty icon={AlertTriangleIcon} title="暂无成本风险" description="当前筛选范围内没有待人工核对的 Provider 成本" />}
      getRowId={(row) => String(row.id)}
      />
    </div>
  );
}
