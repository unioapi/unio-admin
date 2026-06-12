import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateApiKey, type ApiKey } from "@/lib/api/apiKeys";
import { apiErrorMessage } from "@/lib/api/client";
import { trimDecimal } from "@/lib/format";
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

// 设置/清除 API Key 费用上限（生命周期累计封顶）。
export function ApiKeySpendLimitDialog({
  apiKey,
  children,
}: {
  apiKey: ApiKey;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  const queryClient = useQueryClient();

  const mutation = useMutation({
    // 空串 = 清除上限（改为不限额）；否则设为该金额。
    mutationFn: () => updateApiKey({ id: apiKey.id, spendLimit: value.trim() }),
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", apiKey.project_id] });
      toast.success(
        key.spend_limit === null
          ? "已改为不限额"
          : `费用上限已设为 ${trimDecimal(key.spend_limit)}`,
      );
      setOpen(false);
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValue(apiKey.spend_limit ? trimDecimal(apiKey.spend_limit) : "");
      setError(undefined);
      mutation.reset();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed !== "" && !MONEY_PATTERN.test(trimmed)) {
      setError("需为非负金额，或留空表示不限额");
      return;
    }
    setError(undefined);
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>费用上限</DialogTitle>
          <DialogDescription>
            {apiKey.name} · 已累计花费 {trimDecimal(apiKey.spent_total)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="spend_limit">上限金额</FieldLabel>
              <Input
                id="spend_limit"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="留空表示不限额"
                inputMode="decimal"
                aria-invalid={!!error}
                autoFocus
              />
              <FieldError>{error}</FieldError>
              <FieldDescription>
                累计花费达到上限后该 Key 自动停用
              </FieldDescription>
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
              {mutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
