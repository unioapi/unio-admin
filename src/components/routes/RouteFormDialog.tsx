import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createRoute,
  updateRoute,
  type Route,
  type RouteMode,
} from "@/lib/api/routes";
import { listChannels } from "@/lib/api/channels";
import { apiErrorMessage } from "@/lib/api/client";
import { RoutePriceCalculator } from "@/components/routes/RoutePriceCalculator";
import { RouteChannelMarginTable } from "@/components/routes/RouteChannelMarginTable";
import { formatRouteRatioInput } from "@/components/routes/route-pricing";
import { StatusChangeConfirmDialog } from "@/components/common/StatusChangeConfirmDialog";
import { HintLabel } from "@/components/common/field-hint";
import {
  RateLimitInput,
  composeRateLimit,
  decomposeRateLimit,
  rateLimitWithUnitError,
  type RateLimitFieldValue,
} from "@/components/common/rate-limit-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
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
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// RPM 用普通整数输入：null/undefined → 空串（继承默认）；0 → "0"（不限）。
function rateLimitToInput(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

// parseRpmLimit：空串→null（继承默认）；否则取整数（0=不限，>0=上限）。
function parseRpmLimit(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  return Number(t);
}

// rpmLimitError：空放行；否则须为 ≥0 整数。
function rpmLimitError(raw: string): string | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) return "需为 ≥ 0 的整数（0=不限，留空=继承默认）";
  return undefined;
}

export function RouteFormDialog({
  open,
  onOpenChange,
  route,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: Route | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {open && (
          <RouteForm route={route} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RouteForm({
  route,
  onCancel,
  onSaved,
}: {
  route: Route | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(route?.name ?? "");
  const [mode, setMode] = useState<RouteMode>(route?.mode ?? "balanced");
  const [status, setStatus] = useState(route?.status ?? "enabled");
  const [priceRatio, setPriceRatio] = useState(() => formatRouteRatioInput(route?.price_ratio));
  // 线路级限流（DEC-027）：RPM 量级小用普通输入；TPM/RPD 量级大用「数字+单位 K/M/B」。
  const [rpmLimit, setRpmLimit] = useState(rateLimitToInput(route?.rpm_limit));
  const [tpmLimit, setTpmLimit] = useState<RateLimitFieldValue>(
    decomposeRateLimit(route?.tpm_limit),
  );
  const [rpdLimit, setRpdLimit] = useState<RateLimitFieldValue>(
    decomposeRateLimit(route?.rpd_limit),
  );
  // 会话粘性：三态（继承系统设置默认 / 开 / 关），后端 null=继承。
  const [stickyEnabled, setStickyEnabled] = useState<"inherit" | "on" | "off">(
    route?.sticky_enabled == null ? "inherit" : route.sticky_enabled ? "on" : "off",
  );
  const [description, setDescription] = useState(route?.description ?? "");
  const [channelIds, setChannelIds] = useState<number[]>(
    route?.channels.map((c) => c.channel_id) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  const channelsQuery = useQuery({
    queryKey: ["channels", "all-for-route"],
    queryFn: () => listChannels({ page: 1, pageSize: 100 }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        mode,
        status,
        price_ratio: formatRouteRatioInput(priceRatio),
        rpm_limit: parseRpmLimit(rpmLimit),
        tpm_limit: composeRateLimit(tpmLimit),
        rpd_limit: composeRateLimit(rpdLimit),
        sticky_enabled: stickyEnabled === "inherit" ? null : stickyEnabled === "on",
        description: description.trim() || null,
        channel_ids: channelIds,
      };
      return route ? updateRoute({ id: route.id, ...body }) : createRoute(body);
    },
    onSuccess: () => {
      toast.success(route ? "已更新线路" : "已创建线路");
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim() === "") next.name = "线路名不能为空";
    const ratio = priceRatio.trim();
    if (ratio !== "" && (!/^\d+(\.\d+)?$/.test(ratio) || Number(ratio) < 0)) {
      next.price_ratio = "需为 ≥ 0 的倍率（如 1、1.5、0.8）";
    }
    const rpmErr = rpmLimitError(rpmLimit);
    if (rpmErr) next.rpm_limit = rpmErr;
    const tpmErr = rateLimitWithUnitError(tpmLimit);
    if (tpmErr) next.tpm_limit = tpmErr;
    const rpdErr = rateLimitWithUnitError(rpdLimit);
    if (rpdErr) next.rpd_limit = rpdErr;
    if (mode === "fixed" && channelIds.length !== 1) {
      next.channels = "固定线路必须恰好选择一条渠道";
    } else if (channelIds.length === 0) {
      next.channels = "均衡线路至少选择一条渠道";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (route && status !== route.status) {
      setStatusConfirmOpen(true);
      return;
    }
    mutation.mutate();
  }

  function toggleChannel(id: number) {
    setChannelIds((prev) => {
      if (mode === "fixed") return prev.includes(id) ? [] : [id];
      return prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
    });
  }

  const orderedChannels = useMemo(() => {
    const list = channelsQuery.data?.items ?? [];
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [channelsQuery.data]);

  const channelNameMap = useMemo(
    () => Object.fromEntries(orderedChannels.map((c) => [c.id, c.name])),
    [orderedChannels],
  );

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="space-y-1 px-6 pt-6">
        <DialogHeader>
          <DialogTitle>{route ? "编辑线路" : "新建线路"}</DialogTitle>
          <DialogDescription>
            所有线路使用手动绑定的渠道池；均衡策略按容量和健康度分流，固定策略锁定单条渠道。
          </DialogDescription>
        </DialogHeader>
      </div>

      <ScrollArea className="max-h-[min(68vh,32rem)]">
      <FieldGroup className="gap-4 px-6 py-5">
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.name}>
            <HintLabel
              htmlFor="rt_name"
              hint="线路名称，仅用于后台识别；线路即分组，供 API Key 选用。"
            >
              线路名
            </HintLabel>
            <Input
              id="rt_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：C-专线"
              aria-invalid={!!errors.name}
            />
            <FieldError>{errors.name}</FieldError>
          </Field>
          <Field>
            <HintLabel htmlFor="rt_status" hint="停用后该线路不可被 API Key 选用。">
              状态
            </HintLabel>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="rt_status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">启用</SelectItem>
                <SelectItem value="disabled">停用</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
            <HintLabel
              htmlFor="rt_mode"
              hint="均衡策略在线路渠道池内按全局容量和健康度分流；固定策略锁定单条渠道且不跨渠道回退。"
            >
              选路策略
            </HintLabel>
            <Select
              value={mode}
              onValueChange={(value) => {
                const next = value as RouteMode;
                setMode(next);
                if (next === "fixed") {
                  setChannelIds((current) => current.slice(0, 1));
                }
              }}
            >
              <SelectTrigger id="rt_mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balanced">均衡（容量与健康度）</SelectItem>
                <SelectItem value="fixed">固定（锁定单渠道）</SelectItem>
              </SelectContent>
            </Select>
        </Field>

        <Field data-invalid={!!errors.price_ratio}>
          <HintLabel
            htmlFor="rt_ratio"
            hint="客户售价 = 模型基准价 × 倍率。可直接输入，或打开「倍率试算」预览各渠道毛利。"
          >
            售价倍率
          </HintLabel>
          <div className="flex items-center gap-2">
            <RoutePriceCalculator
              priceRatio={priceRatio}
              onChange={(ratio) => {
                setPriceRatio(ratio);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.price_ratio;
                  return next;
                });
              }}
              channelIds={channelIds}
              channelNames={channelNameMap}
            />
          </div>
          <FieldError>{errors.price_ratio}</FieldError>
        </Field>

        <Field data-invalid={!!errors.channels}>
          <HintLabel hint="线路只能使用这里手动绑定的渠道；下方列表实时对比各模型成本、售价与毛利。">
            渠道池
          </HintLabel>
          {channelsQuery.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : channelsQuery.isError ? (
            <FieldError>渠道加载失败：{apiErrorMessage(channelsQuery.error)}</FieldError>
          ) : (
            <RouteChannelMarginTable
              channels={orderedChannels}
              channelIds={channelIds}
              onToggleChannel={toggleChannel}
              priceRatio={priceRatio}
              fixedSingle={mode === "fixed"}
            />
          )}
          <FieldError>{errors.channels}</FieldError>
        </Field>

        <Field>
          <HintLabel hint="线路级限流：绑定该线路的每个用户合计生效（多建 Key 不放大配额），不同用户各自独立。留空=继承全局默认，0=不限；TPM、RPD 可带单位 K/M/B。">
            线路级限流
          </HintLabel>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field data-invalid={!!errors.rpm_limit}>
                <HintLabel htmlFor="rt_rpm" hint="每分钟请求数。">
                  RPM
                </HintLabel>
                <Input
                  id="rt_rpm"
                  type="number"
                  min={0}
                  value={rpmLimit}
                  onChange={(e) => setRpmLimit(e.target.value)}
                  placeholder="继承默认"
                  aria-invalid={!!errors.rpm_limit}
                />
                <FieldError>{errors.rpm_limit}</FieldError>
              </Field>
              <Field data-invalid={!!errors.tpm_limit}>
                <HintLabel htmlFor="rt_tpm" hint="每分钟 token 数。">
                  TPM
                </HintLabel>
                <RateLimitInput
                  id="rt_tpm"
                  value={tpmLimit}
                  onChange={setTpmLimit}
                  ariaInvalid={!!errors.tpm_limit}
                />
                <FieldError>{errors.tpm_limit}</FieldError>
              </Field>
              <Field data-invalid={!!errors.rpd_limit}>
                <HintLabel htmlFor="rt_rpd" hint="每日请求数。">
                  RPD
                </HintLabel>
                <RateLimitInput
                  id="rt_rpd"
                  value={rpdLimit}
                  onChange={setRpdLimit}
                  ariaInvalid={!!errors.rpd_limit}
                />
                <FieldError>{errors.rpd_limit}</FieldError>
              </Field>
            </div>
          </div>
        </Field>

        <Field>
          <HintLabel
            htmlFor="rt_sticky"
            hint="同一会话的请求钉住上次成功渠道，保住上游 prompt cache（多轮对话话费大幅降低）。留空继承系统设置的全局默认；粘住渠道故障时仍会自动切换。"
          >
            会话粘性
          </HintLabel>
          <Select
            value={stickyEnabled}
            onValueChange={(v) => setStickyEnabled(v as "inherit" | "on" | "off")}
          >
            <SelectTrigger id="rt_sticky" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">继承系统默认</SelectItem>
              <SelectItem value="on">开启</SelectItem>
              <SelectItem value="off">关闭</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <HintLabel htmlFor="rt_desc" hint="展示给客户的商品说明；可选。">
            简介（可选）
          </HintLabel>
          <Input
            id="rt_desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="展示给客户的商品说明"
          />
        </Field>
      </FieldGroup>
      </ScrollArea>

      <DialogFooter className="mx-0 mb-0 border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          {route ? "保存" : "创建"}
        </Button>
      </DialogFooter>
    </form>
    {route ? (
      <StatusChangeConfirmDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        entityLabel="线路"
        entityName={name.trim() || route.name}
        enabling={status === "enabled"}
        pending={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    ) : null}
    </>
  );
}
