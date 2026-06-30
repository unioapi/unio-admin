import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";

// 把页码压缩成 [1, …, 4,5,6, …, 20] 这种带省略号的形式。
function pageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | "gap")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("gap");
  items.push(total);
  return items;
}

// 服务端/客户端分页底栏：左侧条数/页码文案，右侧页码控件（单页时也展示，按钮禁用）。
export function TablePagination({
  page,
  pageCount,
  total,
  onPageChange,
  pageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground text-sm tabular-nums">
        共 {total} 条 · 第 {page}/{pageCount} 页
        {pageSize != null ? ` · 每页 ${pageSize} 条` : null}
      </span>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              上一页
            </Button>
          </PaginationItem>

          {pageCount > 1
            ? pageItems(page, pageCount).map((it, i) =>
                it === "gap" ? (
                  <PaginationItem key={`gap-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={it}>
                    <Button
                      variant={it === page ? "outline" : "ghost"}
                      size="icon-sm"
                      className="tabular-nums"
                      onClick={() => onPageChange(it)}
                    >
                      {it}
                    </Button>
                  </PaginationItem>
                ),
              )
            : null}

          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              下一页
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
