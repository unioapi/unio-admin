import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { rotateChannelCredential, type Channel } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import { HintLabel } from "@/components/common/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Field, FieldError } from "@/components/ui/field";

// 受控弹窗：内层表单随 open 挂载/卸载，重新打开自动清空上次输入。
export function RotateCredentialDialog({
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
      <DialogContent>
        {open && (
          <RotateForm channel={channel} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RotateForm({
  channel,
  onDone,
}: {
  channel: Channel;
  onDone: () => void;
}) {
  const [credential, setCredential] = useState("");
  const [error, setError] = useState<string>();

  const mutation = useMutation({
    mutationFn: () =>
      rotateChannelCredential({ id: channel.id, credential: credential.trim() }),
    onSuccess: () => {
      toast.success(`已更新「${channel.name}」的 API Key`);
      onDone();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (credential.trim() === "") {
      setError("凭据不能为空");
      return;
    }
    setError(undefined);
    mutation.mutate();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>修改 API Key</DialogTitle>
        <DialogDescription>
          为「{channel.name}」写入新的上游 API Key；保存后立即生效，可在列表或详情查看/复制。
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <Field data-invalid={!!error}>
          <HintLabel
            htmlFor="new_credential"
            hint="调用上游用的新 API Key；明文存储，保存后立即生效，可在列表或详情查看/复制。"
          >
            新 API Key
          </HintLabel>
          <Input
            id="new_credential"
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="sk-..."
            aria-invalid={!!error}
            autoComplete="off"
            autoFocus
          />
          <FieldError>{error}</FieldError>
        </Field>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mutation.isPending ? "提交中..." : "保存"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
