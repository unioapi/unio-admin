import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  rotateChannelCredential,
  type Channel,
  type RotateCredentialResult,
} from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import { HintLabel } from "@/components/common/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const [result, setResult] = useState<RotateCredentialResult>();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      rotateChannelCredential({ id: channel.id, credential: credential.trim() }),
    onSuccess: (saved) => {
      setCredential("");
      setResult(saved);
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      void queryClient.invalidateQueries({ queryKey: ["channel", channel.id] });
      toast.success("凭据已保存");
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
    setResult(undefined);
    mutation.mutate();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>修改 API Key</DialogTitle>
        <DialogDescription>
          为「{channel.name}」保存上游 API Key，并立即用当前 Endpoint 和模型执行验证。
        </DialogDescription>
      </DialogHeader>

      {result ? <CredentialResultAlert result={result} /> : null}

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
          <Button type="button" variant="outline" onClick={onDone}>
            {result ? "关闭" : "取消"}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mutation.isPending ? "保存并验证中..." : result ? "再次保存并验证" : "保存并验证"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

const VERIFICATION_COPY: Record<
  RotateCredentialResult["verification"]["state"],
  { title: string; description: string; destructive: boolean }
> = {
  passed: {
    title: "凭据已保存，验证通过",
    description: "当前配置版本的真实上游检测成功，渠道已恢复为可路由状态。",
    destructive: false,
  },
  failed: {
    title: "凭据已保存，验证未通过",
    description: "新凭据已经持久化，但渠道保持摘除，不会参与新请求路由。",
    destructive: true,
  },
  stale: {
    title: "凭据已保存，检测结果已过期",
    description: "验证期间 Endpoint 或渠道配置发生变化，本次结果没有覆盖当前状态。",
    destructive: true,
  },
  execution_failed: {
    title: "凭据已保存，验证未完成",
    description: "没有可测模型或检测编排失败，渠道保持摘除，需修复后重新验证。",
    destructive: true,
  },
  not_required: {
    title: "凭据未变化，无需检测",
    description: "数据库中的凭据与本次提交相同，且渠道当前凭据状态仍有效。",
    destructive: false,
  },
};

function CredentialResultAlert({ result }: { result: RotateCredentialResult }) {
  const copy = VERIFICATION_COPY[result.verification.state];
  return (
    <Alert variant={copy.destructive ? "destructive" : "default"}>
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>
        {copy.description} 保存版本 v{result.saved_config_revision}，当前版本 v
        {result.current_config_revision}。
      </AlertDescription>
    </Alert>
  );
}
