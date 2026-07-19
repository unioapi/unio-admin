import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  restoreProvider,
  type Provider,
} from "@/lib/api/providers";
import { apiErrorMessage } from "@/lib/api/client";
import { ArchiveWithReplacementDialog } from "@/components/common/ArchiveWithReplacementDialog";
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
  const queryClient = useQueryClient();
  const archived = provider.status === "archived";

  const restoreMutation = useMutation({
    mutationFn: () => restoreProvider(provider.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success(`已恢复服务商「${provider.name}」为停用（名下渠道需单独恢复）`);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function openDialog(setter: (open: boolean) => void) {
    setMenuOpen(false);
    setter(true);
  }
  function runAndClose(fn: () => void) {
    setMenuOpen(false);
    fn();
  }

  return (
    <>
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
          <Link to={`/providers/${provider.id}`}>
            <EyeIcon />
          </Link>
        </Button>

        <HoverDropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <HoverDropdownMenuTrigger asChild onOpen={() => setMenuOpen(true)}>
            <Button variant="ghost" size="icon-sm" aria-label="更多">
              <EllipsisIcon />
            </Button>
          </HoverDropdownMenuTrigger>
          <HoverDropdownMenuContent align="end" className="min-w-32">
            <DropdownMenuItem onClick={() => openDialog(setEditOpen)}>编辑</DropdownMenuItem>
            {archived ? (
              <>
                <DropdownMenuItem onClick={() => runAndClose(() => restoreMutation.mutate())}>
                  恢复
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => openDialog(setDeleteOpen)}
                >
                  删除
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => openDialog(setArchiveOpen)}>
                归档
              </DropdownMenuItem>
            )}
          </HoverDropdownMenuContent>
        </HoverDropdownMenu>
      </div>

      <ProviderFormDialog provider={provider} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteProviderDialog provider={provider} open={deleteOpen} onOpenChange={setDeleteOpen} />
      <ArchiveWithReplacementDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        target={{ kind: "provider", id: provider.id, name: provider.name }}
        onArchived={() => {
          queryClient.invalidateQueries({ queryKey: ["providers"] });
          queryClient.invalidateQueries({ queryKey: ["channels"] });
          queryClient.invalidateQueries({ queryKey: ["routes"] });
          queryClient.invalidateQueries({ queryKey: ["route"] });
          toast.success(`已归档服务商「${provider.name}」，线路池替换已原子提交`);
        }}
      />
    </>
  );
}
