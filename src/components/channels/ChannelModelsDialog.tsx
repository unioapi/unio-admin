import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  createChannelModel,
  deleteChannelModel,
  listChannelModels,
  updateChannelModel,
  type ChannelModel,
} from "@/lib/api/channelModels";
import { listAllModels } from "@/lib/api/models";
import { type Channel } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ModelOption = { id: number; model_id: string; display_name: string };

// 受控弹窗：内容随 open 挂载/卸载。
export function ChannelModelsDialog({
  open,
  onOpenChange,
  channel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {open && <ChannelModelsManager channel={channel} />}
      </DialogContent>
    </Dialog>
  );
}

function ChannelModelsManager({ channel }: { channel: Channel }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const bindingsKey = ["channel-models", channel.id];

  const bindingsQuery = useQuery({
    queryKey: bindingsKey,
    queryFn: () => listChannelModels(channel.id),
  });

  const modelsQuery = useQuery({
    queryKey: ["models", "options", "enabled"],
    queryFn: () => listAllModels("enabled"),
  });

  const bindings = bindingsQuery.data ?? [];
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: bindingsKey });

  // 已绑定的模型从可选列表排除，避免触发唯一约束（409）。
  const boundModelIds = useMemo(
    () => new Set((bindingsQuery.data ?? []).map((b) => b.model_id)),
    [bindingsQuery.data],
  );
  const availableModels = (modelsQuery.data ?? []).filter(
    (m) => !boundModelIds.has(m.id),
  );
  const availableCount = availableModels.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DialogHeader className="shrink-0 px-4 pt-4 pr-12">
        <DialogTitle>管理模型</DialogTitle>
        <DialogDescription>
          为「{channel.name}」挂载可服务的模型，并设置转发到上游时使用的模型名。
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="text-muted-foreground text-xs font-medium">
            已绑定（{bindings.length}）
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={modelsQuery.isPending}
          >
            <PlusIcon data-icon="inline-start" />
            添加模型
            {!modelsQuery.isPending && availableCount > 0
              ? `（${availableCount}）`
              : ""}
          </Button>
        </div>

        {bindingsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{bindingsQuery.error.message}</AlertDescription>
          </Alert>
        ) : bindingsQuery.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : bindings.length === 0 ? (
          <p className="text-muted-foreground flex flex-1 items-center justify-center py-10 text-sm">
            还没有绑定任何模型，点右上角「添加模型」开始挂载
          </p>
        ) : (
          <ScrollArea className="min-h-0 flex-1 rounded-md border">
            <ul className="divide-border divide-y">
              {bindings.map((b) => (
                <BindingRow
                  key={b.id}
                  channelId={channel.id}
                  binding={b}
                  onChanged={invalidate}
                />
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>

      <AddModelsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        channelName={channel.name}
        channelId={channel.id}
        availableModels={availableModels}
        modelsLoading={modelsQuery.isPending}
        onAdded={invalidate}
      />
    </div>
  );
}

/** 批量添加模型的功能弹窗；随 open 挂载，关闭后勾选与搜索自动清空。 */
function AddModelsDialog({
  open,
  onOpenChange,
  channelName,
  channelId,
  availableModels,
  modelsLoading,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  channelId: number;
  availableModels: ModelOption[];
  modelsLoading: boolean;
  onAdded: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {open && (
          <AddModelsPanel
            channelName={channelName}
            channelId={channelId}
            availableModels={availableModels}
            modelsLoading={modelsLoading}
            onAdded={onAdded}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type BindDraft = { model: ModelOption; upstream: string };

function AddModelsPanel({
  channelName,
  channelId,
  availableModels,
  modelsLoading,
  onAdded,
  onClose,
}: {
  channelName: string;
  channelId: number;
  availableModels: ModelOption[];
  modelsLoading: boolean;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  // 勾选时默认写入 model_id，允许在添加前改成上游真实名。
  const [upstreamById, setUpstreamById] = useState<Record<number, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableModels;
    return availableModels.filter(
      (m) =>
        m.display_name.toLowerCase().includes(q) ||
        m.model_id.toLowerCase().includes(q),
    );
  }, [availableModels, query]);

  const selectedIds = useMemo(() => {
    const availableIds = new Set(availableModels.map((m) => m.id));
    return [...selected].filter((id) => availableIds.has(id));
  }, [availableModels, selected]);

  const selectedCount = selectedIds.length;
  const visibleIds = filtered.map((m) => m.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const mutation = useMutation({
    mutationFn: async (drafts: BindDraft[]) => {
      const results = await Promise.allSettled(
        drafts.map(({ model, upstream }) =>
          createChannelModel({
            channelId,
            model_id: model.id,
            upstream_model: upstream,
            status: "enabled",
          }),
        ),
      );
      let ok = 0;
      const errors: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          ok += 1;
        } else {
          const name = drafts[i]?.model.model_id ?? "?";
          errors.push(`${name}: ${apiErrorMessage(r.reason)}`);
        }
      });
      return { ok, fail: errors.length, errors };
    },
    onSuccess: ({ ok, fail, errors }) => {
      if (ok > 0) onAdded();
      setSelected(new Set());
      if (fail === 0) {
        toast.success(`已绑定 ${ok} 个模型`);
        onClose();
      } else if (ok === 0) {
        toast.error(`绑定失败：${errors[0] ?? "未知错误"}`);
      } else {
        toast.warning(`已绑定 ${ok} 个，失败 ${fail} 个`, {
          description: errors.slice(0, 3).join("；"),
        });
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function ensureUpstreamDefaults(models: ModelOption[]) {
    setUpstreamById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const m of models) {
        if (next[m.id] == null) {
          next[m.id] = m.model_id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  function toggle(id: number, next: boolean) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
    if (next) {
      const m = availableModels.find((x) => x.id === id);
      if (m) ensureUpstreamDefaults([m]);
    }
  }

  function selectAllVisible() {
    const toAdd = filtered.filter((m) => !selected.has(m.id));
    setSelected((prev) => {
      const s = new Set(prev);
      for (const id of visibleIds) s.add(id);
      return s;
    });
    if (toAdd.length > 0) ensureUpstreamDefaults(toAdd);
  }

  function handleAdd() {
    const drafts: BindDraft[] = [];
    for (const m of availableModels) {
      if (!selected.has(m.id)) continue;
      const upstream = (upstreamById[m.id] ?? m.model_id).trim();
      if (upstream === "") {
        toast.error(`「${m.display_name}」的上游模型名不能为空`);
        return;
      }
      drafts.push({ model: m, upstream });
    }
    if (drafts.length === 0) return;
    mutation.mutate(drafts);
  }

  return (
    <>
      <DialogHeader className="shrink-0 px-4 pt-4 pr-12">
        <DialogTitle>添加模型</DialogTitle>
        <DialogDescription>
          为「{channelName}」勾选未绑定模型并批量添加。勾选后可改上游模型名（默认
          model_id）。
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索未绑定模型…"
            disabled={modelsLoading}
            className="min-w-40 flex-1"
            aria-label="搜索未绑定模型"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={modelsLoading || visibleIds.length === 0 || allVisibleSelected}
            onClick={selectAllVisible}
          >
            全选可见
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={selectedCount === 0 || mutation.isPending}
            onClick={() => setSelected(new Set())}
          >
            清空
          </Button>
        </div>

        <ScrollArea className="h-[min(50vh,22rem)] rounded-md border">
          {modelsLoading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : availableModels.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              没有可绑定的模型
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              无匹配模型
            </p>
          ) : (
            <ul className="divide-border divide-y p-0">
              {filtered.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "flex flex-wrap items-center gap-2 px-2 py-1.5",
                      checked && "bg-muted/40",
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggle(m.id, v === true)}
                        aria-label={`选择 ${m.model_id}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {m.display_name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {m.model_id}
                        </span>
                      </span>
                    </label>
                    {checked ? (
                      <Input
                        value={upstreamById[m.id] ?? m.model_id}
                        onChange={(e) =>
                          setUpstreamById((prev) => ({
                            ...prev,
                            [m.id]: e.target.value,
                          }))
                        }
                        placeholder="上游模型名"
                        aria-label={`${m.model_id} 上游模型名`}
                        className="h-8 w-44 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {selectedCount > 0 ? (
          <p className="text-muted-foreground shrink-0 text-[11px]">
            已选 {selectedCount} 个 · 右侧可改上游模型名（默认 model_id）
          </p>
        ) : null}
      </div>

      {/* DialogFooter 自带 -mx-4，与 p-0 的 DialogContent 冲突会把按钮挤出边缘 */}
      <div className="bg-muted/50 flex shrink-0 justify-end gap-2 border-t p-4">
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          取消
        </Button>
        <Button
          type="button"
          disabled={selectedCount === 0 || mutation.isPending}
          onClick={handleAdd}
        >
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          {selectedCount > 0 ? `添加 ${selectedCount} 个` : "添加"}
        </Button>
      </div>
    </>
  );
}

type BindingPendingAction =
  | { type: "unbind" }
  | { type: "toggle"; next: "enabled" | "disabled" };

function BindingRow({
  channelId,
  binding,
  onChanged,
}: {
  channelId: number;
  binding: ChannelModel;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState(binding.upstream_model);
  const [pendingAction, setPendingAction] = useState<BindingPendingAction | null>(
    null,
  );

  const updateMutation = useMutation({
    mutationFn: (vars: { upstream_model: string; status: string }) =>
      updateChannelModel({
        channelId,
        modelId: binding.model_id,
        upstream_model: vars.upstream_model,
        status: vars.status,
      }),
    onSuccess: () => {
      setPendingAction(null);
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChannelModel(channelId, binding.model_id),
    onSuccess: () => {
      toast.success(`已移除「${binding.model_external_id}」`);
      setPendingAction(null);
      onChanged();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const enabled = binding.status === "enabled";
  const trimmed = draft.trim();
  const dirty = trimmed !== "" && trimmed !== binding.upstream_model;
  const busy = updateMutation.isPending || deleteMutation.isPending;
  const disabling = pendingAction?.type === "toggle" && pendingAction.next === "disabled";

  function confirmPending() {
    if (!pendingAction) return;
    if (pendingAction.type === "unbind") {
      deleteMutation.mutate();
    } else {
      updateMutation.mutate({
        upstream_model: binding.upstream_model,
        status: pendingAction.next,
      });
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-40 flex-1">
        <div className="font-medium">{binding.model_display_name}</div>
        <div className="text-muted-foreground text-xs">
          {binding.model_external_id}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="上游模型名"
          className="h-8 w-44"
        />
        {dirty && (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="保存上游模型名"
            disabled={busy}
            onClick={() =>
              updateMutation.mutate({
                upstream_model: trimmed,
                status: binding.status,
              })
            }
          >
            <CheckIcon />
          </Button>
        )}
      </div>

      <Switch
        checked={enabled}
        disabled={busy}
        onCheckedChange={(next) =>
          setPendingAction({ type: "toggle", next: next ? "enabled" : "disabled" })
        }
        aria-label={`切换 ${binding.model_external_id} 状态`}
      />

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="移除绑定"
        disabled={busy}
        onClick={() => setPendingAction({ type: "unbind" })}
      >
        <Trash2Icon className="text-destructive" />
      </Button>

      <ConfirmActionDialog
        open={pendingAction != null}
        onOpenChange={(o) => {
          if (!o && !busy) setPendingAction(null);
        }}
        title={
          pendingAction?.type === "unbind"
            ? "解绑模型"
            : disabling
              ? "停用绑定"
              : "启用绑定"
        }
        description={
          pendingAction?.type === "unbind"
            ? `确认解绑模型「${binding.model_external_id}」？解绑后该渠道将不再提供此模型，已配置的渠道-模型价不受影响。`
            : disabling
              ? `确认停用绑定「${binding.model_external_id}」？停用后该渠道暂停提供此模型，可随时重新启用。`
              : `确认启用绑定「${binding.model_external_id}」？启用后该渠道恢复提供此模型。`
        }
        confirmLabel={
          pendingAction?.type === "unbind"
            ? "确认解绑"
            : disabling
              ? "确认停用"
              : "确认启用"
        }
        destructive={pendingAction?.type === "unbind" || disabling}
        pending={busy}
        onConfirm={confirmPending}
      />
    </li>
  );
}
