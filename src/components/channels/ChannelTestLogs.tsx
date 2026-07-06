import { Fragment, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getChannelTestLogs } from "@/lib/api/channelsOps";
import { formatDateTime, formatLatencySec } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

const SOURCE_LABEL: Record<string, string> = {
  worker: "自动巡检",
  manual: "手动检测",
  runtime_401: "运行时 401",
};

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

/** 渠道检测/凭据事件日志（worker 巡检 / 手动检测 / 运行时 401 翻失效）。 */
export function ChannelTestLogs({ channelId }: { channelId: number }) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  const q = useQuery({
    queryKey: ["channel", channelId, "test-logs", page],
    queryFn: () => getChannelTestLogs(channelId, { page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
        暂无检测日志。自动巡检失败 / 状态变化，或手动检测后会记录在此。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>结果</TableHead>
              <TableHead>说明</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead>模型</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((log) => {
              const isOpen = expanded.has(log.id);
              return (
                <Fragment key={log.id}>
                  <TableRow>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {sourceLabel(log.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.success ? "secondary" : "destructive"}
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {log.success ? "正常" : "异常"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[280px] text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">
                          {log.success
                            ? log.credential_valid_after
                              ? "凭据有效"
                              : ""
                            : log.message || log.error_code || "异常"}
                        </span>
                        {log.upstream_error ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(log.id)}
                            className="text-primary hover:text-primary/80 shrink-0 whitespace-nowrap text-[10px] underline underline-offset-2"
                          >
                            {isOpen ? "收起原文" : "上游原文"}
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {log.latency_ms > 0 ? formatLatencySec(log.latency_ms) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.tested_model || "—"}
                    </TableCell>
                  </TableRow>
                  {isOpen && log.upstream_error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <pre className="text-muted-foreground max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                          {log.upstream_error}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs">
          <span className="text-muted-foreground">
            第 {page}/{pageCount} 页 · 共 {total} 条
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      ) : null}
    </div>
  );
}
