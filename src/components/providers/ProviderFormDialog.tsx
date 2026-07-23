import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createProvider,
  updateProvider,
  type Provider,
} from "@/lib/api/providers";
import { apiErrorMessage } from "@/lib/api/client";
import { StatusChangeConfirmDialog } from "@/components/common/StatusChangeConfirmDialog";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 与后端 provider.slugPattern 保持一致：小写字母/数字开头，长度 1–64。
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

interface FieldErrors {
  slug?: string;
  name?: string;
}

// 同一个弹窗承担新建与编辑：传了 provider 即编辑（slug 只读），否则新建。
export function ProviderFormDialog({
  provider,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  provider?: Provider;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!provider;

  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("enabled");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (vars: { slug: string; name: string; status: string }) =>
      provider
        ? updateProvider({ id: provider.id, name: vars.name, status: vars.status })
        : createProvider(vars),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      // 编辑可能改了 name，渠道列表里冗余的 provider_name 会过期，一并刷新；
      // 新建不影响已有渠道，无需刷。
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ["channels"] });
        queryClient.invalidateQueries({ queryKey: ["provider-endpoints"] });
      }
      toast.success(saved.runtime_sync_pending
        ? "已保存，运行态同步中"
        : isEdit
          ? `已保存「${saved.name}」`
          : `已创建服务商「${saved.name}」`);
      setOpen(false);
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  // 打开时按当前 provider 预填（编辑）或清空（新建），并清掉上次的校验/请求状态。
  // 用 effect 而非 onOpenChange：受控用法（ProviderRowActions 编辑）通过 open prop 程序化打开，
  // 不会触发 Dialog 的 onOpenChange，必须在 open 变 true 时主动回填。
  useEffect(() => {
    if (!open) return;
    setSlug(provider?.slug ?? "");
    setName(provider?.name ?? "");
    setStatus(provider?.status ?? "enabled");
    setErrors({});
    mutation.reset();
    setStatusConfirmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider?.id]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    // slug 编辑时只读且已合法，只在新建时校验。
    if (!isEdit && !SLUG_PATTERN.test(slug.trim())) {
      next.slug = "小写字母或数字开头，仅含小写字母、数字、连字符，长度 1–64";
    }
    if (name.trim() === "") {
      next.name = "名称不能为空";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit && provider && status !== provider.status) {
      setStatusConfirmOpen(true);
      return;
    }
    mutation.mutate({ slug: slug.trim(), name: name.trim(), status });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑服务商" : "新建服务商"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "标识（slug）作为稳定业务标识不可修改。"
              : "填写上游服务商信息，标识（slug）创建后不可修改。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!errors.slug}>
              <HintLabel
                htmlFor="slug"
                hint="服务商稳定业务标识；小写字母或数字开头，仅含小写字母、数字、连字符，长度 1–64；创建后不可修改。"
              >
                标识（slug）
              </HintLabel>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="openai"
                aria-invalid={!!errors.slug}
                disabled={isEdit}
                autoFocus={!isEdit}
              />
              <FieldError>{errors.slug}</FieldError>
            </Field>

            <Field data-invalid={!!errors.name}>
              <HintLabel htmlFor="name" hint="服务商展示名称，仅用于后台识别。">
                名称
              </HintLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="OpenAI"
                aria-invalid={!!errors.name}
                autoFocus={isEdit}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>

            <Field>
              <HintLabel
                htmlFor="status"
                hint="停用后其下渠道不参与路由，新请求不再走这些渠道。"
              >
                状态
              </HintLabel>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
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
              {mutation.isPending
                ? "保存中..."
                : isEdit
                  ? "保存"
                  : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {isEdit && provider ? (
      <StatusChangeConfirmDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        entityLabel="服务商"
        entityName={name.trim() || provider.name}
        enabling={status === "enabled"}
        pending={mutation.isPending}
        onConfirm={() =>
          mutation.mutate({ slug: slug.trim(), name: name.trim(), status })
        }
      />
    ) : null}
    </>
  );
}
