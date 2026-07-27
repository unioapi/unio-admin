import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  deleteChannel,
  getChannel,
  archiveChannel,
  restoreChannel,
  updateChannel,
} from "@/lib/api/channels";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/client";
import { StatusChangeConfirmDialog } from "@/components/common/StatusChangeConfirmDialog";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { ChannelFormDialog } from "@/components/channels/ChannelFormDialog";
import { ChannelModelsDialog } from "@/components/channels/ChannelModelsDialog";
import { ChannelTestDialog } from "@/components/channels/ChannelTestDialog";
import { ChannelPricesDialog } from "@/components/channels/ChannelPricesDialog";
import { ChannelCostMultiplierDialog } from "@/components/channels/ChannelCostMultiplierDialog";
import { RotateCredentialDialog } from "@/components/channels/RotateCredentialDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  HoverDropdownMenu,
  HoverDropdownMenuContent,
  HoverDropdownMenuTrigger,
} from "@/components/ui/hover-dropdown-menu";

export function ChannelRowActions({ channelId }: { channelId: number }) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [costMultOpen, setCostMultOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const needChannel =
    editOpen ||
    modelsOpen ||
    pricesOpen ||
    costMultOpen ||
    credOpen ||
    testOpen ||
    archiveOpen ||
    menuOpen ||
    statusConfirmOpen;
  const channelQ = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => getChannel(channelId),
    enabled: needChannel,
  });

  const channel = channelQ.data;

  const statusMutation = useMutation({
    mutationFn: updateChannel,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["channel", channelId] });
      toast.success(vars.status === "enabled" ? "已启用" : "已停用");
      setStatusConfirmOpen(false);
    },
    onError: (err) => {
      if (apiErrorStatus(err) === 409) {
        toast.error("Channel 状态与 Provider 不一致；请先启用 Provider，或按 Route → Channel → Provider 顺序处理依赖。");
        return;
      }
      toast.error(apiErrorMessage(err));
    },
  });

  const archived = channel?.status === "archived";
  const lifecycleMutation = useMutation({
    mutationFn: (action: "restore" | "delete" | "archive") => {
      if (action === "restore") return restoreChannel(channelId);
      if (action === "archive") return archiveChannel(channelId);
      return deleteChannel(channelId);
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["channel", channelId] });
      toast.success(
        action === "restore"
          ? "已恢复渠道为停用（如需路由请重新加入线路并启用）"
          : action === "archive"
            ? "已归档渠道"
          : "已删除渠道",
      );
      if (action === "archive") setArchiveOpen(false);
    },
    onError: (err) => {
      if (apiErrorStatus(err) === 409) {
        toast.error("该 Channel 仍在 Route 池中；请先从所有 Route 移除，再归档 Channel，最后处理 Provider。");
        return;
      }
      toast.error(apiErrorMessage(err));
    },
  });

  function openDialog(setter: (open: boolean) => void) {
    setMenuOpen(false);
    setter(true);
  }
  function runLifecycle(action: "restore" | "delete" | "archive") {
    setMenuOpen(false);
    lifecycleMutation.mutate(action);
  }

  function requestStatusChange() {
    if (!channel) return;
    setMenuOpen(false);
    setStatusConfirmOpen(true);
  }

  function confirmStatusChange() {
    if (!channel) return;
    const enabling = channel.status !== "enabled";
    statusMutation.mutate({
      id: channel.id,
      name: channel.name,
      provider_id: channel.provider_id,
      status: enabling ? "enabled" : "disabled",
      priority: channel.priority,
      timeout_ms: channel.timeout_ms,
    });
  }

  return (
    <>
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
          <Link to={`/channels/${channelId}`}>
            <EyeIcon />
          </Link>
        </Button>

        <HoverDropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <HoverDropdownMenuTrigger asChild onOpen={() => setMenuOpen(true)}>
            <Button variant="ghost" size="icon-sm" aria-label="更多">
              <EllipsisIcon />
            </Button>
          </HoverDropdownMenuTrigger>
          <HoverDropdownMenuContent align="end" className="min-w-36">
            {archived ? (
              <>
                <DropdownMenuItem disabled={!channel} onClick={() => runLifecycle("restore")}>
                  恢复
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={!channel}
                  onClick={() => runLifecycle("delete")}
                >
                  删除
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => openDialog(setTestOpen)}>检测</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog(setEditOpen)}>编辑</DropdownMenuItem>
                <DropdownMenuItem disabled={!channel} onClick={requestStatusChange}>
                  {channel?.status === "enabled" ? "停用" : "启用"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog(setModelsOpen)}>管理模型</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog(setCostMultOpen)}>成本倍率</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog(setPricesOpen)}>成本覆盖</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDialog(setCredOpen)}>修改APIKey</DropdownMenuItem>
                <DropdownMenuItem disabled={!channel} onClick={() => openDialog(setArchiveOpen)}>
                  归档
                </DropdownMenuItem>
              </>
            )}
          </HoverDropdownMenuContent>
        </HoverDropdownMenu>
      </div>

      {channel ? (
        <>
          <ChannelFormDialog open={editOpen} onOpenChange={setEditOpen} channel={channel} />
          <ChannelTestDialog open={testOpen} onOpenChange={setTestOpen} channel={channel} />
          <ChannelModelsDialog open={modelsOpen} onOpenChange={setModelsOpen} channel={channel} />
          <ChannelPricesDialog open={pricesOpen} onOpenChange={setPricesOpen} channel={channel} />
          <ChannelCostMultiplierDialog open={costMultOpen} onOpenChange={setCostMultOpen} channel={channel} />
          <RotateCredentialDialog open={credOpen} onOpenChange={setCredOpen} channel={channel} />
          <StatusChangeConfirmDialog
            open={statusConfirmOpen}
            onOpenChange={setStatusConfirmOpen}
            entityLabel="渠道"
            entityName={channel.name}
            enabling={channel.status !== "enabled"}
            pending={statusMutation.isPending}
            onConfirm={confirmStatusChange}
          />
          <ConfirmActionDialog
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            title="归档渠道"
            description="归档不会自动修改 Route；Channel 仍在任意 Route 池中时后端将返回 409。"
            confirmLabel="确认归档"
            destructive
            pending={lifecycleMutation.isPending}
            onConfirm={() => runLifecycle("archive")}
          />
        </>
      ) : null}
    </>
  );
}
