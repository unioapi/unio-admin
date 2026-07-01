import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import {
  createApiKey,
  type CreatedApiKey,
} from "@/lib/api/apiKeys";
import { listRoutes } from "@/lib/api/routes";
import { apiErrorMessage } from "@/lib/api/client";
import { localToRFC3339 } from "@/lib/format";
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
import {
  Field,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";

const MONEY_PATTERN = /^\d+(\.\d+)?$/;

interface FieldErrors {
  name?: string;
  spendLimit?: string;
  routeId?: string;
}

// 创建 API Key 弹窗：成功后切到「明文展示」态，明文只展示这一次。
export function CreateApiKeyDialog({
  userId,
  children,
}: {
  userId: number;
  children: ReactNode;
}) {
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
      createApiKey({
        userId,
        name: name.trim(),
        expiresAt: expiresLocal ? localToRFC3339(expiresLocal) : undefined,
        spendLimit: spendLimit.trim() || undefined,
        routeId: Number(routeId),
      }),
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", userId] });
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
      setRouteId("");
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
    if (routeId === "") {
      next.routeId = "请选择线路";
    }
    setErrors(next);
    return Object.values(next).every((v) => v === undefined);
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
                请复制并妥善保存；之后也可在 Key 列表里再次复制完整明文。
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>请妥善保管完整明文</AlertTitle>
              <AlertDescription>
                明文已留存，可在 Key 列表「复制完整 Key」再次取用（前缀 {created.key_prefix}）。
              </AlertDescription>
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
                    hint="该 Key 使用的线路（必选）：决定选路策略与候选渠道池。"
                  >
                    线路
                  </HintLabel>
                  <Select value={routeId} onValueChange={setRouteId}>
                    <SelectTrigger
                      id="key_route"
                      className="w-full"
                      aria-invalid={!!errors.routeId}
                    >
                      <SelectValue placeholder="请选择线路" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
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
