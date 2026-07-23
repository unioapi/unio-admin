import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { archiveChannel, listChannels, type Channel } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import {
  archiveProvider,
  type ProviderStatusChangeResult,
} from "@/lib/api/providers";
import { getProviderOpsRouteCatalog } from "@/lib/api/providersOps";
import { getRoute, type Route } from "@/lib/api/routes";
import { getChannelOpsRoutes } from "@/lib/api/channelsOps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

type ArchiveTarget =
  | { kind: "channel"; id: number; name: string }
  | { kind: "provider"; id: number; name: string };

interface ArchiveImpact {
  referencingRoutes: Route[];
  emptiedRoutes: Route[];
}

async function loadArchiveImpact(target: ArchiveTarget): Promise<ArchiveImpact> {
  const references =
    target.kind === "channel"
      ? await getChannelOpsRoutes(target.id)
      : await getProviderOpsRouteCatalog(target.id);
  const enabledReferences = references.filter((route) => route.status === "enabled");
  const routes = await Promise.all(enabledReferences.map((route) => getRoute(route.id)));
  const emptiedRoutes = routes.filter((route) => {
    if (target.kind === "channel") {
      return (
        route.channels.some((channel) => channel.channel_id === target.id) &&
        route.channels.every((channel) => channel.channel_id === target.id)
      );
    }
    return (
      route.channels.length > 0 &&
      route.channels.every((channel) => channel.provider_id === target.id)
    );
  });
  return { referencingRoutes: routes, emptiedRoutes };
}

function replacementCandidates(channels: Channel[], target: ArchiveTarget): Channel[] {
  return channels
    .filter((channel) => {
      if (channel.status !== "enabled" || !channel.credential || !channel.base_url) return false;
      if (target.kind === "channel") return channel.id !== target.id;
      return channel.provider_id !== target.id;
    })
    .sort((a, b) => {
      const providerOrder = a.provider_name.localeCompare(b.provider_name);
      return providerOrder !== 0 ? providerOrder : a.name.localeCompare(b.name);
    });
}

export function ArchiveWithReplacementDialog({
  open,
  onOpenChange,
  target,
  onArchived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ArchiveTarget;
  onArchived: (result?: ProviderStatusChangeResult) => void;
}) {
  const [replacementId, setReplacementId] = useState("");

  const impactQuery = useQuery({
    queryKey: ["archive-impact", target.kind, target.id],
    queryFn: () => loadArchiveImpact(target),
    enabled: open,
  });
  const channelsQuery = useQuery({
    queryKey: ["channels", "archive-replacements", target.kind, target.id],
    queryFn: () => listChannels({ page: 1, pageSize: 100, status: "enabled" }),
    enabled: open,
  });

  const candidates = useMemo(
    () => replacementCandidates(channelsQuery.data?.items ?? [], target),
    [channelsQuery.data, target],
  );
  const needsReplacement = (impactQuery.data?.emptiedRoutes.length ?? 0) > 0;

  const mutation = useMutation({
    mutationFn: async (): Promise<ProviderStatusChangeResult | undefined> => {
      const replacement = needsReplacement ? Number(replacementId) : undefined;
      if (target.kind === "channel") {
        await archiveChannel(target.id, replacement);
        return undefined;
      }
      return archiveProvider(target.id, replacement);
    },
    onSuccess: (result) => {
      setReplacementId("");
      onOpenChange(false);
      onArchived(result);
    },
  });

  const loading = impactQuery.isPending || channelsQuery.isPending;
  const loadError = impactQuery.error ?? channelsQuery.error;
  const canSubmit =
    !loading &&
    !loadError &&
    !mutation.isPending &&
    (!needsReplacement || replacementId !== "");

  function handleOpenChange(next: boolean) {
    if (!next && mutation.isPending) return;
    if (!next && !mutation.isPending) {
      setReplacementId("");
      mutation.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" closeOnOutsideClick={false}>
        <DialogHeader>
          <DialogTitle>
            归档{target.kind === "channel" ? "渠道" : "服务商"}「{target.name}」
          </DialogTitle>
          <DialogDescription>
            {target.kind === "channel"
              ? "归档后该渠道会退出所有线路池，恢复时不会自动重新绑定。"
              : "归档后名下渠道会一并归档并退出所有线路池，恢复服务商时渠道不会自动恢复。"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-2 py-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertTitle>无法计算归档影响</AlertTitle>
            <AlertDescription>{apiErrorMessage(loadError)}</AlertDescription>
          </Alert>
        ) : impactQuery.data ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border px-3 py-2.5 text-sm">
              <div className="font-medium">
                影响 {impactQuery.data.referencingRoutes.length} 条启用线路
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                其中 {impactQuery.data.emptiedRoutes.length} 条会失去最后一个可绑定渠道
              </div>
            </div>

            {needsReplacement ? (
              <>
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>必须指定替代渠道</AlertTitle>
                  <AlertDescription>
                    下列启用线路会变成空池；替代、移除和归档将由后端在同一事务中完成。
                  </AlertDescription>
                </Alert>
                <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                  {impactQuery.data.emptiedRoutes.map((route) => (
                    <li key={route.id} className="flex items-center justify-between gap-3">
                      <Link to={`/routes/${route.id}`} className="truncate underline underline-offset-4">
                        {route.name}
                      </Link>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {route.mode === "fixed" ? "固定" : "均衡"}
                      </span>
                    </li>
                  ))}
                </ul>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">替代渠道</span>
                  <Select value={replacementId} onValueChange={setReplacementId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择启用且配置完整的渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((channel) => (
                        <SelectItem key={channel.id} value={String(channel.id)}>
                          {channel.provider_name} / {channel.name} · {channel.protocol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-xs">
                    后端会再次校验凭据、服务商状态和毛利；任一门禁失败都会整体回滚。
                  </span>
                </label>

                {candidates.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertTitle>没有可选替代渠道</AlertTitle>
                    <AlertDescription>
                      先创建并启用配置完整的外部渠道，或停用上述线路后再归档。
                    </AlertDescription>
                  </Alert>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                当前操作不会清空启用线路，可直接归档。
              </p>
            )}

            {mutation.isError ? (
              <Alert variant="destructive">
                <AlertTitle>归档未提交</AlertTitle>
                <AlertDescription>{apiErrorMessage(mutation.error)}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={mutation.isPending}>
              取消
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            {needsReplacement ? "替换并归档" : "确认归档"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
