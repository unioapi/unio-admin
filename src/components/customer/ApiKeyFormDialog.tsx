import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import {
  createApiKey,
  updateApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "@/lib/api/apiKeys";
import { listRoutes } from "@/lib/api/routes";
import { apiErrorMessage } from "@/lib/api/client";
import { localToRFC3339, rfc3339ToLocal, trimDecimal } from "@/lib/format";
import { formatRouteRatioInput } from "@/components/routes/route-pricing";
import { copySecretToClipboard } from "@/components/common/SecretCopyCell";
import { HintLabel } from "@/components/common/field-hint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-picker";
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
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { toast } from "sonner";

const MONEY_PATTERN = /^\d+(\.\d+)?$/;

interface FieldErrors {
  name?: string;
  spendLimit?: string;
  routeId?: string;
}

/**
 * API Key 新建/编辑弹窗。
 * - 传 apiKey → 编辑模式（保存后关闭）。
 * - 传 userId（不传 apiKey）→ 新建模式（成功后切到「明文展示」态，明文只展示这一次，也可稍后在列表复制）。
 */
export function ApiKeyFormDialog({
  userId,
  apiKey,
  children,
}: {
  userId?: number;
  apiKey?: ApiKey;
  children: ReactNode;
}) {
  const isEdit = apiKey != null;
  const ownerId = apiKey?.user_id ?? userId;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [spendLimit, setSpendLimit] = useState("");
  const [routeId, setRouteId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const queryClient = useQueryClient();

  const routesQuery = useQuery({
    queryKey: ["routes"],
    queryFn: listRoutes,
    enabled: open,
  });
  const routes = (routesQuery.data ?? []).filter((r) => r.status === "enabled");

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateApiKey({
            id: apiKey.id,
            name: name.trim(),
            spendLimit: spendLimit.trim(),
            routeId: Number(routeId),
            expiresAt: expiresLocal ? localToRFC3339(expiresLocal) : null,
          })
        : createApiKey({
            userId: userId!,
            name: name.trim(),
            expiresAt: expiresLocal ? localToRFC3339(expiresLocal) : undefined,
            spendLimit: spendLimit.trim() || undefined,
            routeId: Number(routeId),
          }),
    onSuccess: (result) => {
      if (ownerId != null) {
        queryClient.invalidateQueries({ queryKey: ["api-keys", ownerId] });
      }
      if (isEdit) {
        toast.success("已保存");
        setOpen(false);
      } else {
        setCreated(result as CreatedApiKey);
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(apiKey?.name ?? "");
      setExpiresLocal(apiKey?.expires_at ? rfc3339ToLocal(apiKey.expires_at) : "");
      setSpendLimit(apiKey?.spend_limit ? trimDecimal(apiKey.spend_limit) : "");
      setRouteId(apiKey ? String(apiKey.route_id) : "");
      setErrors({});
      setCreated(null);
      mutation.reset();
    }
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (name.trim() === "") next.name = "名称不能为空";
    if (spendLimit.trim() !== "" && !MONEY_PATTERN.test(spendLimit.trim())) {
      next.spendLimit = "需为非负金额";
    }
    if (routeId === "") next.routeId = "请选择线路";
    setErrors(next);
    return Object.values(next).every((v) => v === undefined);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="min-w-0 overflow-hidden sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>API Key 已创建</DialogTitle>
              <DialogDescription>
                请复制并妥善保存；之后也可在 Key 列表里再次复制完整明文。
              </DialogDescription>
            </DialogHeader>

            <Alert className="min-w-0">
              <TriangleAlertIcon />
              <AlertTitle>请妥善保管完整明文</AlertTitle>
              <AlertDescription className="break-words">
                明文已留存，可在 Key 列表「复制完整 Key」再次取用（前缀 {created.key_prefix}）。
              </AlertDescription>
            </Alert>

            <div className="flex min-w-0 items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded-md px-3 py-2 font-mono text-xs sm:text-sm">
                {created.plaintext}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="复制"
                onClick={() => void copySecretToClipboard(created.plaintext)}
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
              <DialogTitle>{isEdit ? "编辑 API Key" : "新建 API Key"}</DialogTitle>
              <DialogDescription>
                {isEdit
                  ? `${apiKey.key_prefix}… · 已累计花费 ${trimDecimal(apiKey.spent_total)}`
                  : "费用上限为生命周期累计封顶，达到后该 Key 自动停用。"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field data-invalid={!!errors.name}>
                  <HintLabel htmlFor="key_name" hint="API Key 名称，仅用于后台识别。">
                    名称
                  </HintLabel>
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
                  <HintLabel
                    htmlFor="key_spend_limit"
                    hint="生命周期累计花费上限，达到后该 Key 自动停用；留空表示不限额。"
                  >
                    费用上限
                  </HintLabel>
                  <Input
                    id="key_spend_limit"
                    value={spendLimit}
                    onChange={(e) => setSpendLimit(e.target.value)}
                    placeholder="留空表示不限额"
                    inputMode="decimal"
                    aria-invalid={!!errors.spendLimit}
                  />
                  <FieldError>{errors.spendLimit}</FieldError>
                </Field>

                <Field>
                  <HintLabel htmlFor="key_expires" hint="Key 过期时间；留空表示永不过期。">
                    过期时间
                  </HintLabel>
                  <DateTimePicker
                    id="key_expires"
                    value={expiresLocal}
                    onChange={setExpiresLocal}
                    placeholder="留空表示永不过期"
                  />
                </Field>

                <Field data-invalid={!!errors.routeId}>
                  <HintLabel
                    htmlFor="key_route"
                    hint="该 Key 使用的线路：决定选路策略、候选渠道池与售价倍率。"
                  >
                    线路
                  </HintLabel>
                  <Select value={routeId} onValueChange={setRouteId}>
                    <SelectTrigger id="key_route" className="w-full" aria-invalid={!!errors.routeId}>
                      <SelectValue placeholder="请选择线路" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name} · ×{formatRouteRatioInput(r.price_ratio) || "1"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.routeId}</FieldError>
                  <p className="text-muted-foreground text-xs">
                    限流由所选线路统一决定（按用户计量，多建 Key 不放大配额）；如需调整请在线路上配置。
                  </p>
                </Field>
              </FieldGroup>

              <DialogFooter className="mt-6">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    取消
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={mutation.isPending || routesQuery.isPending}>
                  {mutation.isPending && <Spinner data-icon="inline-start" />}
                  {mutation.isPending ? "保存中..." : isEdit ? "保存" : "创建"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
