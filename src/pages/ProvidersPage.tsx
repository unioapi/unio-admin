import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from "nuqs";
import { Building2Icon, PlusIcon } from "lucide-react";
import { getProvidersOpsTable, type ProviderOpsRow } from "@/lib/api/providersOps";
import { sortingToApiSort } from "@/lib/api/list-params";
import { providerOsColumns } from "@/components/openstatus-table/providers-os-columns";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import { DataTable } from "@/components/tablecn/data-table";
import { DataTableSkeleton } from "@/components/tablecn/data-table-skeleton";
import { DataTableToolbar } from "@/components/tablecn/data-table-toolbar";
import { useDataTable } from "@/components/tablecn/hooks/use-data-table";
import { getSortingStateParser } from "@/components/tablecn/lib/parsers";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PAGE_SIZE = 20;
const DEFAULT_SORT = [{ id: "name", desc: false }] as const;

export function ProvidersPage() {
  const [searchParams] = useSearchParams();
  const defaultStatusApplied = useRef(false);
  const [page] = useQueryState("page", parseAsInteger.withDefault(1));
  const [perPage] = useQueryState(
    "perPage",
    parseAsInteger.withDefault(PAGE_SIZE),
  );
  const [sorting] = useQueryState(
    "sort",
    getSortingStateParser<ProviderOpsRow>().withDefault([...DEFAULT_SORT]),
  );
  const [statusFilter] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [nameFilter] = useQueryState("name", parseAsString.withDefault(""));

  // 首屏 URL 无 status 时按「启用」查；用户清空筛选后保持空（看全部）。
  const status =
    statusFilter[0] ??
    (!defaultStatusApplied.current && searchParams.get("status") === null
      ? "enabled"
      : "");
  const search = nameFilter.trim();
  const sort = sortingToApiSort(sorting);

  const columns = useMemo(() => providerOsColumns(), []);

  const query = useQuery({
    queryKey: [
      "providers",
      "tablecn",
      { status, search, page, perPage, sort },
    ],
    queryFn: () =>
      getProvidersOpsTable({
        range: "all",
        page,
        page_size: perPage,
        sort,
        status: status || undefined,
        search: search || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const { table } = useDataTable({
    data: items,
    columns,
    pageCount,
    initialState: {
      sorting: [...DEFAULT_SORT],
      pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
    },
    getRowId: (row) => String(row.id),
  });

  useEffect(() => {
    if (searchParams.get("status") === null && !defaultStatusApplied.current) {
      defaultStatusApplied.current = true;
      void table.getColumn("status")?.setFilterValue(["enabled"]);
    } else {
      defaultStatusApplied.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{(query.error as Error).message}</AlertDescription>
        </Alert>
      ) : query.isPending && items.length === 0 ? (
        <DataTableSkeleton columnCount={columns.length} rowCount={8} />
      ) : (
        <DataTable table={table} emptyMessage={<ProvidersEmpty />}>
          <DataTableToolbar
            table={table}
            leading={
              <ProviderFormDialog>
                <Button size="sm">
                  <PlusIcon data-icon="inline-start" />
                  新建服务商
                </Button>
              </ProviderFormDialog>
            }
          />
        </DataTable>
      )}
    </div>
  );
}

function ProvidersEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building2Icon />
        </EmptyMedia>
        <EmptyTitle>暂无服务商</EmptyTitle>
        <EmptyDescription>没有匹配当前筛选条件的服务商。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
