import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteProvider, type Provider } from "@/lib/api/providers";
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
  DialogTrigger,
} from "@/components/ui/dialog";

// 删除服务商确认弹窗：用于清理录错的脏数据。删除是物理删除，slug 随之释放可重录同名。
// 名下仍有渠道或已被请求/账务历史引用时，后端返回 409，这里给出中文引导（先删渠道或改用停用）。
export function DeleteProviderDialog({
  provider,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  provider: Provider;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteProvider(provider.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success(`已删除服务商「${provider.name}」`);
      setOpen(false);
    },
    onError: (err) => {
      if (apiErrorStatus(err) === 409) {
        toast.error(
          "该服务商名下仍有渠道，或已被请求/账务历史引用，无法删除。请先删除其下渠道，或改为「停用」。",
        );
        return;
      }
      toast.error(apiErrorMessage(err));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除服务商</DialogTitle>
          <DialogDescription>
            将永久删除「{provider.name}」（{provider.slug}）。仅用于清理录错的数据；
            若该服务商已被使用，请改用「停用」。此操作不可逆。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mutation.isPending ? "删除中..." : "确认删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
