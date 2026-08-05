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
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// RPM 用普通整数输入：null/undefined → 空串（继承默认）；0 → "0"（不限）。
function rateLimitToInput(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

// parseIntegerLimit：空串→null（继承默认）；否则取整数（0=不限，>0=上限）。
function parseIntegerLimit(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  return Number(t);
}

// integerLimitError：空放行；否则须为 >=0 整数。
function integerLimitError(raw: string, inheritLabel: string): string | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) {
    return `需为 >= 0 的整数（0=不限，留空=${inheritLabel}）`;
  }
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
  // 线路级限流（DEC-027）：RPM 量级小用普通输入；RPD 量级大用「数字+单位 K/M/B」。
  // 没有 TPM：Unio 不限制 token 吞吐，运行态里只做观测。
  const [rpmLimit, setRpmLimit] = useState(rateLimitToInput(route?.rpm_limit));
  const [rpdLimit, setRpdLimit] = useState<RateLimitFieldValue>(
    decomposeRateLimit(route?.rpd_limit),
  );
  const [concurrencyLimit, setConcurrencyLimit] = useState(
    rateLimitToInput(route?.concurrency_limit),
  );
  const [description, setDescription] = useState(route?.description ?? "");
  const [channelIds, setChannelIds] = useState<number[]>(
    route?.channels.map((c) => c.channel_id) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [disabledChannelsConfirmOpen, setDisabledChannelsConfirmOpen] = useState(false);

  const channelsQuery = useQuery({
    queryKey: ["channels", "all-for-route"],
    queryFn: async ({ signal }) => {
      const [enabled, disabled] = await Promise.all([
        listChannels({ page: 1, pageSize: 100, status: "enabled" }, signal),
        listChannels({ page: 1, pageSize: 100, status: "disabled" }, signal),
      ]);
      const channelsById = new Map(
        [...enabled.items, ...disabled.items]
          .filter((channel) => channel.status !== "archived")
          .map((channel) => [channel.id, channel]),
      );
      return { items: [...channelsById.values()], total: channelsById.size };
    },
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        mode,
        status,
        price_ratio: formatRouteRatioInput(priceRatio),
        rpm_limit: parseIntegerLimit(rpmLimit),
        rpd_limit: composeRateLimit(rpdLimit),
        concurrency_limit: parseIntegerLimit(concurrencyLimit),
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
    const rpmErr = integerLimitError(rpmLimit, "继承线路默认限流");
    if (rpmErr) next.rpm_limit = rpmErr;
    const rpdErr = rateLimitWithUnitError(rpdLimit, "继承线路默认限流");
    if (rpdErr) next.rpd_limit = rpdErr;
    const concurrencyErr = integerLimitError(concurrencyLimit, "继承全局线路用户并发");
    if (concurrencyErr) next.concurrency_limit = concurrencyErr;
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
    if (selectedDisabledChannels.length > 0) {
      setDisabledChannelsConfirmOpen(true);
      return;
    }
    continueSubmit();
  }

  function continueSubmit() {
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

  const selectedDisabledChannels = useMemo(
    () => orderedChannels.filter(
      (channel) => channel.status === "disabled" && channelIds.includes(channel.id),
    ),
    [channelIds, orderedChannels],
  );

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
            所有线路使用手动绑定的渠道池；均衡策略按经济、健康、容量和 Priority 客观评分排序，固定策略锁定单条渠道。
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
                <SelectGroup>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
            <HintLabel
              htmlFor="rt_mode"
              hint="均衡策略在线路渠道池内按经济、健康、容量和 Priority 客观评分排序；固定策略锁定单条渠道且不跨渠道回退。"
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
                <SelectGroup>
                  <SelectItem value="balanced">客观评分（经济、健康、容量、Priority）</SelectItem>
                  <SelectItem value="fixed">固定（锁定单渠道）</SelectItem>
                </SelectGroup>
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
          <HintLabel hint="线路级限流：绑定该线路的每个用户合计生效（多建 Key 不放大配额），不同用户各自独立。留空=继承对应全局默认，0=不限；并发覆盖完整流式响应周期。">
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
                  placeholder="继承线路默认限流"
                  aria-invalid={!!errors.rpm_limit}
                />
                <FieldError>{errors.rpm_limit}</FieldError>
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
                  placeholder="继承线路默认限流"
                />
                <FieldError>{errors.rpd_limit}</FieldError>
              </Field>
              <Field data-invalid={!!errors.concurrency_limit}>
                <HintLabel htmlFor="rt_concurrency" hint="同时进行中的请求数，包含完整流式响应周期。">
                  并发
                </HintLabel>
                <Input
                  id="rt_concurrency"
                  type="number"
                  min={0}
                  value={concurrencyLimit}
                  onChange={(e) => setConcurrencyLimit(e.target.value)}
                  placeholder="继承全局并发"
                  aria-invalid={!!errors.concurrency_limit}
                />
                <FieldError>{errors.concurrency_limit}</FieldError>
              </Field>
            </div>
          </div>
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
    <ConfirmActionDialog
      open={disabledChannelsConfirmOpen}
      onOpenChange={setDisabledChannelsConfirmOpen}
      title="确认使用停用渠道"
      description={`已选择停用渠道「${selectedDisabledChannels
        .map((channel) => channel.name)
        .join("」、「")}」。停用渠道当前不会参与路由，只有重新启用后才会生效。确认仍然${route ? "保存" : "创建"}？`}
      confirmLabel={route ? "仍然保存" : "仍然创建"}
      pending={mutation.isPending}
      onConfirm={() => {
        setDisabledChannelsConfirmOpen(false);
        continueSubmit();
      }}
    />
    </>
  );
}
