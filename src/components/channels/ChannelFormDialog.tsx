import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createChannel,
  updateChannel,
  listAdapterKeys,
  type Channel,
} from "@/lib/api/channels";
import { listAllProviders } from "@/lib/api/providers";
import {
  listProviderOrigins,
  type ProviderOrigin,
} from "@/lib/api/providerOrigins";
import { apiErrorMessage } from "@/lib/api/client";
import { HintLabel } from "@/components/common/field-hint";
import { StatusChangeConfirmDialog } from "@/components/common/StatusChangeConfirmDialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 受控弹窗：open 由父组件管理。表单状态放在内层 ChannelForm，
// Radix 关闭即卸载，重新打开时随之重新挂载、用 useState 初值预填，无需 effect 重置。
export function ChannelFormDialog({
  open,
  onOpenChange,
  channel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: Channel;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {open && (
          <ChannelForm channel={channel} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FieldErrors {
  provider_id?: string;
  provider_origin_id?: string;
  name?: string;
  adapter_key?: string;
  credential?: string;
  priority?: string;
  timeout_ms?: string;
  rpm_limit?: string;
  tpm_limit?: string;
  rpd_limit?: string;
  concurrency_limit?: string;
}

// 限流输入回填：null（继承渠道默认限流）→ 空串；数字（含 0=不限）→ 字符串。
function rateLimitToInput(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

// 限流输入解析：空串→null（继承渠道默认限流）；否则取整数（0=不限，>0=具体上限）。
function parseRateLimit(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  return Number(t);
}

// 校验单个限流维度：空串放行；否则须为非负整数。
function rateLimitError(
  raw: string,
  inheritLabel = "继承默认",
): string | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) {
    return `需为 ≥ 0 的整数（0=不限，留空=${inheritLabel}）`;
  }
  return undefined;
}

function ChannelForm({
  channel,
  onDone,
}: {
  channel?: Channel;
  onDone: () => void;
}) {
  const isEdit = !!channel;
  const queryClient = useQueryClient();

  const [providerId, setProviderId] = useState(
    channel ? String(channel.provider_id) : "",
  );
  const [providerOriginId, setProviderOriginId] = useState(
    channel ? String(channel.provider_origin_id) : "",
  );
  const [name, setName] = useState(channel?.name ?? "");
  const initialProtocol = channel?.protocol ?? "openai";
  const [protocol, setProtocol] = useState(initialProtocol);
  // adapter_key 留空时后端默认取协议同名的忠实透传 adapter，故初值跟随协议默认。
  const [adapterKey, setAdapterKey] = useState(
    channel?.adapter_key ?? initialProtocol,
  );
  const [credential, setCredential] = useState("");
  const [status, setStatus] = useState(channel?.status ?? "enabled");
  const [priority, setPriority] = useState(String(channel?.priority ?? 0));
  const [timeoutMs, setTimeoutMs] = useState(
    channel?.timeout_ms != null ? String(channel.timeout_ms) : "",
  );
  const [rpmLimit, setRpmLimit] = useState(rateLimitToInput(channel?.rpm_limit));
  const [concurrencyLimit, setConcurrencyLimit] = useState(
    rateLimitToInput(channel?.concurrency_limit),
  );
  const [billsOnDisconnect, setBillsOnDisconnect] = useState(
    channel?.upstream_bills_on_disconnect ?? false,
  );
  // TPM/RPD 量级大,用「数字 + 单位(K/M/B)」输入;入库换算成真实整数。
  const [tpmLimit, setTpmLimit] = useState<RateLimitFieldValue>(
    decomposeRateLimit(channel?.tpm_limit),
  );
  const [rpdLimit, setRpdLimit] = useState<RateLimitFieldValue>(
    decomposeRateLimit(channel?.rpd_limit),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  // 编辑时单条 GET 可能不带 provider_name，用全量列表兜底解析。
  const providersQuery = useQuery({
    queryKey: ["providers", "all"],
    queryFn: listAllProviders,
  });

  const endpointsQuery = useQuery({
    queryKey: ["provider-origins", "by-provider", providerId],
    queryFn: () => listProviderOrigins({ providerId: Number(providerId) }),
    enabled: Number(providerId) > 0,
  });

  const endpoints = endpointsQuery.data?.items ?? [];
  const endpointOptions = endpoints.filter(
    (endpoint) => endpoint.status !== "archived",
  );
  const selectedOrigin: ProviderOrigin | undefined = endpoints.find(
    (endpoint) => String(endpoint.id) === providerOriginId,
  );

  const providerDisplay = useMemo(() => {
    if (!channel) return "";
    if (channel.provider_name) {
      return `${channel.provider_name}（#${channel.provider_id}）`;
    }
    const provider = providersQuery.data?.find((p) => p.id === channel.provider_id);
    if (provider) return `${provider.name}（${provider.slug}）`;
    if (providersQuery.isPending) return "加载中…";
    return `未知（#${channel.provider_id}）`;
  }, [channel, providersQuery.data, providersQuery.isPending]);

  // 可选 adapter_key 由后端按已注册能力枚举；仅创建时需要（编辑不可改 adapter）。
  const adapterKeysQuery = useQuery({
    queryKey: ["channels", "adapter-keys"],
    queryFn: listAdapterKeys,
    enabled: !isEdit,
  });

  // 按当前协议过滤出可选 adapter_key（协议变更时联动）。
  const adapterOptions = (adapterKeysQuery.data ?? []).filter(
    (o) => o.protocol === protocol,
  );

  // 协议切换时把 adapter_key 重置为新协议的默认项（忠实透传），避免残留跨协议的非法值。
  function handleProtocolChange(next: string) {
    setProtocol(next);
    const opts = (adapterKeysQuery.data ?? []).filter(
      (o) => o.protocol === next,
    );
    const fallback = opts.find((o) => o.is_default) ?? opts[0];
    setAdapterKey(fallback ? fallback.adapter_key : next);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const timeout = timeoutMs.trim() === "" ? null : Number(timeoutMs);
      const prio = Number(priority);
      const rateLimits = {
        rpm: parseRateLimit(rpmLimit),
        tpm: composeRateLimit(tpmLimit),
        rpd: composeRateLimit(rpdLimit),
        concurrency: parseRateLimit(concurrencyLimit),
      };
      if (channel) {
        return updateChannel({
          id: channel.id,
          name: name.trim(),
          provider_origin_id: Number(providerOriginId),
          status,
          priority: prio,
          timeout_ms: timeout,
          rateLimits,
          billsOnDisconnect,
        });
      }
      return createChannel({
        provider_id: Number(providerId),
        provider_origin_id: Number(providerOriginId),
        name: name.trim(),
        protocol,
        adapter_key: adapterKey.trim(),
        credential: credential.trim(),
        status,
        priority: prio,
        timeout_ms: timeout,
        rateLimits,
        billsOnDisconnect,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success(
        isEdit ? `已保存「${saved.name}」` : `已创建渠道「${saved.name}」`,
      );
      onDone();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!isEdit && !(Number(providerId) > 0)) {
      next.provider_id = "请选择服务商";
    }
    if (endpointsQuery.isError) {
      next.provider_origin_id = "ProviderOrigin 加载失败，请重试";
    } else if (!(Number(providerOriginId) > 0)) {
      next.provider_origin_id = "请选择 ProviderOrigin";
    } else if (endpointsQuery.isSuccess && !selectedOrigin) {
      next.provider_origin_id = "所选 ProviderOrigin 已不可用，请重新选择";
    }
    if (name.trim() === "") {
      next.name = "名称不能为空";
    }
    if (!isEdit && adapterKey.trim() === "") {
      next.adapter_key = "adapter_key 不能为空";
    }
    if (!isEdit && credential.trim() === "") {
      next.credential = "凭据不能为空";
    }
    const prio = Number(priority);
    if (!Number.isInteger(prio) || prio < 0) {
      next.priority = "优先级需为 ≥ 0 的整数";
    }
    if (timeoutMs.trim() !== "") {
      const t = Number(timeoutMs);
      if (!Number.isInteger(t) || t <= 0) {
        next.timeout_ms = "超时需为正整数（毫秒）";
      }
    }
    next.rpm_limit = rateLimitError(rpmLimit, "继承渠道默认限流");
    next.tpm_limit = rateLimitWithUnitError(tpmLimit, "继承渠道默认限流");
    next.rpd_limit = rateLimitWithUnitError(rpdLimit, "继承渠道默认限流");
    next.concurrency_limit = rateLimitError(concurrencyLimit);
    setErrors(next);
    return Object.values(next).every((v) => v === undefined);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit && channel && status !== channel.status) {
      setStatusConfirmOpen(true);
      return;
    }
    mutation.mutate();
  }

  const rateLimitInvalid =
    !!errors.rpm_limit ||
    !!errors.tpm_limit ||
    !!errors.rpd_limit ||
    !!errors.concurrency_limit;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="space-y-1 px-6 pt-6">
          <DialogHeader>
            <DialogTitle>{isEdit ? "编辑渠道" : "新建渠道"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "协议、adapter 不在此修改；上游地址由 ProviderOrigin 统一维护，凭据请用「轮换凭据」。"
                : "选择 ProviderOrigin 并填写渠道凭据与路由参数。协议、adapter 创建后不可修改。"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[min(68vh,32rem)]">
          <FieldGroup className="gap-4 px-6 py-5">
            <Field data-invalid={!!errors.provider_id}>
              <HintLabel
                htmlFor="provider"
                hint="该渠道所属的上游服务商；先建服务商，再在其下建渠道。创建后不可修改。"
              >
                服务商
              </HintLabel>
              {isEdit ? (
                <Input id="provider" value={providerDisplay} disabled />
              ) : (
                <Select
                  value={providerId}
                  onValueChange={(next) => {
                    setProviderId(next);
                    setProviderOriginId("");
                  }}
                >
                  <SelectTrigger
                    id="provider"
                    className="w-full"
                    aria-invalid={!!errors.provider_id}
                  >
                    <SelectValue
                      placeholder={
                        providersQuery.isPending ? "加载中…" : "选择服务商"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(providersQuery.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}（{p.slug}）
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <FieldError>{errors.provider_id}</FieldError>
            </Field>

            <Field data-invalid={!!errors.provider_origin_id}>
              <HintLabel
                htmlFor="provider_origin"
                hint="上游源站代表一个上游 API Root 和公共故障域；同一 Provider 下的渠道必须绑定一个 源站。"
              >
                ProviderOrigin
              </HintLabel>
              <Select
                value={providerOriginId}
                onValueChange={setProviderOriginId}
                disabled={
                  Number(providerId) <= 0 ||
                  endpointsQuery.isPending ||
                  endpointsQuery.isError ||
                  endpointOptions.length === 0
                }
              >
                <SelectTrigger
                  id="provider_origin"
                  className="w-full"
                  aria-invalid={!!errors.provider_origin_id}
                >
                  <SelectValue
                    placeholder={
                      Number(providerId) <= 0
                        ? "先选择服务商"
                        : endpointsQuery.isPending
                          ? "加载中…"
                          : endpointsQuery.isError
                            ? "加载失败"
                            : endpointOptions.length === 0
                              ? "暂无可用 源站"
                          : "选择 ProviderOrigin"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {endpointOptions.map((endpoint) => (
                      <SelectItem key={endpoint.id} value={String(endpoint.id)}>
                        {endpoint.name} · {endpoint.base_url}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{errors.provider_origin_id}</FieldError>
              {endpointsQuery.isError && !errors.provider_origin_id ? (
                <p className="text-destructive text-xs">
                  ProviderOrigin 加载失败，请关闭弹窗后重试。
                </p>
              ) : Number(providerId) > 0 && endpointsQuery.isSuccess && endpointOptions.length === 0 ? (
                <p className="text-muted-foreground truncate text-xs">
                  该服务商暂无可用 源站，请先到服务商详情创建。
                </p>
              ) : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-disabled>
                <HintLabel
                  htmlFor="endpoint_provider"
                  hint="由所选 ProviderOrigin 决定，提交时后端会再次校验归属一致。"
                >
                  源站 服务商
                </HintLabel>
                <Input
                  id="endpoint_provider"
                  value={
                    selectedOrigin
                      ? `${selectedOrigin.provider_name}（#${selectedOrigin.provider_id}）`
                      : ""
                  }
                  placeholder="选择 ProviderOrigin 后显示"
                  disabled
                />
              </Field>

              <Field data-disabled>
                <HintLabel
                  htmlFor="origin_base_url"
                  hint="地址由 ProviderOrigin 统一维护；修改地址请到 ProviderOrigin 管理。"
                >
                  API Root
                </HintLabel>
                <Input
                  id="origin_base_url"
                  value={selectedOrigin?.base_url ?? channel?.base_url ?? ""}
                  placeholder="选择 ProviderOrigin 后显示"
                  disabled
                />
                {selectedOrigin ? (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    地址版本 v{selectedOrigin.base_url_revision}
                  </p>
                ) : null}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.name}>
                <HintLabel
                  htmlFor="name"
                  hint="渠道名称，仅用于后台识别；同一服务商下不可重名。"
                >
                  名称
                </HintLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="primary"
                  aria-invalid={!!errors.name}
                  autoFocus
                />
                <FieldError>{errors.name}</FieldError>
              </Field>

              {isEdit ? (
                <Field>
                  <HintLabel
                    htmlFor="status"
                    hint="启用后该渠道参与路由；停用则新请求不再走它（进行中的请求不受影响）。"
                  >
                    状态
                  </HintLabel>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status" className="w-full">
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
              ) : (
                <Field>
                  <HintLabel
                    htmlFor="protocol"
                    hint="渠道对外协议族：openai（/v1/chat/completions、/responses）或 anthropic（/v1/messages）。创建后不可修改。"
                  >
                    协议
                  </HintLabel>
                  <Select value={protocol} onValueChange={handleProtocolChange}>
                    <SelectTrigger id="protocol" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="openai">openai</SelectItem>
                        <SelectItem value="anthropic">anthropic</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            <Field
              data-invalid={!!errors.adapter_key}
              data-disabled={isEdit}
            >
              <HintLabel
                htmlFor="adapter_key"
                hint="请求/响应翻译实现。留默认「忠实透传」即可对接 OpenAI/Anthropic 兼容上游；特殊方言才换。创建后不可修改。"
              >
                adapter_key
              </HintLabel>
              {isEdit ? (
                <Input
                  id="adapter_key"
                  value={channel.adapter_key}
                  disabled
                />
              ) : (
                <Select value={adapterKey} onValueChange={setAdapterKey}>
                  <SelectTrigger
                    id="adapter_key"
                    className="w-full"
                    aria-invalid={!!errors.adapter_key}
                  >
                    <SelectValue
                      placeholder={
                        adapterKeysQuery.isPending
                          ? "加载中…"
                          : "选择 adapter"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {adapterOptions.map((o) => (
                        <SelectItem
                          key={o.adapter_key}
                          value={o.adapter_key}
                        >
                          {o.adapter_key}
                          {o.is_default ? "（默认 · 忠实透传）" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <FieldError>{errors.adapter_key}</FieldError>
            </Field>

            {isEdit ? (
              <Field data-disabled>
                <HintLabel htmlFor="protocol" hint="创建后不可修改。">
                  协议
                </HintLabel>
                <Input id="protocol" value={channel.protocol} disabled />
              </Field>
            ) : null}

            {!isEdit && (
              <Field data-invalid={!!errors.credential}>
                <HintLabel
                  htmlFor="credential"
                  hint="调用上游用的 API Key。明文存储，管理端可在渠道详情查看/复制，或用「轮换凭据」更换。"
                >
                  凭据
                </HintLabel>
                <Input
                  id="credential"
                  type="password"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="sk-..."
                  aria-invalid={!!errors.credential}
                  autoComplete="off"
                />
                <FieldError>{errors.credential}</FieldError>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.priority}>
                <HintLabel
                  htmlFor="priority"
                  hint="候选基础顺序，数值越小越靠前（0 最高）；balanced 会按容量、错误率、流式首字和成本权重动态调度，不保证小数值渠道每次先命中。"
                >
                  优先级
                </HintLabel>
                <Input
                  id="priority"
                  type="number"
                  min={0}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  aria-invalid={!!errors.priority}
                />
                <FieldError>{errors.priority}</FieldError>
              </Field>

              <Field data-invalid={!!errors.timeout_ms}>
                <HintLabel
                  htmlFor="timeout_ms"
                  hint="用户请求经本渠道调用上游的单次超时（毫秒）；留空用系统「默认渠道超时」。与「渠道检测超时」无关。"
                >
                  超时（毫秒）
                </HintLabel>
                <Input
                  id="timeout_ms"
                  type="number"
                  min={1}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(e.target.value)}
                  placeholder="留空表示不单独设置"
                  aria-invalid={!!errors.timeout_ms}
                />
                <FieldError>{errors.timeout_ms}</FieldError>
              </Field>
            </div>

            <Field data-invalid={rateLimitInvalid}>
              <HintLabel hint="限制本网关调用该上游渠道的速率（网关→上游），命中自动跳过该渠道回退到下一个。留空=继承渠道默认限流，0=不限；TPM、RPD 可带单位 K/M/B（默认 K）。">
                渠道级限流
              </HintLabel>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field data-invalid={!!errors.rpm_limit}>
                    <HintLabel htmlFor="rpm_limit" hint="每分钟请求数。">
                      RPM
                    </HintLabel>
                    <Input
                      id="rpm_limit"
                      type="number"
                      min={0}
                      value={rpmLimit}
                      onChange={(e) => setRpmLimit(e.target.value)}
                      placeholder="继承渠道默认限流"
                      aria-invalid={!!errors.rpm_limit}
                    />
                    <FieldError>{errors.rpm_limit}</FieldError>
                  </Field>
                  <Field data-invalid={!!errors.tpm_limit}>
                    <HintLabel htmlFor="tpm_limit" hint="每分钟 token 数。">
                      TPM
                    </HintLabel>
                    <RateLimitInput
                      id="tpm_limit"
                      value={tpmLimit}
                      onChange={setTpmLimit}
                      ariaInvalid={!!errors.tpm_limit}
                      placeholder="继承渠道默认限流"
                    />
                    <FieldError>{errors.tpm_limit}</FieldError>
                  </Field>
                  <Field data-invalid={!!errors.rpd_limit}>
                    <HintLabel htmlFor="rpd_limit" hint="每日请求数。">
                      RPD
                    </HintLabel>
                    <RateLimitInput
                      id="rpd_limit"
                      value={rpdLimit}
                      onChange={setRpdLimit}
                      ariaInvalid={!!errors.rpd_limit}
                      placeholder="继承渠道默认限流"
                    />
                    <FieldError>{errors.rpd_limit}</FieldError>
                  </Field>
                  <Field data-invalid={!!errors.concurrency_limit}>
                    <HintLabel
                      htmlFor="concurrency_limit"
                      hint="同时进行中的上游调用数（含整段流式传输）。慢上游 + 客户端自动重试时防止长请求堆积；每个在途请求都可能被上游计费。"
                    >
                      并发
                    </HintLabel>
                    <Input
                      id="concurrency_limit"
                      type="number"
                      min={0}
                      value={concurrencyLimit}
                      onChange={(e) => setConcurrencyLimit(e.target.value)}
                      placeholder="继承默认"
                      aria-invalid={!!errors.concurrency_limit}
                    />
                    <FieldError>{errors.concurrency_limit}</FieldError>
                  </Field>
                </div>
              </div>
            </Field>

            <Field>
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <HintLabel
                  htmlFor="bills_on_disconnect"
                  hint="上游在连接断开后仍会完成生成并计费（sub2api 类订阅中转）。打开后，失败/取消的请求会记入平台成本敞口（channel_cost_exposures），供成本对账；不影响路由与客户计费。"
                >
                  断开仍计费（bill-on-disconnect）
                </HintLabel>
                <Switch
                  id="bills_on_disconnect"
                  checked={billsOnDisconnect}
                  onCheckedChange={setBillsOnDisconnect}
                />
              </div>
            </Field>

            {!isEdit && (
              <Field>
                <HintLabel
                  htmlFor="status"
                  hint="启用后该渠道参与路由；停用则新请求不再走它（进行中的请求不受影响）。"
                >
                  状态
                </HintLabel>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status" className="w-full sm:max-w-xs">
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
            )}
          </FieldGroup>
        </ScrollArea>

        <DialogFooter className="mx-0 mb-0 border-t px-6 py-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mutation.isPending ? "保存中..." : isEdit ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </form>
      {isEdit && channel ? (
        <StatusChangeConfirmDialog
          open={statusConfirmOpen}
          onOpenChange={setStatusConfirmOpen}
          entityLabel="渠道"
          entityName={name.trim() || channel.name}
          enabling={status === "enabled"}
          pending={mutation.isPending}
          onConfirm={() => mutation.mutate()}
        />
      ) : null}
    </>
  );
}
