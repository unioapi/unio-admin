import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  archiveRoute,
  listRoutes,
  type EmptyRouteWarning,
} from "@/lib/api/routes";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

// 归档线路弹窗（§4B）：线路无绑定 Key 时直接归档；若后端返回 409（仍有 Key），切到「迁移并归档」模式，
// 要求选择目标线路（enabled、非自身），再一次事务内迁移全部 Key + 归档。
export function ArchiveRouteDialog({
  routeId,
  routeName,
  open,
  onOpenChange,
}: {
  routeId: number;
  routeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [needMigrate, setNeedMigrate] = useState(false);
  const [targetId, setTargetId] = useState<string>("");

  const routesQ = useQuery({
    queryKey: ["routes"],
    queryFn: listRoutes,
    enabled: open,
  });
  const targets = (routesQ.data ?? []).filter(
    (r) => r.id !== routeId && r.status === "enabled",
  );

  const mutation = useMutation({
    mutationFn: (migrateTo?: number) => archiveRoute(routeId, migrateTo),
    onSuccess: (warnings: EmptyRouteWarning[]) => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["route", routeId] });
      toast.success(`已归档线路「${routeName}」`);
      for (const w of warnings) {
        toast.warning(`线路「${w.name}」候选池已空但仍有 ${w.key_count} 个 Key，请尽快处理`);
      }
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      // 409 = 线路仍绑定 Key 且未指定迁移目标：切到迁移模式。
      if (apiErrorStatus(err) === 409 && !needMigrate) {
        setNeedMigrate(true);
        return;
      }
      toast.error(apiErrorMessage(err));
    },
  });

  function reset() {
    setNeedMigrate(false);
    setTargetId("");
  }

  function handleConfirm() {
    if (needMigrate) {
      if (!targetId) {
        toast.error("请选择迁移目标线路");
        return;
      }
      mutation.mutate(Number(targetId));
      return;
    }
    mutation.mutate(undefined);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && mutation.isPending) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>归档线路</DialogTitle>
          <DialogDescription>
            {needMigrate
              ? `线路「${routeName}」仍绑定了 API Key，需先把这些 Key 迁移到另一条线路，再归档。`
              : `将归档线路「${routeName}」（默认隐藏、不再参与路由，可随时恢复）。线路名将追加归档后缀以释放原名。`}
          </DialogDescription>
        </DialogHeader>

        {needMigrate ? (
          <div className="flex flex-col gap-2">
            <label className="text-muted-foreground text-sm">迁移目标线路（仅列启用中的其他线路）</label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标线路" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targets.length === 0 && (
              <p className="text-destructive text-xs">没有可迁移的启用中线路，请先新建/启用一条线路。</p>
            )}
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
            variant={needMigrate ? "default" : "destructive"}
            disabled={mutation.isPending || (needMigrate && !targetId)}
            onClick={handleConfirm}
          >
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {needMigrate ? "迁移并归档" : "确认归档"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
