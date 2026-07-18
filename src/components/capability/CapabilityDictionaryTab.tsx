import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import {
  createCapabilityKey,
  deleteCapabilityKey,
  listCapabilityKeys,
  updateCapabilityKey,
  type CapabilityKeyDef,
  type ProtocolScope,
} from "@/lib/api/capability";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/client";
import {
  PROTOCOL_SCOPE_ORDER,
  filterKeysByProtocolScope,
  normalizeProtocolScope,
  protocolScopeLabel,
  type ProtocolScopeFilter,
} from "@/lib/capability/protocolScope";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useServerList } from "@/hooks/useServerList";
import { ServerDataTable, FacetFilterButton } from "@/components/openstatus-table";
import {
  CAPABILITY_KEY_OS_COLUMN_LABELS,
  capabilityKeyOsColumns,
} from "@/components/openstatus-table/capability-keys-os-columns";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 20;

const PROTOCOL_SCOPE_OPTIONS = PROTOCOL_SCOPE_ORDER.map((value) => ({
  value,
  label: protocolScopeLabel(value),
}));

function compareCapabilityKeys(
  a: CapabilityKeyDef,
  b: CapabilityKeyDef,
  columnId: string,
  desc: boolean,
): number {
  let cmp: number;
  switch (columnId) {
    case "key":
      cmp = a.key.localeCompare(b.key);
      break;
    case "protocol_scope":
      cmp =
        PROTOCOL_SCOPE_ORDER.indexOf(normalizeProtocolScope(a.protocol_scope)) -
        PROTOCOL_SCOPE_ORDER.indexOf(normalizeProtocolScope(b.protocol_scope));
      break;
    case "domain":
      cmp = a.domain.localeCompare(b.domain);
      break;
    case "display_name":
      cmp = a.display_name.localeCompare(b.display_name);
      break;
    case "description":
      cmp = a.description.localeCompare(b.description);
      break;
    case "sort_order":
      cmp = a.sort_order - b.sort_order;
      break;
    default:
      cmp =
        a.sort_order - b.sort_order ||
        PROTOCOL_SCOPE_ORDER.indexOf(normalizeProtocolScope(a.protocol_scope)) -
          PROTOCOL_SCOPE_ORDER.indexOf(normalizeProtocolScope(b.protocol_scope)) ||
        a.key.localeCompare(b.key);
  }
  return desc ? -cmp : cmp;
}

export function CapabilityDictionaryTab() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CapabilityKeyDef | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CapabilityKeyDef | null>(null);

  const { page, setPage, sorting, setSorting, urlKeys } = useServerList({
    urlKey: "capability:dictionary",
    pageSize: PAGE_SIZE,
    defaultSort: { id: "sort_order", desc: false },
  });

  const scopeKey = urlKeys.scope;
  const [protocolScope, setProtocolScope] = useQueryState(
    scopeKey,
    parseAsString.withOptions({ history: "replace", shallow: true }).withDefault(""),
  );
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

  const keysQuery = useQuery({
    queryKey: ["capability-keys", "v2"],
    queryFn: listCapabilityKeys,
  });

  const filteredRows = useMemo(() => {
    let rows = keysQuery.data ?? [];
    if (protocolScope) {
      rows = filterKeysByProtocolScope(
        rows,
        protocolScope as ProtocolScopeFilter,
      );
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (row) =>
          row.key.toLowerCase().includes(q) ||
          row.domain.toLowerCase().includes(q) ||
          row.display_name.toLowerCase().includes(q) ||
          row.description.toLowerCase().includes(q),
      );
    }
    const sorted = [...rows];
    if (sorting.length > 0) {
      const { id, desc } = sorting[0]!;
      sorted.sort((a, b) => compareCapabilityKeys(a, b, id, desc));
    } else {
      sorted.sort((a, b) => compareCapabilityKeys(a, b, "sort_order", false));
    }
    return sorted;
  }, [keysQuery.data, protocolScope, search, sorting]);

  const total = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const items = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const deleteMutation = useMutation({
    mutationFn: deleteCapabilityKey,
    onSuccess: () => {
      toast.success("已删除能力 key");
      queryClient.invalidateQueries({ queryKey: ["capability-keys"] });
      setPendingDelete(null);
    },
    onError: (err) => {
      if (apiErrorStatus(err) === 409) {
        toast.error("该 key 已被模型引用，请改为标记 deprecated");
        return;
      }
      toast.error(apiErrorMessage(err));
    },
  });

  const columns = useMemo(
    () =>
      capabilityKeyOsColumns({
        onEdit: (row) => {
          setEditing(row);
          setFormOpen(true);
        },
        onDelete: (row) => setPendingDelete(row),
      }),
    [],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleFormOpenChange(open: boolean) {
    setFormOpen(open);
    if (!open) setEditing(null);
  }

  if (keysQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{apiErrorMessage(keysQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <ServerDataTable
        storageKey="capability:dictionary"
        columns={columns}
        data={items}
        columnLabels={CAPABILITY_KEY_OS_COLUMN_LABELS}
        total={total}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        sorting={sorting}
        onSortingChange={setSorting}
        getRowId={(row) => row.key}
        loading={keysQuery.isPending}
        refetching={keysQuery.isFetching && !keysQuery.isPending}
        emptyMessage="暂无能力 key"
        searchValue={searchInput}
        onSearchChange={(v) => {
          setSearchInput(v);
          setPage(1);
        }}
        searchPlaceholder="搜索 key / 展示名 / 描述"
        pinnedColumnId="key"
        toolbarLeading={
          <Button size="sm" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            新建 key
          </Button>
        }
        toolbarFilters={
          <FacetFilterButton
            label="协议归属"
            multiple={false}
            value={protocolScope ? [protocolScope] : []}
            options={PROTOCOL_SCOPE_OPTIONS}
            onChange={(v) => {
              void setProtocolScope(v[0] ?? null);
              setPage(1);
            }}
          />
        }
      />

      <CapabilityKeyFormDialog
        key={editing?.key ?? "new"}
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        editing={editing}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["capability-keys"] });
          setFormOpen(false);
        }}
      />

      <ConfirmActionDialog
        open={pendingDelete != null}
        onOpenChange={(o) => {
          if (!o && !deleteMutation.isPending) setPendingDelete(null);
        }}
        title="删除能力 key"
        description={
          pendingDelete
            ? `确认删除「${pendingDelete.key}」？若已被模型引用将无法删除，请改为标记 deprecated。`
            : undefined
        }
        confirmLabel="确认删除"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.key);
        }}
      />
    </>
  );
}

function CapabilityKeyFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CapabilityKeyDef | null;
  onSaved: () => void;
}) {
  const isEdit = editing != null;
  const [key, setKey] = useState(editing?.key ?? "");
  const [domain, setDomain] = useState(editing?.domain ?? "");
  const [displayName, setDisplayName] = useState(editing?.display_name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(editing?.sort_order ?? 0));
  const [deprecated, setDeprecated] = useState(editing?.deprecated ? "true" : "false");
  const [protocolScope, setProtocolScope] = useState<ProtocolScope>(
    editing?.protocol_scope === "both" || !editing
      ? "shared"
      : editing.protocol_scope,
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const sort = Number.parseInt(sortOrder, 10) || 0;
      const body = {
        domain: domain.trim(),
        display_name: displayName.trim(),
        description: description.trim(),
        sort_order: sort,
        deprecated: deprecated === "true",
        protocol_scope: protocolScope,
      };
      if (isEdit) {
        return updateCapabilityKey(editing!.key, body);
      }
      return createCapabilityKey({ key: key.trim(), ...body });
    },
    onSuccess: () => {
      toast.success(isEdit ? "已更新" : "已创建");
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑能力 key" : "新建能力 key"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">key</label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={isEdit}
              placeholder="tools.function"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">domain</label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">协议归属</label>
              <Select
                value={protocolScope}
                onValueChange={(v) => setProtocolScope(v as ProtocolScope)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOL_SCOPE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {protocolScopeLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">展示名</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">中文描述</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">排序</label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">deprecated</label>
              <Select value={deprecated} onValueChange={setDeprecated}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">否</SelectItem>
                  <SelectItem value="true">是</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
