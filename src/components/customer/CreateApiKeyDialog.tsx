import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import {
  createApiKey,
  type CreatedApiKey,
} from "@/lib/api/apiKeys";
import { apiErrorMessage } from "@/lib/api/client";
import { localToRFC3339 } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const MONEY_PATTERN = /^\d+(\.\d+)?$/;

interface FieldErrors {
  name?: string;
  spendLimit?: string;
}

// 创建 API Key 弹窗：成功后切到「明文展示」态，明文只展示这一次。
export function CreateApiKeyDialog({
  projectId,
  children,
}: {
  projectId: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [spendLimit, setSpendLimit] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createApiKey({
        projectId,
        name: name.trim(),
        expiresAt: expiresLocal ? localToRFC3339(expiresLocal) : undefined,
        spendLimit: spendLimit.trim() || undefined,
      }),
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
      setCreated(key);
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName("");
      setExpiresLocal("");
      setSpendLimit("");
      setErrors({});
      setCreated(null);
      mutation.reset();
    }
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (name.trim() === "") {
      next.name = "名称不能为空";
    }
    if (spendLimit.trim() !== "" && !MONEY_PATTERN.test(spendLimit.trim())) {
      next.spendLimit = "需为非负金额";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  async function copyPlaintext() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintext);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择复制");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>API Key 已创建</DialogTitle>
              <DialogDescription>
                明文只展示这一次，请立即复制并妥善保存。
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>关闭后将无法再次查看完整明文</AlertTitle>
              <AlertDescription>仅保留前缀 {created.key_prefix} 用于识别。</AlertDescription>
            </Alert>

            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 truncate rounded-md px-3 py-2 font-mono text-sm">
                {created.plaintext}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="复制"
                onClick={copyPlaintext}
              >
                <CopyIcon />
              </Button>
            </div>

            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button type="button">完成</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>新建 API Key</DialogTitle>
              <DialogDescription>
                费用上限为生命周期累计封顶，达到后该 Key 自动停用。
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="key_name">名称</FieldLabel>
                  <Input
                    id="key_name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：生产环境"
                    aria-invalid={!!errors.name}
                    autoFocus
                  />
                  <FieldError>{errors.name}</FieldError>
                </Field>

                <Field data-invalid={!!errors.spendLimit}>
                  <FieldLabel htmlFor="key_spend_limit">费用上限</FieldLabel>
                  <Input
                    id="key_spend_limit"
                    value={spendLimit}
                    onChange={(e) => setSpendLimit(e.target.value)}
                    placeholder="留空表示不限额"
                    inputMode="decimal"
                    aria-invalid={!!errors.spendLimit}
                  />
                  <FieldError>{errors.spendLimit}</FieldError>
                  <FieldDescription>累计花费达到上限后自动停用</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="key_expires">过期时间</FieldLabel>
                  <Input
                    id="key_expires"
                    type="datetime-local"
                    value={expiresLocal}
                    onChange={(e) => setExpiresLocal(e.target.value)}
                  />
                  <FieldDescription>留空表示永不过期</FieldDescription>
                </Field>
              </FieldGroup>

              <DialogFooter className="mt-6">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    取消
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Spinner data-icon="inline-start" />}
                  {mutation.isPending ? "创建中..." : "创建"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
