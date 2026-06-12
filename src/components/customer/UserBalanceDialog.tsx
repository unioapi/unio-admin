import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createAdjustment,
  getUser,
  type AdjustDirection,
  type User,
} from "@/lib/api/users";
import { apiErrorMessage } from "@/lib/api/client";
import { trimDecimal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 余额上限/必填校验用的非负十进制金额格式。
const MONEY_PATTERN = /^\d+(\.\d+)?$/;

interface FieldErrors {
  amount?: string;
  currency?: string;
  reason?: string;
}

// 用户余额管理弹窗：展示各币种余额，并手工调额（充值/扣款，走账本留痕）。
export function UserBalanceDialog({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<AdjustDirection>("credit");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: ["user", user.id],
    queryFn: () => getUser(user.id),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createAdjustment({
        userId: user.id,
        direction,
        amount: amount.trim(),
        currency: currency.trim(),
        reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["user", user.id] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries"] });
      toast.success(
        `${direction === "credit" ? "已充值" : "已扣款"} ${trimDecimal(result.amount)} ${result.currency}，余额 ${trimDecimal(result.balance_after)}`,
      );
      setAmount("");
      setReason("");
      setErrors({});
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDirection("credit");
      setAmount("");
      setCurrency("USD");
      setReason("");
      setErrors({});
      mutation.reset();
    }
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!MONEY_PATTERN.test(amount.trim()) || Number(amount) <= 0) {
      next.amount = "需为大于 0 的金额";
    }
    if (currency.trim() === "") {
      next.currency = "币种不能为空";
    }
    if (reason.trim() === "") {
      next.reason = "原因不能为空（留痕）";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>余额管理</DialogTitle>
          <DialogDescription>
            {user.email} · 手工调额会写入账本流水（adjustment）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-medium">当前余额</p>
          {detail.isPending ? (
            <Skeleton className="h-5 w-40" />
          ) : detail.data && detail.data.balances.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detail.data.balances.map((b) => (
                <span
                  key={b.currency}
                  className="bg-muted rounded-md px-2 py-1 text-sm tabular-nums"
                >
                  {trimDecimal(b.balance)} {b.currency}
                  {trimDecimal(b.reserved_balance) !== "0" && (
                    <span className="text-muted-foreground">
                      {" "}
                      (冻结 {trimDecimal(b.reserved_balance)})
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">暂无余额记录</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="direction">方向</FieldLabel>
                <Select
                  value={direction}
                  onValueChange={(v) => setDirection(v as AdjustDirection)}
                >
                  <SelectTrigger id="direction" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">充值（加款）</SelectItem>
                    <SelectItem value="debit">扣款（减款）</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field data-invalid={!!errors.currency}>
                <FieldLabel htmlFor="currency">币种</FieldLabel>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  placeholder="USD"
                  aria-invalid={!!errors.currency}
                />
                <FieldError>{errors.currency}</FieldError>
              </Field>
            </div>

            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor="amount">金额</FieldLabel>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
                inputMode="decimal"
                aria-invalid={!!errors.amount}
                autoFocus
              />
              <FieldError>{errors.amount}</FieldError>
            </Field>

            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="reason">原因</FieldLabel>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例如：人工补偿 / 线下充值"
                aria-invalid={!!errors.reason}
              />
              <FieldError>{errors.reason}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                关闭
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              {mutation.isPending ? "提交中..." : "提交调额"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
