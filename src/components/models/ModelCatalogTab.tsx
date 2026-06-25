import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CloudDownloadIcon, LibraryIcon, SearchIcon } from "lucide-react";
import { listCatalog } from "@/lib/api/modelCatalog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { col } from "@/lib/table-columns";
import { AdoptFromCatalogDialog } from "@/components/models/AdoptFromCatalogDialog";
import { ModelCatalogSyncDialog } from "@/components/models/ModelCatalogSyncDialog";

const COLS = 6;
const PAGE_SIZE = 20;

/** models.dev 参考目录列表（运行时不读，用于采纳创建运营模型）。 */
export function ModelCatalogTab() {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(searchInput.trim(), 300);

  const query = useQuery({
    queryKey: ["model-catalog", { q: search, page }],
    queryFn: () => listCatalog({ page, pageSize: PAGE_SIZE, q: search }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (page > pageCount) {
    setPage(pageCount);
  }

  function changeSearch(next: string) {
    setSearchInput(next);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-muted-foreground text-xs">
            {query.isPending ? "加载中…" : `共 ${total} 条目录`}
            {search ? (
              <span className="text-foreground/80 ml-1">· 筛选「{search}」</span>
            ) : null}
          </div>
          <div className="flex w-full max-w-md flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <ModelCatalogSyncDialog>
              <Button variant="outline" size="sm">
                <CloudDownloadIcon data-icon="inline-start" />
                同步
              </Button>
            </ModelCatalogSyncDialog>
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                placeholder="搜索 canonical_id / 名称"
                value={searchInput}
                onChange={(e) => changeSearch(e.target.value)}
                className="bg-background pl-8"
              />
            </div>
          </div>
        </div>

        {query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table className={query.isFetching ? "opacity-60" : undefined}>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className={col.primaryLg}>模型</TableHead>
                    <TableHead className={`hidden ${col.vendor} sm:table-cell`}>厂商</TableHead>
                    <TableHead className={col.numSm}>能力</TableHead>
                    <TableHead className={col.numSm}>已采纳</TableHead>
                    <TableHead className={col.status}>状态</TableHead>
                    <TableHead className={col.actionLg}>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isPending ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={COLS}>
                          <Skeleton className="h-9 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLS} className="h-48">
                        <CatalogEmpty search={search} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((e) => (
                      <TableRow key={e.canonical_id}>
                        <TableCell>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">{e.display_name}</span>
                            <span className="text-muted-foreground truncate font-mono text-xs">
                              {e.canonical_id}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="font-normal">
                            {e.lab}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {e.capability_count}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {e.adopted_count > 0 ? (
                            <span className="font-medium">{e.adopted_count}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <CatalogStatusBadge
                            removed={e.removed_upstream}
                            adopted={e.adopted_count > 0}
                          />
                        </TableCell>
                        <TableCell >
                          <AdoptFromCatalogDialog entry={e}>
                            <Button variant="outline" size="sm">
                              采纳
                            </Button>
                          </AdoptFromCatalogDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

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

function CatalogStatusBadge({
  removed,
  adopted,
}: {
  removed: boolean;
  adopted: boolean;
}) {
  if (removed) {
    return <Badge variant="destructive">已下架</Badge>;
  }
  if (adopted) {
    return <Badge variant="secondary">已采纳</Badge>;
  }
  return <Badge variant="outline">未采纳</Badge>;
}

function CatalogEmpty({ search }: { search: string }) {
  if (search) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        没有匹配「{search}」的目录条目
      </p>
    );
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LibraryIcon />
        </EmptyMedia>
        <EmptyTitle>目录为空</EmptyTitle>
        <EmptyDescription>
          点击工具栏「同步」从 models.dev 拉取；历史任务见「系统 → 同步任务」。
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
