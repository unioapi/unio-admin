import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adjustProviderBalance } from "@/lib/api/providerBalance";
import type { ProviderBalanceStatus } from "@/lib/api/providersOps";
import { apiErrorMessage } from "@/lib/api/client";
import { formatUSD, trimDecimal } from "@/lib/format";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export function ProviderBalanceDialog({
  providerId,
  providerName,
  balance,
  balanceStatus,
  children,
  open: openControlled,
  onOpenChange: onOpenChangeControlled,
}: {
  providerId: number;
  providerName: string;
  balance: string | null;
  balanceStatus: ProviderBalanceStatus;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openControlled ?? openInternal;
  const [targetBalance, setTargetBalance] = useState("");
  const [reason, setReason] = useState("");
  const [amountError, setAmountError] = useState("");
  const [reasonError, setReasonError] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      adjustProviderBalance({
        providerId,
        targetBalance: targetBalance.trim(),
        reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["providers"] });
      void queryClient.invalidateQueries({ queryKey: ["provider", providerId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "breakdown"] });
      toast.success(
        `余额已调整为 ${formatUSD(result.balance_after)}，变化 ${result.entry_type === "adjustment_credit" ? "+" : "-"}${trimDecimal(result.amount)} USD`,
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  function onOpenChange(next: boolean) {
    if (onOpenChangeControlled) {
      onOpenChangeControlled(next);
    } else {
      setOpenInternal(next);
    }
    if (next) {
      setTargetBalance("");
      setReason("");
      setAmountError("");
      setReasonError("");
      mutation.reset();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const rawAmount = targetBalance.trim();
    const nextAmountError =
      !/^-?\d+(\.\d{1,10})?$/.test(rawAmount)
        ? "请输入目标余额，可为负数"
        : "";
    const nextReasonError = reason.trim() ? "" : "原因不能为空";
    setAmountError(nextAmountError);
    setReasonError(nextReasonError);
    if (nextAmountError || nextReasonError) return;
    mutation.mutate();
  }

  const current = balance == null ? 0 : Number(balance);
  const target = /^-?\d+(\.\d{1,10})?$/.test(targetBalance.trim()) ? Number(targetBalance) : null;
  const delta = target == null ? null : target - current;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent closeOnOutsideClick={false}>
        <DialogHeader>
          <DialogTitle>调整服务商余额</DialogTitle>
          <DialogDescription>{providerName}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">当前余额</div>
            <div className="mt-1 font-medium tabular-nums">
              {balanceStatus === "unconfigured" ? "未设置" : formatUSD(balance)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">目标余额</div>
            <div className="mt-1 font-medium tabular-nums">{target == null ? "—" : formatUSD(target)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">本次变化</div>
            <div className="mt-1 font-medium tabular-nums">{delta == null ? "—" : `${delta >= 0 ? "+" : ""}${formatUSD(delta)}`}</div>
          </div>
        </div>

        <form onSubmit={submit}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!amountError}>
                <FieldLabel htmlFor="provider-balance-target">目标余额（USD）</FieldLabel>
                <Input
                  id="provider-balance-target"
                  value={targetBalance}
                  onChange={(event) => setTargetBalance(event.target.value)}
                  placeholder={balance ?? "0.00"}
                  inputMode="decimal"
                  aria-invalid={!!amountError}
                  autoFocus
                />
                <FieldError>{amountError}</FieldError>
              </Field>
              <Field>
                <FieldLabel>币种</FieldLabel>
                <Input value="USD" readOnly />
              </Field>
            </div>

            <Field data-invalid={!!reasonError}>
              <FieldLabel htmlFor="provider-balance-reason">原因</FieldLabel>
              <Input
                id="provider-balance-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="例如：线下充值"
                aria-invalid={!!reasonError}
              />
              <FieldError>{reasonError}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              确认调整
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
