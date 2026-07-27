import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  archiveProvider,
  restoreProvider,
  updateProviderStatus,
  type Provider,
} from "@/lib/api/providers";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/client";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { DeleteProviderDialog } from "@/components/providers/DeleteProviderDialog";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  HoverDropdownMenu,
  HoverDropdownMenuContent,
  HoverDropdownMenuTrigger,
} from "@/components/ui/hover-dropdown-menu";

export function ProviderRowActions({ provider }: { provider: Provider }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const queryClient = useQueryClient();
  const archived = provider.status === "archived";

  function refreshProviderFacts() {
    queryClient.invalidateQueries({ queryKey: ["providers"] });
    queryClient.invalidateQueries({ queryKey: ["channels"] });
    queryClient.invalidateQueries({ queryKey: ["provider", provider.id, "runtime"] });
  }

  const restore = useMutation({
    mutationFn: () => restoreProvider(provider.id),
    onSuccess: (result) => {
      refreshProviderFacts();
      toast.success(result.runtime_sync_pending
        ? "已恢复，运行态同步中"
        : `已恢复服务商「${provider.name}」为停用`);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });
  const status = useMutation({
    mutationFn: () => updateProviderStatus({
      id: provider.id,
      status: provider.status === "enabled" ? "disabled" : "enabled",
      expected_status_revision: provider.status_revision,
    }),
    onSuccess: (saved) => {
      refreshProviderFacts();
      setStatusOpen(false);
      toast.success(saved.runtime_sync_pending ? "状态已保存，运行态同步中" : "服务商状态已更新");
    },
    onError: (error) => {
      setStatusOpen(false);
      if (apiErrorStatus(error) === 409) {
        toast.error("停用 Provider 前必须先停用其启用渠道；请按 Route → Channel → Provider 顺序处理依赖。");
        return;
      }
      toast.error(apiErrorMessage(error));
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveProvider(provider.id),
    onSuccess: (result) => {
      refreshProviderFacts();
      setArchiveOpen(false);
      toast.success(result.runtime_sync_pending ? "已归档，运行态同步中" : "服务商已归档");
    },
    onError: (error) => {
      setArchiveOpen(false);
      if (apiErrorStatus(error) === 409) {
        toast.error("归档 Provider 前需先从 Route 移除渠道、归档全部 Channel，并等待运行态操作终结。");
        return;
      }
      toast.error(apiErrorMessage(error));
    },
  });

  function openDialog(setter: (open: boolean) => void) {
    setMenuOpen(false);
    setter(true);
  }

  return (
    <>
      <div className="flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
        <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
          <Link to={`/providers/${provider.id}`}><EyeIcon /></Link>
        </Button>
        <HoverDropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <HoverDropdownMenuTrigger asChild onOpen={() => setMenuOpen(true)}>
            <Button variant="ghost" size="icon-sm" aria-label="更多"><EllipsisIcon /></Button>
          </HoverDropdownMenuTrigger>
          <HoverDropdownMenuContent align="end" className="min-w-36">
            {archived ? (
              <>
                <DropdownMenuItem onClick={() => { setMenuOpen(false); restore.mutate(); }}>恢复</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openDialog(setDeleteOpen)}>
                  删除
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => openDialog(setEditOpen)}>编辑资料</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog(setStatusOpen)}>
                  {provider.status === "enabled" ? "停用" : "启用"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog(setArchiveOpen)}>归档</DropdownMenuItem>
              </>
            )}
          </HoverDropdownMenuContent>
        </HoverDropdownMenu>
      </div>

      <ProviderFormDialog provider={provider} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteProviderDialog provider={provider} open={deleteOpen} onOpenChange={setDeleteOpen} />
      <ConfirmActionDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title={`${provider.status === "enabled" ? "停用" : "启用"}服务商`}
        description={provider.status === "enabled"
          ? "停用不会级联渠道；存在启用渠道时后端将返回 409。"
          : "启用后只有已启用渠道会参与路由。"}
        confirmLabel="确认"
        pending={status.isPending}
        onConfirm={() => status.mutate()}
      />
      <ConfirmActionDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="归档服务商"
        description="归档不会级联 Channel，也不会修改 Route。请先完成 Route → Channel 的依赖清理。"
        confirmLabel="确认归档"
        destructive
        pending={archive.isPending}
        onConfirm={() => archive.mutate()}
      />
    </>
  );
}
