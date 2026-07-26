import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  duplicateChannel,
  type Channel,
} from "@/lib/api/channels";
import {
  listProviderOrigins,
  type ProviderOrigin,
} from "@/lib/api/providerOrigins";
import { apiErrorMessage } from "@/lib/api/client";
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

/** 默认副本名：原名@目标源站名（同服务商内需唯一）。 */
export function defaultDuplicateChannelName(
  channelName: string,
  targetOriginName: string,
): string {
  return `${channelName}@${targetOriginName}`;
}

/**
 * 渠道侧「复制」：选同服务商另一源站，整份新建副本（非引用）。
 */
export function DuplicateChannelDialog({
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
      <DialogContent className="sm:max-w-md">
        {open ? (
          <DuplicateChannelForm
            channel={channel}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DuplicateChannelForm({
  channel,
  onDone,
}: {
  channel: Channel;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const originsQ = useQuery({
    queryKey: ["provider-origins", "by-provider", channel.provider_id, "duplicate"],
    queryFn: () =>
      listProviderOrigins({
        providerId: channel.provider_id,
        page: 1,
        pageSize: 100,
      }),
  });

  const targets = useMemo(
    () =>
      (originsQ.data?.items ?? []).filter(
        (o) =>
          o.id !== channel.provider_origin_id && o.status !== "archived",
      ),
    [originsQ.data?.items, channel.provider_origin_id],
  );

  const [originId, setOriginId] = useState<string>("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [fieldError, setFieldError] = useState<{
    origin?: string;
    name?: string;
  }>({});

  const selectedOrigin: ProviderOrigin | undefined = targets.find(
    (o) => String(o.id) === originId,
  );

  function pickOrigin(nextId: string) {
    setOriginId(nextId);
    setFieldError((e) => ({ ...e, origin: undefined }));
    const origin = targets.find((o) => String(o.id) === nextId);
    if (origin && !nameTouched) {
      setName(defaultDuplicateChannelName(channel.name, origin.name));
    }
  }

  const mutation = useMutation({
    mutationFn: duplicateChannel,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["provider-origins"] });
      toast.success(`已复制为「${created.name}」`);
      onDone();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errors: { origin?: string; name?: string } = {};
    if (!originId) errors.origin = "请选择目标源站";
    const trimmed = name.trim();
    if (!trimmed) errors.name = "名称不能为空";
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate({
      id: channel.id,
      provider_origin_id: Number(originId),
      name: trimmed,
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>复制</DialogTitle>
        <DialogDescription>
          将「{channel.name}」整份复制到同服务商的另一源站（含凭据、模型绑定与当前生效计价配置）。不会加入线路池。
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="py-4">
        <Field data-invalid={fieldError.origin ? true : undefined}>
          <FieldLabel htmlFor="dup_origin">目标源站</FieldLabel>
          {originsQ.isPending ? (
            <div className="text-muted-foreground flex h-9 items-center gap-2 text-sm">
              <Spinner data-icon="inline-start" />
              加载源站…
            </div>
          ) : targets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              同服务商下没有其他可用源站，请先新建源站。
            </p>
          ) : (
            <Select value={originId || undefined} onValueChange={pickOrigin}>
              <SelectTrigger id="dup_origin" className="w-full">
                <SelectValue placeholder="选择源站" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.name}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {o.base_url}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {fieldError.origin ? <FieldError>{fieldError.origin}</FieldError> : null}
        </Field>

        <Field data-invalid={fieldError.name ? true : undefined}>
          <FieldLabel htmlFor="dup_name">副本名称</FieldLabel>
          <Input
            id="dup_name"
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
              setFieldError((err) => ({ ...err, name: undefined }));
            }}
            placeholder={
              selectedOrigin
                ? defaultDuplicateChannelName(channel.name, selectedOrigin.name)
                : "选择源站后自动填充"
            }
            disabled={!originId}
          />
          {fieldError.name ? <FieldError>{fieldError.name}</FieldError> : null}
        </Field>
      </FieldGroup>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={mutation.isPending}>
            取消
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={mutation.isPending || targets.length === 0}
        >
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          复制
        </Button>
      </DialogFooter>
    </form>
  );
}
