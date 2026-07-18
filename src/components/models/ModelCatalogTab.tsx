import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { CloudDownloadIcon, LibraryIcon } from "lucide-react";
import { listCatalog } from "@/lib/api/modelCatalog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable } from "@/components/openstatus-table";
import {
  MODEL_CATALOG_COLUMN_LABELS,
  modelCatalogColumns,
} from "@/components/detail-tables/model-catalog-columns";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ModelCatalogSyncDialog } from "@/components/models/ModelCatalogSyncDialog";

const PAGE_SIZE = 20;

/** models.dev 参考目录列表（运行时不读，用于采纳创建运营模型）。 */
export function ModelCatalogTab() {
  const { page, setPage, urlKeys } = useServerList({
    urlKey: "model-catalog",
    pageSize: PAGE_SIZE,
  });

  const [searchFromUrl, setSearchUrl] = useQueryState(
    urlKeys.q,
    parseAsString.withOptions({ history: "replace", shallow: true }).withDefault(""),
  );
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const search = useDebouncedValue(searchInput.trim(), 300);

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    const next = search || null;
    if ((searchFromUrl || "") !== (search || "")) {
      void setSearchUrl(next);
    }
  }, [search, searchFromUrl, setSearchUrl]);

  const query = useQuery({
    queryKey: ["model-catalog", { q: search, page }],
    queryFn: () => listCatalog({ page, pageSize: PAGE_SIZE, q: search }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const columns = useMemo(() => modelCatalogColumns(), []);

  function changeSearch(next: string) {
    setSearchInput(next);
    setPage(1);
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <ServerDataTable
      storageKey="model-catalog"
      columns={columns}
      data={items}
      columnLabels={MODEL_CATALOG_COLUMN_LABELS}
      total={total}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      loading={query.isPending && !query.data}
      refetching={query.isFetching && !query.isPending}
      searchValue={searchInput}
      onSearchChange={changeSearch}
      searchPlaceholder="搜索 canonical_id / 名称"
      pinnedColumnId="model"
      getRowId={(row) => row.canonical_id}
      emptyContent={<CatalogEmpty search={search} />}
      toolbarLeading={
        <span className="text-muted-foreground text-xs">
          {query.isPending ? "加载中…" : `共 ${total} 条参考模型`}
          {search ? (
            <span className="text-foreground/80 ml-1">· 筛选「{search}」</span>
          ) : null}
        </span>
      }
      toolbarActions={
        <ModelCatalogSyncDialog>
          <Button variant="outline" size="sm">
            <CloudDownloadIcon data-icon="inline-start" />
            同步
          </Button>
        </ModelCatalogSyncDialog>
      }
    />
  );
}

function CatalogEmpty({ search }: { search: string }) {
  if (search) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        没有匹配「{search}」的参考模型
      </p>
    );
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LibraryIcon />
        </EmptyMedia>
        <EmptyTitle>暂无参考模型</EmptyTitle>
        <EmptyDescription>
          点击工具栏「同步」从 models.dev 拉取；历史任务见「系统 → 同步任务」。
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
