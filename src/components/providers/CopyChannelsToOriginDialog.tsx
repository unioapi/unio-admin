import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import {
  duplicateChannel,
  listChannels,
  type Channel,
} from "@/lib/api/channels";
import type { ProviderOrigin } from "@/lib/api/providerOrigins";
import { apiErrorMessage } from "@/lib/api/client";
import { defaultDuplicateChannelName } from "@/components/channels/DuplicateChannelDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * 源站侧「复制渠道」：从同服务商其他源站勾选渠道，整份复制到本源站。
 */
export function CopyChannelsToOriginDialog({
  targetOrigin,
}: {
  targetOrigin: ProviderOrigin;
}) {
  const [open, setOpen] = useState(false);
  const archived = targetOrigin.status === "archived";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`复制渠道到 ${targetOrigin.name}`}
          title={
            archived
              ? "已归档源站不能接收复制"
              : "复制渠道"
          }
          disabled={archived}
        >
          <CopyIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open ? (
          <CopyChannelsForm
            targetOrigin={targetOrigin}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CopyChannelsForm({
  targetOrigin,
  onDone,
}: {
  targetOrigin: ProviderOrigin;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const channelsQ = useQuery({
    queryKey: [
      "channels",
      "copy-to-origin",
      targetOrigin.provider_id,
      targetOrigin.id,
    ],
    queryFn: () =>
      listChannels({
        providerId: targetOrigin.provider_id,
        page: 1,
        pageSize: 100,
      }),
  });

  const candidates = useMemo(() => {
    const items = channelsQ.data?.items ?? [];
    return items
      .filter(
        (c) =>
          c.provider_origin_id !== targetOrigin.id &&
          c.status !== "archived",
      )
      .sort((a, b) => {
        const byOrigin = a.provider_origin_name.localeCompare(
          b.provider_origin_name,
        );
        return byOrigin !== 0 ? byOrigin : a.name.localeCompare(b.name);
      });
  }, [channelsQ.data?.items, targetOrigin.id]);

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(candidates.map((c) => c.id)) : new Set());
  }

  const mutation = useMutation({
    mutationFn: async (channels: Channel[]) => {
      const results: Channel[] = [];
      const errors: string[] = [];
      for (const ch of channels) {
        try {
          const created = await duplicateChannel({
            id: ch.id,
            provider_origin_id: targetOrigin.id,
            name: defaultDuplicateChannelName(ch.name, targetOrigin.name),
          });
          results.push(created);
        } catch (err) {
          errors.push(`${ch.name}：${apiErrorMessage(err)}`);
        }
      }
      return { results, errors };
    },
    onSuccess: ({ results, errors }) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["provider-origins"] });
      if (results.length > 0) {
        toast.success(`已复制 ${results.length} 条渠道到「${targetOrigin.name}」`);
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join("；"));
      }
      if (errors.length === 0) onDone();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const selectedCount = selected.size;
  const allChecked =
    candidates.length > 0 && selectedCount === candidates.length;

  function handleCopy() {
    const channels = candidates.filter((c) => selected.has(c.id));
    if (channels.length === 0) return;
    mutation.mutate(channels);
  }

  return (
    <>
      <div className="p-4 pb-0">
        <DialogHeader>
          <DialogTitle>复制渠道</DialogTitle>
          <DialogDescription>
            从同服务商其他源站勾选渠道，整份复制到「{targetOrigin.name}」（含凭据与当前生效配置）。副本名默认为「原名@{targetOrigin.name}」。
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
        {channelsQ.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Spinner data-icon="inline-start" />
            加载渠道…
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            没有可复制的渠道（其他源站上需有未归档渠道）。
          </p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(v) => toggleAll(v === true)}
                aria-label="全选"
              />
              <span className="text-muted-foreground">
                全选（{candidates.length}）
              </span>
            </label>
            <ScrollArea className="h-64 rounded-md border">
              <ul className="divide-border divide-y p-0">
                {candidates.map((c) => {
                  const checked = selected.has(c.id);
                  return (
                    <li
                      key={c.id}
                      className={cn(
                        "px-2 py-1.5",
                        checked && "bg-muted/40",
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggle(c.id, v === true)}
                          aria-label={`选择 ${c.name}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {c.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {c.provider_origin_name} · {c.status}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </>
        )}
      </div>

      <div className="bg-muted/50 flex shrink-0 justify-end gap-2 border-t p-4">
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={mutation.isPending}>
            取消
          </Button>
        </DialogClose>
        <Button
          type="button"
          disabled={selectedCount === 0 || mutation.isPending}
          onClick={handleCopy}
        >
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          {selectedCount > 0 ? `复制 ${selectedCount} 条` : "复制"}
        </Button>
      </div>
    </>
  );
}
