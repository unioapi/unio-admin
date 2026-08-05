import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RUNTIME_SETTINGS_QUERY_KEY,
  listSettings,
  updateSetting,
  type SettingItem,
} from "@/lib/api/system";
import { apiErrorMessage } from "@/lib/api/client";
import {
  RateLimitInput,
  composeRateLimit,
  decomposeRateLimit,
  rateLimitWithUnitError,
  type RateLimitFieldValue,
} from "@/components/common/rate-limit-input";
import { FieldHint, HintLabel } from "@/components/common/field-hint";
import {
  DurationInput,
  composeDurationMs,
  decomposeDurationMs,
  durationError,
} from "@/components/common/duration-input";
import { AnthropicBetaPolicyCard } from "@/components/system/AnthropicBetaPolicyCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// 运行时配置面板：按「域」分 Tab 渲染（batch2 §2/§6.2，对齐 new-api 设置页组织方式）。
//
// 域 = 注册表 Category = key 前缀：gateway（关键准入设置走 Redis control，其余由 applier 热更新）/
// admin_backend（admin 后端判定，现读 ≤3s 生效）/ admin_frontend（仅前端消费，保存即生效）/
// anthropic（Provider 策略）。未知域自动落「其他」Tab 用 JSON 兜底编辑器——新增域不改前端也能管。
//
// 数据流：listSettings 返回注册元数据 + 当前生效值 + 代码默认值 + 生效来源；
// 保存走 PUT /settings/{key}（后端按注册表校验）。value ≠ default 时显示「已偏离代码默认」——
// 启动 seed 写入 DB 后行即固化，后续代码默认值升级不会自动跟进，靠此标记提示人工决策。
//
// 单位约定（与渠道配置对齐）：时长一律「数字 + 时间单位下拉」入库 int 毫秒；
// 线路 RPD 用「数字 + K/M/B」（rate-limit-input）。

const SOURCE_LABEL: Record<string, string> = {
  redis: "Redis 实时源（消费方秒级读到）",
  db: "数据库（Redis 未命中时回退）",
  default: "内置默认（DB 尚无记录）",
};

const CRITICAL_SETTING_KEYS = new Set([
  "gateway.route_rate_limit_defaults",
  "gateway.concurrency_defaults",
  "gateway.circuit_breaker",
  "gateway.routing_balance",
]);

const RUNTIME_SYNC_COPY: Record<
  string,
  { label: string; destructive: boolean }
> = {
  active: { label: "运行态已激活", destructive: false },
  runtime_sync_pending: { label: "配置同步中", destructive: true },
  runtime_sync_required: { label: "待建立运行态", destructive: true },
  stale: { label: "运行态不一致", destructive: true },
  store_unavailable: { label: "基础设施故障", destructive: true },
  runtime_state_lost: { label: "运行态完整性丢失", destructive: true },
};

// 已知域 Tab（按此顺序展示）；未知 category 归入 other。
const DOMAIN_TABS: { value: string; label: string; hint: string }[] = [
  {
    value: "gateway",
    label: "网关",
    hint:
      "四个关键运行态控制以 Redis 激活版本为执行依据；其他网关设置由 applier 在约 5 秒内热更新",
  },
  {
    value: "admin_backend",
    label: "运营判定",
    hint: "admin 后端与渠道检测 worker 每请求现读，保存后约 3 秒内生效",
  },
  {
    value: "admin_frontend",
    label: "前端展示",
    hint: "仅前端消费的展示档位，保存后本页面立即生效",
  },
  {
    value: "anthropic",
    label: "Provider 策略",
    hint: "gateway adapter 现读，保存后秒级生效",
  },
];

/** 序无关深比较：Go 编码与前端编码的 JSON 键序可能不同，不能比字符串。 */
function jsonEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false;
    return a.every((v, i) => jsonEquals(v, b[i]));
  }
  if (typeof a === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) =>
      jsonEquals(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}

/** 运行时配置面板（分域 Tab）。 */
export function RuntimeSettingsPanel() {
  const query = useQuery({
    queryKey: RUNTIME_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => listSettings(signal),
  });

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{apiErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  }
  if (query.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    );
  }

  const items = query.data;
  const knownDomains = new Set(DOMAIN_TABS.map((t) => t.value));
  const otherItems = items.filter((s) => !knownDomains.has(s.category));
  const tabs = [
    ...DOMAIN_TABS,
    ...(otherItems.length > 0
      ? [{ value: "other", label: "其他", hint: "未识别域（JSON 兜底编辑）" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Alert className="py-2.5">
        <AlertTitle>运行时配置</AlertTitle>
        <AlertDescription>
          保存后免重启生效。偏离代码默认的项目会单独标记，来源、版本和默认值可在卡片底部展开查看。
        </AlertDescription>
      </Alert>
      <Tabs defaultValue="gateway">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => {
          const domainItems =
            t.value === "other"
              ? otherItems
              : items.filter((s) => s.category === t.value);
          return (
            <TabsContent
              key={t.value}
              value={t.value}
              className="flex flex-col gap-3 pt-3"
            >
              <p className="text-muted-foreground text-xs">{t.hint}</p>
              {/* anthropic 域的 beta 策略有专用 typed 卡片（含生效探针），生成式卡片跳过该 key。 */}
              {t.value === "anthropic" && <AnthropicBetaPolicyCard />}
              <div className="grid items-start gap-3 md:grid-cols-2">
                {domainItems
                  .filter((item) => item.key !== "anthropic.beta_policy")
                  .map((item) => (
                    <SettingCard key={item.key} item={item} />
                  ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function SettingCard({ item }: { item: SettingItem }) {
  const diverged = !jsonEquals(item.value, item.default);
  const critical = CRITICAL_SETTING_KEYS.has(item.key);
  const sourceLabel = critical
    ? item.source === "redis"
      ? "Redis 激活值"
      : item.source === "db"
        ? "数据库目标值（执行以 Redis 激活版本为准）"
        : "内置默认（尚未建立运行态）"
    : (SOURCE_LABEL[item.source] ?? item.source);
  return (
    <Card size="sm">
      <CardHeader className="gap-0">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {item.label}
          <FieldHint
            text={item.description}
            label={`${item.label}说明`}
          />
          {diverged && <Badge variant="secondary">已偏离代码默认</Badge>}
          {critical ? (
            <RuntimeControlBadge state={item.runtime_sync_state} />
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SettingEditor item={item} />
        <SettingDetails
          item={item}
          sourceLabel={sourceLabel}
          critical={critical}
        />
      </CardContent>
    </Card>
  );
}

function SettingDetails({
  item,
  sourceLabel,
  critical,
}: {
  item: SettingItem;
  sourceLabel: string;
  critical: boolean;
}) {
  return (
    <Accordion type="single" collapsible className="border-t">
      <AccordionItem value="details" className="border-0">
        <AccordionTrigger
          aria-label="配置详情"
          className="py-2 text-[11px] font-normal text-muted-foreground hover:no-underline"
        >
          <span>配置详情</span>
          <span className="ml-auto mr-2 hidden max-w-64 truncate sm:inline">
            {sourceLabel}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <dl className="grid gap-x-4 gap-y-2 text-[11px] leading-5 text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">生效来源</dt>
              <dd>{sourceLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">数据库版本</dt>
              <dd>v{item.revision || "—"}</dd>
            </div>
            {critical ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">Redis 版本</dt>
                <dd>
                  激活 v{item.runtime_active_revision || "—"} / 待提交 v
                  {item.runtime_pending_revision || "—"}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-foreground">当前值</dt>
              <dd className="mt-1 max-h-28 overflow-auto rounded-md bg-muted/50 p-2 font-mono break-all text-foreground">
                {JSON.stringify(item.value)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">代码默认</dt>
              <dd className="mt-1 max-h-28 overflow-auto rounded-md bg-muted/50 p-2 font-mono break-all text-foreground">
                {JSON.stringify(item.default)}
              </dd>
            </div>
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** 按 key 分派 typed 编辑器；未识别的 key 用 JSON 文本兜底（新配置项无前端也可管）。 */
function SettingEditor({ item }: { item: SettingItem }) {
  switch (item.key) {
    case "gateway.circuit_breaker":
      return <CircuitBreakerEditor item={item} />;
    case "gateway.route_rate_limit_defaults":
      return <RateLimitEditor item={item} />;
    case "gateway.concurrency_defaults":
      return <ConcurrencyDefaultsEditor item={item} />;
    case "gateway.routing_balance":
      return <RoutingBalanceEditor item={item} />;
    case "gateway.channel_ratelimit_cooldown":
      return <CooldownEditor item={item} />;
    case "gateway.routing_sticky":
      return <RoutingStickyEditor item={item} />;
    case "gateway.stream_idle_timeout_ms":
    case "gateway.default_response_timeout_ms":
    case "gateway.default_first_token_timeout_ms":
    case "gateway.capacity_wait_timeout_ms":
      return <DurationMsEditor item={item} />;
    case "gateway.credential_401_threshold":
      return <PositiveIntEditor item={item} label="阈值（次）" />;
    case "admin_backend.channel_test":
      return <ChannelTestEditor item={item} />;
    case "admin_frontend.dashboard_thresholds":
      return <DashboardThresholdsEditor item={item} />;
    default:
      return <RawJSONEditor item={item} />;
  }
}

/** 保存 mutation 的共享封装：成功后刷新列表（含生效来源与偏离标记）。 */
function useSaveSetting(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: unknown) => updateSetting(key, value),
    onSuccess: (result) => {
      if (result.state === "runtime_sync_pending") {
        toast.warning(
          `数据库已保存为 v${result.revision}，运行态同步中；同步完成前新准入保持拒绝`,
        );
      } else if (result.state === "active") {
        toast.success(
          `已保存并激活 v${result.active_revision || result.revision}`,
        );
      } else {
        toast.success("已保存");
      }
      void queryClient.invalidateQueries({
        queryKey: RUNTIME_SETTINGS_QUERY_KEY,
      });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

function RuntimeControlBadge({ state }: { state?: string }) {
  const copy = RUNTIME_SYNC_COPY[state ?? "runtime_sync_required"] ?? {
    label: state || "待建立运行态",
    destructive: true,
  };
  return (
    <Badge variant={copy.destructive ? "destructive" : "outline"}>
      {copy.label}
    </Badge>
  );
}

function SaveReset({
  saving,
  saveDisabled = false,
  onSave,
  onReset,
}: {
  saving: boolean;
  saveDisabled?: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" onClick={onSave} disabled={saving || saveDisabled}>
        {saving ? "保存中…" : "保存"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onReset} disabled={saving}>
        恢复默认
      </Button>
    </div>
  );
}

// ---- gateway.circuit_breaker ----

interface CircuitBreakerValue {
  enabled: boolean;
  window_ms: number;
  min_requests: number;
  failure_ratio: number;
  consecutive_failures: number;
  consecutive_window_ms: number;
  half_open_successes: number;
  attempt_permit_ttl_ms: number;
  attempt_permit_renew_interval_ms: number;
  attempt_permit_terminal_ttl_ms: number;
  origin_revision_operation_ttl_ms: number;
  status_revision_operation_ttl_ms: number;
  open_durations_ms: number[];
  provider_ambiguous_distinct_channels: number;
  provider_ambiguous_distinct_models: number;
}

function CircuitBreakerEditor({ item }: { item: SettingItem }) {
  const server = item.value as CircuitBreakerValue;
  const defaults = item.default as CircuitBreakerValue;
  const [enabled, setEnabled] = useState(server.enabled);
  const [window_, setWindow] = useState(() =>
    decomposeDurationMs(server.window_ms),
  );
  const [minRequests, setMinRequests] = useState(String(server.min_requests));
  const [failureRatio, setFailureRatio] = useState(
    String(server.failure_ratio),
  );
  const [consecutiveFailures, setConsecutiveFailures] = useState(
    String(server.consecutive_failures),
  );
  const [consecutiveWindow, setConsecutiveWindow] = useState(() =>
    decomposeDurationMs(server.consecutive_window_ms),
  );
  const [halfOpenSuccesses, setHalfOpenSuccesses] = useState(
    String(server.half_open_successes),
  );
  const [permitTTL, setPermitTTL] = useState(() =>
    decomposeDurationMs(server.attempt_permit_ttl_ms),
  );
  const [permitRenew, setPermitRenew] = useState(() =>
    decomposeDurationMs(server.attempt_permit_renew_interval_ms),
  );
  const [permitTerminalTTL, setPermitTerminalTTL] = useState(() =>
    decomposeDurationMs(server.attempt_permit_terminal_ttl_ms),
  );
  const [baseURLOperationTTL, setBaseURLOperationTTL] = useState(() =>
    decomposeDurationMs(server.origin_revision_operation_ttl_ms),
  );
  const [statusOperationTTL, setStatusOperationTTL] = useState(() =>
    decomposeDurationMs(server.status_revision_operation_ttl_ms),
  );
  const [openDurations, setOpenDurations] = useState(
    server.open_durations_ms.join(", "),
  );
  const [ambiguousChannels, setAmbiguousChannels] = useState(
    String(server.provider_ambiguous_distinct_channels),
  );
  const [ambiguousModels, setAmbiguousModels] = useState(
    String(server.provider_ambiguous_distinct_models),
  );
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setEnabled(defaults.enabled);
    setWindow(decomposeDurationMs(defaults.window_ms));
    setMinRequests(String(defaults.min_requests));
    setFailureRatio(String(defaults.failure_ratio));
    setConsecutiveFailures(String(defaults.consecutive_failures));
    setConsecutiveWindow(decomposeDurationMs(defaults.consecutive_window_ms));
    setHalfOpenSuccesses(String(defaults.half_open_successes));
    setPermitTTL(decomposeDurationMs(defaults.attempt_permit_ttl_ms));
    setPermitRenew(
      decomposeDurationMs(defaults.attempt_permit_renew_interval_ms),
    );
    setPermitTerminalTTL(
      decomposeDurationMs(defaults.attempt_permit_terminal_ttl_ms),
    );
    setBaseURLOperationTTL(
      decomposeDurationMs(defaults.origin_revision_operation_ttl_ms),
    );
    setStatusOperationTTL(
      decomposeDurationMs(defaults.status_revision_operation_ttl_ms),
    );
    setOpenDurations(defaults.open_durations_ms.join(", "));
    setAmbiguousChannels(String(defaults.provider_ambiguous_distinct_channels));
    setAmbiguousModels(String(defaults.provider_ambiguous_distinct_models));
  };

  const save = () => {
    const err =
      durationError(window_, false) ??
      durationError(consecutiveWindow, false) ??
      durationError(permitTTL, false) ??
      durationError(permitRenew, false) ??
      durationError(permitTerminalTTL, false) ??
      durationError(baseURLOperationTTL, false) ??
      durationError(statusOperationTTL, false);
    if (err) {
      toast.error(`时长：${err}`);
      return;
    }
    const parsedOpenDurations = openDurations
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
    const integers = [
      Number(minRequests),
      Number(consecutiveFailures),
      Number(halfOpenSuccesses),
      Number(ambiguousChannels),
      Number(ambiguousModels),
    ];
    if (integers.some((value) => !Number.isInteger(value) || value < 1)) {
      toast.error("计数阈值需为正整数");
      return;
    }
    if (Number(minRequests) < 2 || Number(halfOpenSuccesses) < 2) {
      toast.error("最小样本数和半开成功数必须至少为 2");
      return;
    }
    if (Number(ambiguousChannels) < 2 || Number(ambiguousModels) < 2) {
      toast.error("Provider 模糊归因的渠道数和模型数必须至少为 2");
      return;
    }
    if (
      parsedOpenDurations.length === 0 ||
      parsedOpenDurations.some(
        (value, index) =>
          !Number.isInteger(value) ||
          value <= 0 ||
          (index > 0 && value < parsedOpenDurations[index - 1]),
      )
    ) {
      toast.error("退避时长需为逗号分隔、递增的正整数毫秒");
      return;
    }
    const permitTTLms = composeDurationMs(permitTTL);
    const permitRenewMs = composeDurationMs(permitRenew);
    const permitTerminalTTLms = composeDurationMs(permitTerminalTTL);
    if (permitRenewMs * 3 > permitTTLms || permitTerminalTTLms < permitTTLms) {
      toast.error("续租间隔的 3 倍不能超过租约，终态保留时间不能短于租约");
      return;
    }
    const ratio = Number(failureRatio);
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
      toast.error("失败率阈值需在 (0,1] 内");
      return;
    }
    mutation.mutate({
      enabled,
      window_ms: composeDurationMs(window_),
      min_requests: Number(minRequests),
      failure_ratio: ratio,
      consecutive_failures: Number(consecutiveFailures),
      consecutive_window_ms: composeDurationMs(consecutiveWindow),
      half_open_successes: Number(halfOpenSuccesses),
      attempt_permit_ttl_ms: permitTTLms,
      attempt_permit_renew_interval_ms: permitRenewMs,
      attempt_permit_terminal_ttl_ms: permitTerminalTTLms,
      origin_revision_operation_ttl_ms:
        composeDurationMs(baseURLOperationTTL),
      status_revision_operation_ttl_ms:
        composeDurationMs(statusOperationTTL),
      open_durations_ms: parsedOpenDurations,
      provider_ambiguous_distinct_channels: Number(ambiguousChannels),
      provider_ambiguous_distinct_models: Number(ambiguousModels),
    } satisfies CircuitBreakerValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <HintLabel
          htmlFor={`${item.key}-enabled`}
          hint="总开关。关掉后所有渠道照常走，也不记成功/失败；打开后才统计并可能摘除渠道。"
        >
          启用熔断
        </HintLabel>
        <Switch
          id={`${item.key}-enabled`}
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="在固定时间窗里数成功/失败。窗口一过，计数清零重算。例：最近一个窗口内该渠道的请求结果。">
            统计窗口
          </HintLabel>
          <DurationInput value={window_} onChange={setWindow} />
        </div>
        <FieldText
          label="最小请求数（次）"
          hint="窗口里请求太少就不熔断，避免偶然 1～2 次失败就误伤。例：窗口内只有 5 次请求，即使全失败也不会跳闸。"
          value={minRequests}
          onChange={setMinRequests}
          inputMode="numeric"
        />
        <FieldText
          label="失败比例阈值 (0,1]"
          hint="样本够了之后：失败数 / 总请求数 ≥ 该阈值就熔断。例：窗口内 20 次里至少 10 次失败（阈值 0.5）→ 该渠道进入「打开」状态，后续选路会跳过它。"
          value={failureRatio}
          onChange={setFailureRatio}
          inputMode="decimal"
        />
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="在这段短窗口内连续达到失败次数，也会立即熔断，不必等待比例样本凑齐。">
            连续失败窗口
          </HintLabel>
          <DurationInput
            value={consecutiveWindow}
            onChange={setConsecutiveWindow}
          />
        </div>
        <FieldText
          label="连续失败次数"
          value={consecutiveFailures}
          onChange={setConsecutiveFailures}
          inputMode="numeric"
        />
        <FieldText
          label="半开恢复成功数"
          value={halfOpenSuccesses}
          onChange={setHalfOpenSuccesses}
          inputMode="numeric"
        />
        <FieldText
          label="退避时长（毫秒，逗号分隔）"
          hint="每次再次熔断按顺序使用，最后一档封顶。"
          value={openDurations}
          onChange={setOpenDurations}
        />
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="AttemptPermit 的活动租约；长流会按续租间隔自动续期。">
            Permit 租约
          </HintLabel>
          <DurationInput value={permitTTL} onChange={setPermitTTL} />
        </div>
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="活动 permit 的续租周期，三倍周期不能超过租约。">
            Permit 续租间隔
          </HintLabel>
          <DurationInput value={permitRenew} onChange={setPermitRenew} />
        </div>
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="终态记录保留时间，用于幂等重试和迟到结果判定。">
            Permit 终态保留
          </HintLabel>
          <DurationInput
            value={permitTerminalTTL}
            onChange={setPermitTerminalTTL}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="Provider 地址变更操作的可恢复窗口。">
            地址操作保留
          </HintLabel>
          <DurationInput
            value={baseURLOperationTTL}
            onChange={setBaseURLOperationTTL}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="Provider 状态变更操作的可恢复窗口。">
            状态操作保留
          </HintLabel>
          <DurationInput
            value={statusOperationTTL}
            onChange={setStatusOperationTTL}
          />
        </div>
        <FieldText
          label="Provider 归因最少渠道"
          value={ambiguousChannels}
          onChange={setAmbiguousChannels}
          inputMode="numeric"
        />
        <FieldText
          label="Provider 归因最少模型"
          value={ambiguousModels}
          onChange={setAmbiguousModels}
          inputMode="numeric"
        />
      </div>
      <SaveReset saving={mutation.isPending} onSave={save} onReset={reset} />
    </div>
  );
}

// ---- gateway.routing_sticky ----

interface RoutingStickyValue {
  enabled_default: boolean;
  ttl_ms: number;
}

function RoutingStickyEditor({ item }: { item: SettingItem }) {
  const server = item.value as RoutingStickyValue;
  const defaults = item.default as RoutingStickyValue;
  const [enabledDefault, setEnabledDefault] = useState(server.enabled_default);
  const [ttl, setTtl] = useState(() => decomposeDurationMs(server.ttl_ms));
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setEnabledDefault(defaults.enabled_default);
    setTtl(decomposeDurationMs(defaults.ttl_ms));
  };

  const save = () => {
    const err = durationError(ttl, false);
    if (err) {
      toast.error(`粘性 TTL：${err}`);
      return;
    }
    mutation.mutate({
      enabled_default: enabledDefault,
      ttl_ms: composeDurationMs(ttl),
    } satisfies RoutingStickyValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <HintLabel
          htmlFor={`${item.key}-enabled`}
          hint="渠道选择「系统默认」时使用。打开后，同会话请求会优先复用上次成功渠道；粘住渠道故障时仍会自动切换。"
        >
          渠道默认开启会话粘性
        </HintLabel>
        <Switch
          id={`${item.key}-enabled`}
          checked={enabledDefault}
          onCheckedChange={setEnabledDefault}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <HintLabel hint="仅原绑定渠道完整成功时滑动续期；临时绕行不会改绑或续期，到期后重新按线路策略选择。">
          粘性 TTL
        </HintLabel>
        <DurationInput value={ttl} onChange={setTtl} />
      </div>
      <SaveReset saving={mutation.isPending} onSave={save} onReset={reset} />
    </div>
  );
}

// ---- gateway.route_rate_limit_defaults ----

// 线路默认限流只有 RPM 与 RPD：Unio 不限制 TPM，token 吞吐只做观测。
interface RateLimitValue {
  rpm: number;
  rpd: number;
}

function RateLimitEditor({ item }: { item: SettingItem }) {
  const server = item.value as RateLimitValue;
  const defaults = item.default as RateLimitValue;
  const [rpm, setRpm] = useState(String(server.rpm));
  const [rpd, setRpd] = useState<RateLimitFieldValue>(() =>
    decomposeRateLimit(server.rpd),
  );
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setRpm(String(defaults.rpm));
    setRpd(decomposeRateLimit(defaults.rpd));
  };

  const save = () => {
    // 默认值没有「继承」语义（它就是兜底），故不允许留空；0=不限。
    for (const [label, v] of [["RPD", rpd]] as const) {
      const err = rateLimitWithUnitError(v);
      if (err) {
        toast.error(`${label}：${err}`);
        return;
      }
      if (composeRateLimit(v) == null) {
        toast.error(`${label} 不能留空（0=不限）`);
        return;
      }
    }
    mutation.mutate({
      rpm: Number(rpm),
      rpd: composeRateLimit(rpd) as number,
    } satisfies RateLimitValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3">
        <FieldText
          label="RPM（次/分钟，0=不限）"
          value={rpm}
          onChange={setRpm}
          inputMode="numeric"
        />
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">RPD（次/天，0=不限）</Label>
          <RateLimitInput value={rpd} onChange={setRpd} placeholder="0" />
        </div>
      </div>
      <Alert>
        <AlertTitle>线路限流命中后直接返回 429</AlertTitle>
        <AlertDescription>
          在线路未单独设置限额时使用；RPM 与 RPD 都在请求入口执行，命中直接返回 429。
          这里没有 TPM：Unio 不主动限制 token 吞吐，上游容量不足只由真实 429、渠道冷却和熔断表达；
          线路与渠道的 TPM 都只是观测值，不参与拦截和评分。
        </AlertDescription>
      </Alert>
      <SaveReset saving={mutation.isPending} onSave={save} onReset={reset} />
    </div>
  );
}

interface ConcurrencyDefaultsValue {
  key_limit: number;
  channel_limit: number;
}

function ConcurrencyDefaultsEditor({ item }: { item: SettingItem }) {
  const server = item.value as ConcurrencyDefaultsValue;
  const defaults = item.default as ConcurrencyDefaultsValue;
  const [keyLimit, setKeyLimit] = useState(String(server.key_limit));
  const [channelLimit, setChannelLimit] = useState(
    String(server.channel_limit),
  );
  const mutation = useSaveSetting(item.key);

  const save = () => {
    const key = Number(keyLimit);
    const channel = Number(channelLimit);
    if (
      !Number.isInteger(key) ||
      key < 0 ||
      !Number.isInteger(channel) ||
      channel < 0
    ) {
      toast.error("并发上限需为大于等于 0 的整数");
      return;
    }
    mutation.mutate({
      key_limit: key,
      channel_limit: channel,
    } satisfies ConcurrencyDefaultsValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldText
          label="线路用户并发（0=不限）"
          hint="同一线路、同一用户同时进行中的客户请求上限。"
          value={keyLimit}
          onChange={setKeyLimit}
          inputMode="numeric"
        />
        <FieldText
          label="渠道并发（0=不限）"
          hint="同一渠道同时进行中的上游调用上限，渠道可单独覆盖。"
          value={channelLimit}
          onChange={setChannelLimit}
          inputMode="numeric"
        />
      </div>
      <SaveReset
        saving={mutation.isPending}
        onSave={save}
        onReset={() => {
          setKeyLimit(String(defaults.key_limit));
          setChannelLimit(String(defaults.channel_limit));
        }}
      />
    </div>
  );
}

interface RoutingBalanceValue {
  cost_weight_pct: number;
  concurrency_weight_pct: number;
  ttft_weight_pct: number;
  error_rate_weight_pct: number;
  priority_weight_pct: number;
  ttft_window_ms: number;
  ttft_penalty_unit_ms: number;
  ttft_penalty_points_per_unit: number;
  error_window_ms: number;
  error_penalty_points_per_percent: number;
}

function RoutingBalanceEditor({ item }: { item: SettingItem }) {
  const server = item.value as RoutingBalanceValue;
  const defaults = item.default as RoutingBalanceValue;
  const [costWeight, setCostWeight] = useState(String(server.cost_weight_pct));
  const [concurrencyWeight, setConcurrencyWeight] = useState(
    String(server.concurrency_weight_pct),
  );
  const [ttftWeight, setTTFTWeight] = useState(String(server.ttft_weight_pct));
  const [errorWeight, setErrorWeight] = useState(
    String(server.error_rate_weight_pct),
  );
  const [priorityWeight, setPriorityWeight] = useState(
    String(server.priority_weight_pct),
  );
  const [ttftWindow, setTTFTWindow] = useState(() =>
    decomposeDurationMs(server.ttft_window_ms),
  );
  const [ttftPenaltyUnit, setTTFTPenaltyUnit] = useState(() =>
    decomposeDurationMs(server.ttft_penalty_unit_ms),
  );
  const [ttftPenaltyPoints, setTTFTPenaltyPoints] = useState(
    String(server.ttft_penalty_points_per_unit),
  );
  const [errorWindow, setErrorWindow] = useState(() =>
    decomposeDurationMs(server.error_window_ms),
  );
  const [errorPenaltyPoints, setErrorPenaltyPoints] = useState(
    String(server.error_penalty_points_per_percent),
  );
  const mutation = useSaveSetting(item.key);
  const parsedWeights = [
    costWeight,
    concurrencyWeight,
    ttftWeight,
    errorWeight,
    priorityWeight,
  ].map(Number);
  const weightsInRange = parsedWeights.every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 100,
  );
  const weightTotal = parsedWeights.reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0,
  );
  const weightsValid = weightsInRange && weightTotal === 100;

  const save = () => {
    const windowError =
      durationError(ttftWindow, false) ??
      durationError(ttftPenaltyUnit, false) ??
      durationError(errorWindow, false);
    if (windowError) {
      toast.error(`评分时长：${windowError}`);
      return;
    }
    const ttftPoints = Number(ttftPenaltyPoints);
    const errorPoints = Number(errorPenaltyPoints);
    if (
      !Number.isFinite(ttftPoints) ||
      ttftPoints <= 0 ||
      ttftPoints > 100 ||
      !Number.isFinite(errorPoints) ||
      errorPoints <= 0 ||
      errorPoints > 100
    ) {
      toast.error("TTFT 与错误率的惩罚分必须在 (0, 100] 内");
      return;
    }
    if (!weightsValid) {
      toast.error("五项评分权重必须为 0–100 的整数，且合计为 100%");
      return;
    }
    mutation.mutate({
      cost_weight_pct: parsedWeights[0],
      concurrency_weight_pct: parsedWeights[1],
      ttft_weight_pct: parsedWeights[2],
      error_rate_weight_pct: parsedWeights[3],
      priority_weight_pct: parsedWeights[4],
      ttft_window_ms: composeDurationMs(ttftWindow),
      ttft_penalty_unit_ms: composeDurationMs(ttftPenaltyUnit),
      ttft_penalty_points_per_unit: ttftPoints,
      error_window_ms: composeDurationMs(errorWindow),
      error_penalty_points_per_percent: errorPoints,
    } satisfies RoutingBalanceValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <AlertTitle>客观评分确定性排序</AlertTitle>
        <AlertDescription>
          候选按成本、并发容量、TTFT、错误率、Priority 五项总分排序；同分时按
          Priority、渠道 ID 排序。TTFT 和错误率使用时间窗口，无样本时对应指标按满分计算。
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldText id="cost_weight_pct" label="成本权重（%）" value={costWeight} onChange={setCostWeight} inputMode="numeric" />
        <FieldText id="concurrency_weight_pct" label="并发容量权重（%）" value={concurrencyWeight} onChange={setConcurrencyWeight} inputMode="numeric" />
        <FieldText id="ttft_weight_pct" label="上游 TTFT 权重（%）" value={ttftWeight} onChange={setTTFTWeight} inputMode="numeric" />
        <FieldText id="error_rate_weight_pct" label="错误率权重（%）" value={errorWeight} onChange={setErrorWeight} inputMode="numeric" />
        <FieldText id="priority_weight_pct" label="Priority 权重（%）" value={priorityWeight} onChange={setPriorityWeight} inputMode="numeric" />
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="只读取该时间范围内已完成请求的流式上游首字样本。">
            上游 TTFT 样本窗口
          </HintLabel>
          <DurationInput value={ttftWindow} onChange={setTTFTWindow} />
        </div>
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="平均上游 TTFT 每增加一个单位，就按下方配置扣除指标分。">
            上游 TTFT 惩罚单位
          </HintLabel>
          <DurationInput value={ttftPenaltyUnit} onChange={setTTFTPenaltyUnit} />
        </div>
        <FieldText label="每单位上游 TTFT 扣分" value={ttftPenaltyPoints} onChange={setTTFTPenaltyPoints} inputMode="decimal" />
        <div className="flex flex-col gap-1.5">
          <HintLabel hint="只读取该时间范围内已完成 attempt 的成功和失败样本。">
            错误率样本窗口
          </HintLabel>
          <DurationInput value={errorWindow} onChange={setErrorWindow} />
        </div>
        <FieldText label="错误率每 1% 扣分" value={errorPenaltyPoints} onChange={setErrorPenaltyPoints} inputMode="decimal" />
      </div>
      <Alert variant={weightsValid ? "default" : "destructive"}>
        <AlertTitle>评分权重合计：{weightTotal}%</AlertTitle>
        <AlertDescription>
          {weightsValid ? "配置有效。" : "五项必须是 0–100 的整数，且合计正好为 100%。"}
        </AlertDescription>
      </Alert>
      <SaveReset
        saving={mutation.isPending}
        saveDisabled={!weightsValid}
        onSave={save}
        onReset={() => {
          setCostWeight(String(defaults.cost_weight_pct));
          setConcurrencyWeight(String(defaults.concurrency_weight_pct));
          setTTFTWeight(String(defaults.ttft_weight_pct));
          setErrorWeight(String(defaults.error_rate_weight_pct));
          setPriorityWeight(String(defaults.priority_weight_pct));
          setTTFTWindow(decomposeDurationMs(defaults.ttft_window_ms));
          setTTFTPenaltyUnit(decomposeDurationMs(defaults.ttft_penalty_unit_ms));
          setTTFTPenaltyPoints(String(defaults.ttft_penalty_points_per_unit));
          setErrorWindow(decomposeDurationMs(defaults.error_window_ms));
          setErrorPenaltyPoints(String(defaults.error_penalty_points_per_percent));
        }}
      />
    </div>
  );
}

// ---- gateway.channel_ratelimit_cooldown ----

interface CooldownValue {
  cooldown_ms: number;
  cap_ms: number;
}

function CooldownEditor({ item }: { item: SettingItem }) {
  const server = item.value as CooldownValue;
  const defaults = item.default as CooldownValue;
  const [cooldown, setCooldown] = useState(() =>
    decomposeDurationMs(server.cooldown_ms),
  );
  const [cap, setCap] = useState(() => decomposeDurationMs(server.cap_ms));
  const mutation = useSaveSetting(item.key);

  const save = () => {
    const err = durationError(cooldown, true) ?? durationError(cap, true);
    if (err) {
      toast.error(`时长：${err}（0=关闭/不封顶）`);
      return;
    }
    mutation.mutate({
      cooldown_ms: composeDurationMs(cooldown),
      cap_ms: composeDurationMs(cap),
    } satisfies CooldownValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">
            默认冷却（无 Retry-After，0=不冷却）
          </Label>
          <DurationInput value={cooldown} onChange={setCooldown} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">冷却封顶（0=不封顶）</Label>
          <DurationInput value={cap} onChange={setCap} />
        </div>
      </div>
      <SaveReset
        saving={mutation.isPending}
        onSave={save}
        onReset={() => {
          setCooldown(decomposeDurationMs(defaults.cooldown_ms));
          setCap(decomposeDurationMs(defaults.cap_ms));
        }}
      />
    </div>
  );
}

// ---- int 毫秒标量（响应 / 首字 / 流式 idle / 全池短等）----

function DurationMsEditor({ item }: { item: SettingItem }) {
  const server = item.value as number;
  const defaults = item.default as number;
  const [value, setValue] = useState(() => decomposeDurationMs(server));
  const mutation = useSaveSetting(item.key);
  const allowZero = item.key === "gateway.capacity_wait_timeout_ms";

  const save = () => {
    const err = durationError(value, allowZero);
    if (err) {
      toast.error(`时长：${err}${allowZero ? "（0=关闭短等）" : ""}`);
      return;
    }
    mutation.mutate(composeDurationMs(value));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">时长{allowZero ? "（0=关闭）" : ""}</Label>
        <DurationInput value={value} onChange={setValue} />
      </div>
      <SaveReset
        saving={mutation.isPending}
        onSave={save}
        onReset={() => setValue(decomposeDurationMs(defaults))}
      />
    </div>
  );
}

// ---- 正整数单值 ----

function PositiveIntEditor({
  item,
  label = "数值",
}: {
  item: SettingItem;
  label?: string;
}) {
  const server = item.value as number;
  const defaults = item.default as number;
  const [value, setValue] = useState(String(server));
  const mutation = useSaveSetting(item.key);

  return (
    <div className="flex flex-col gap-3">
      <FieldText
        label={label}
        value={value}
        onChange={setValue}
        inputMode="numeric"
      />
      <SaveReset
        saving={mutation.isPending}
        onSave={() => mutation.mutate(Number(value))}
        onReset={() => setValue(String(defaults))}
      />
    </div>
  );
}

// ---- admin_backend.channel_test ----

interface ChannelTestValue {
  enabled: boolean;
  interval_ms: number;
  probe_timeout_ms: number;
  log_retention_per_channel: number;
}

function ChannelTestEditor({ item }: { item: SettingItem }) {
  const server = item.value as ChannelTestValue;
  const defaults = item.default as ChannelTestValue;
  const [enabled, setEnabled] = useState(server.enabled);
  const [interval, setInterval] = useState(() =>
    decomposeDurationMs(server.interval_ms),
  );
  const [probeTimeout, setProbeTimeout] = useState(() =>
    decomposeDurationMs(server.probe_timeout_ms),
  );
  const [retention, setRetention] = useState(
    String(server.log_retention_per_channel),
  );
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setEnabled(defaults.enabled);
    setInterval(decomposeDurationMs(defaults.interval_ms));
    setProbeTimeout(decomposeDurationMs(defaults.probe_timeout_ms));
    setRetention(String(defaults.log_retention_per_channel));
  };

  const save = () => {
    const err =
      durationError(interval, false) ??
      durationError(probeTimeout, false) ??
      (() => {
        const n = Number(retention);
        if (retention.trim() === "" || !Number.isFinite(n) || n <= 0) {
          return "日志保留条数须为大于 0 的整数";
        }
        return undefined;
      })();
    if (err) {
      toast.error(err);
      return;
    }
    mutation.mutate({
      enabled,
      interval_ms: composeDurationMs(interval),
      probe_timeout_ms: composeDurationMs(probeTimeout),
      log_retention_per_channel: Number(retention),
    } satisfies ChannelTestValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={`${item.key}-enabled`}>启用自动巡检</Label>
        <Switch
          id={`${item.key}-enabled`}
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">巡检间隔</Label>
          <DurationInput value={interval} onChange={setInterval} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">探测超时</Label>
          <DurationInput value={probeTimeout} onChange={setProbeTimeout} />
        </div>
        <FieldText
          label="日志保留条数（每渠道）"
          value={retention}
          onChange={setRetention}
          inputMode="numeric"
        />
      </div>
      <SaveReset saving={mutation.isPending} onSave={save} onReset={reset} />
    </div>
  );
}

/** 比率输入的通用前端预检（服务端注册表校验仍是权威）。 */
function rateError(s: string, label: string): string | undefined {
  const n = Number(s);
  if (s.trim() === "" || !Number.isFinite(n)) return `${label}：请输入数字`;
  if (n <= 0 || n > 1) return `${label}：需在 (0, 1] 内`;
  return undefined;
}

// ---- admin_frontend.dashboard_thresholds ----

interface DashboardThresholdsValue {
  success_rate_slo: number;
  success_rate_warn: number;
  ttft_warn_ms: number;
  ttft_danger_ms: number;
  latency_warn_ms: number;
  latency_danger_ms: number;
  profit_thin_rate: number;
}

function DashboardThresholdsEditor({ item }: { item: SettingItem }) {
  const server = item.value as DashboardThresholdsValue;
  const defaults = item.default as DashboardThresholdsValue;
  const [slo, setSlo] = useState(String(server.success_rate_slo));
  const [warn, setWarn] = useState(String(server.success_rate_warn));
  const [ttftWarn, setTtftWarn] = useState(() =>
    decomposeDurationMs(server.ttft_warn_ms),
  );
  const [ttftDanger, setTtftDanger] = useState(() =>
    decomposeDurationMs(server.ttft_danger_ms),
  );
  const [latWarn, setLatWarn] = useState(() =>
    decomposeDurationMs(server.latency_warn_ms),
  );
  const [latDanger, setLatDanger] = useState(() =>
    decomposeDurationMs(server.latency_danger_ms),
  );
  const [profitThin, setProfitThin] = useState(String(server.profit_thin_rate));
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setSlo(String(defaults.success_rate_slo));
    setWarn(String(defaults.success_rate_warn));
    setTtftWarn(decomposeDurationMs(defaults.ttft_warn_ms));
    setTtftDanger(decomposeDurationMs(defaults.ttft_danger_ms));
    setLatWarn(decomposeDurationMs(defaults.latency_warn_ms));
    setLatDanger(decomposeDurationMs(defaults.latency_danger_ms));
    setProfitThin(String(defaults.profit_thin_rate));
  };

  const save = () => {
    const err =
      rateError(slo, "成功率 SLO") ??
      rateError(warn, "成功率警戒") ??
      durationError(ttftWarn, false) ??
      durationError(ttftDanger, false) ??
      durationError(latWarn, false) ??
      durationError(latDanger, false);
    if (err) {
      toast.error(err);
      return;
    }
    const profit = Number(profitThin);
    if (
      profitThin.trim() === "" ||
      !Number.isFinite(profit) ||
      profit < 0 ||
      profit >= 1
    ) {
      toast.error("毛利偏薄线需在 [0, 1) 内（0=关闭）");
      return;
    }
    if (Number(warn) >= Number(slo)) {
      toast.error("成功率警戒线必须低于 SLO 线");
      return;
    }
    if (composeDurationMs(ttftWarn) >= composeDurationMs(ttftDanger)) {
      toast.error("TTFT 注意线必须低于异常线");
      return;
    }
    if (composeDurationMs(latWarn) >= composeDurationMs(latDanger)) {
      toast.error("延迟注意线必须低于异常线");
      return;
    }
    mutation.mutate({
      success_rate_slo: Number(slo),
      success_rate_warn: Number(warn),
      ttft_warn_ms: composeDurationMs(ttftWarn),
      ttft_danger_ms: composeDurationMs(ttftDanger),
      latency_warn_ms: composeDurationMs(latWarn),
      latency_danger_ms: composeDurationMs(latDanger),
      profit_thin_rate: profit,
    } satisfies DashboardThresholdsValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldText
          label="成功率 SLO（绿线）"
          value={slo}
          onChange={setSlo}
          inputMode="decimal"
          placeholder="0.95"
        />
        <FieldText
          label="成功率警戒（黄线下界）"
          value={warn}
          onChange={setWarn}
          inputMode="decimal"
          placeholder="0.8"
        />
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">TTFT 注意线（P95）</Label>
          <DurationInput value={ttftWarn} onChange={setTtftWarn} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">TTFT 异常线（P95）</Label>
          <DurationInput value={ttftDanger} onChange={setTtftDanger} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">延迟注意线（P95）</Label>
          <DurationInput value={latWarn} onChange={setLatWarn} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">延迟异常线（P95）</Label>
          <DurationInput value={latDanger} onChange={setLatDanger} />
        </div>
        <FieldText
          label="毛利偏薄线（比率，0=关闭）"
          value={profitThin}
          onChange={setProfitThin}
          inputMode="decimal"
          placeholder="0.1"
        />
      </div>
      <SaveReset saving={mutation.isPending} onSave={save} onReset={reset} />
    </div>
  );
}

// ---- 未识别 key 的 JSON 兜底编辑器 ----

function RawJSONEditor({ item }: { item: SettingItem }) {
  const server = useMemo(
    () => JSON.stringify(item.value, null, 2),
    [item.value],
  );
  const defaultsText = useMemo(
    () => JSON.stringify(item.default, null, 2),
    [item.default],
  );
  const [text, setText] = useState(server);
  const mutation = useSaveSetting(item.key);

  const save = () => {
    try {
      mutation.mutate(JSON.parse(text));
    } catch {
      toast.error("不是合法的 JSON");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="border-input bg-transparent w-full rounded-md border px-3 py-2 font-mono text-xs"
      />
      <SaveReset
        saving={mutation.isPending}
        onSave={save}
        onReset={() => setText(defaultsText)}
      />
    </div>
  );
}

function FieldText({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  id?: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {hint ? (
        <HintLabel htmlFor={id} hint={hint}>{label}</HintLabel>
      ) : (
        <Label htmlFor={id} className="text-xs">{label}</Label>
      )}
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}
