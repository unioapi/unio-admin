import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getChannelTestLogs, type ChannelTestLog } from "@/lib/api/channelsOps";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable } from "@/components/openstatus-table";
import { formatDateTime, formatLatencySec } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 10;

const SOURCE_LABEL: Record<string, string> = {
  worker: "自动巡检",
  manual: "手动检测",
  runtime_401: "运行时 401",
  credential_rotate: "凭据轮换",
};

const COLUMN_LABELS: Record<string, string> = {
  created_at: "时间",
  source: "来源",
  success: "结果",
  message: "说明",
  latency_ms: "延迟",
  tested_model: "模型",
};

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

function UpstreamErrorButton({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-primary hover:text-primary/80 shrink-0 whitespace-nowrap text-[10px] underline underline-offset-2"
        >
          上游原文
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-3">
        <pre className="text-muted-foreground max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
          {text}
        </pre>
      </PopoverContent>
    </Popover>
  );
}

function testLogColumns(): ColumnDef<ChannelTestLog, unknown>[] {
  return [
    {
      id: "created_at",
      accessorKey: "created_at",
      header: "时间",
      // 不设 size：走表格自动列宽，避免短列被默认 150px 撑开
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "source",
      accessorKey: "source",
      header: "来源",
      cell: ({ row }) => (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {sourceLabel(row.original.source)}
        </Badge>
      ),
    },
    {
      id: "success",
      accessorKey: "success",
      header: "结果",
      cell: ({ row }) => (
        <Badge
          variant={row.original.success ? "secondary" : "destructive"}
          className="h-5 px-1.5 text-[10px]"
        >
          {row.original.success ? "正常" : "异常"}
        </Badge>
      ),
    },
    {
      id: "message",
      accessorKey: "message",
      header: "说明",
      cell: ({ row }) => {
        const log = row.original;
        const text = log.success
          ? log.credential_valid_after
            ? "凭据有效"
            : ""
          : log.message || log.error_code || "异常";
        return (
          <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <span className="truncate">{text}</span>
            {log.upstream_error ? (
              <UpstreamErrorButton text={log.upstream_error} />
            ) : null}
          </div>
        );
      },
    },
    {
      id: "latency_ms",
      accessorKey: "latency_ms",
      header: "延迟",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs tabular-nums">
          {row.original.latency_ms > 0
            ? formatLatencySec(row.original.latency_ms)
            : "—"}
        </span>
      ),
    },
    {
      id: "tested_model",
      accessorKey: "tested_model",
      header: "模型",
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap text-xs">
          {row.original.tested_model || "—"}
        </span>
      ),
    },
  ];
}

/** 渠道检测/凭据事件日志（worker 巡检 / 手动检测 / 运行时 401 翻失效）。 */
export function ChannelTestLogs({ channelId }: { channelId: number }) {
  const { page, setPage } = useServerList({
    urlKey: `channel:${channelId}:test-logs`,
    pageSize: PAGE_SIZE,
  });
  const columns = useMemo(() => testLogColumns(), []);

  const q = useQuery({
    queryKey: ["channel", channelId, "test-logs", page],
    queryFn: () => getChannelTestLogs(channelId, { page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  if (q.isPending && !q.data) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (q.isError) {
    return (
      <p className="text-destructive text-sm">
        检测日志加载失败：{(q.error as Error).message}
      </p>
    );
  }

  if (total === 0) {
    return (
      <p className="text-muted-foreground rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
        暂无检测日志。自动巡检失败 / 状态变化，或手动检测后会记录在此。
      </p>
    );
  }

  return (
    <ServerDataTable
      storageKey={`channel:${channelId}:test-logs`}
      columns={columns}
      data={q.data?.items ?? []}
      columnLabels={COLUMN_LABELS}
      total={total}
      page={page}
      pageCount={pageCount}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      bordered={false}
      showViewOptions={false}
      refetching={q.isFetching && !q.isPending}
      getRowId={(row) => String(row.id)}
    />
  );
}
