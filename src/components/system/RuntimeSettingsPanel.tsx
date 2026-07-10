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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 运行时配置面板：按「域」分 Tab 渲染（batch2 §2/§6.2，对齐 new-api 设置页组织方式）。
//
// 域 = 注册表 Category = key 前缀：gateway（网关热路径，applier ~5s 热生效）/
// admin_backend（admin 后端判定，现读 ≤3s 生效）/ admin_frontend（仅前端消费，保存即生效）/
// anthropic（Provider 策略）。未知域自动落「其他」Tab 用 JSON 兜底编辑器——新增域不改前端也能管。
//
// 数据流：listSettings 返回注册元数据 + 当前生效值 + 代码默认值 + 生效来源；
// 保存走 PUT /settings/{key}（后端按注册表校验）。value ≠ default 时显示「已偏离代码默认」——
// 启动 seed 写入 DB 后行即固化，后续代码默认值升级不会自动跟进，靠此标记提示人工决策。
//
// 单位约定（与渠道配置对齐）：时长一律「数字 + 时间单位下拉」入库 int 毫秒（对齐
// channels.timeout_ms）；TPM/RPD 用「数字 + K/M/B」（rate-limit-input，与渠道页同款）。

const SOURCE_LABEL: Record<string, string> = {
  redis: "Redis 实时源（消费方秒级读到）",
  db: "数据库（Redis 未命中时回退）",
  default: "内置默认（DB 尚无记录）",
};

// 已知域 Tab（按此顺序展示）；未知 category 归入 other。
const DOMAIN_TABS: { value: string; label: string; hint: string }[] = [
  { value: "gateway", label: "网关", hint: "gateway 进程热路径，保存后约 5 秒热生效（applier 周期推送）" },
  { value: "admin_backend", label: "运营判定", hint: "admin 后端每请求现读，保存后 3 秒内生效" },
  { value: "admin_frontend", label: "前端展示", hint: "仅前端消费的展示档位，保存后本页面立即生效" },
  { value: "anthropic", label: "Provider 策略", hint: "gateway adapter 现读，保存后秒级生效" },
];

/** 序无关深比较：Go 编码与前端编码的 JSON 键序可能不同，不能比字符串。 */
function jsonEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => jsonEquals(v, b[i]));
  }
  if (typeof a === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) =>
      jsonEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

// ---- 时长「数字 + 单位」：入库 int 毫秒 ----

type DurationUnit = "ms" | "s" | "m" | "h";

const DURATION_UNIT_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
};

const DURATION_UNIT_LABEL: Record<DurationUnit, string> = {
  ms: "毫秒",
  s: "秒",
  m: "分钟",
  h: "小时",
};

interface DurationFieldValue {
  num: string;
  unit: DurationUnit;
}

/** 把存储的毫秒整数拆成可读的 {数字, 单位}：取能整除的最大单位（600000 → 10 分钟）。 */
function decomposeDurationMs(ms: number): DurationFieldValue {
  if (!Number.isFinite(ms) || ms <= 0) return { num: String(ms ?? 0), unit: "ms" };
  for (const unit of ["h", "m", "s"] as const) {
    if (ms % DURATION_UNIT_MS[unit] === 0) {
      return { num: String(ms / DURATION_UNIT_MS[unit]), unit };
    }
  }
  return { num: String(ms), unit: "ms" };
}

/** 把 {数字, 单位} 折算成入库毫秒整数；非法返回 NaN。 */
function composeDurationMs(v: DurationFieldValue): number {
  const t = v.num.trim();
  if (t === "") return Number.NaN;
  const n = Number(t);
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.round(n * DURATION_UNIT_MS[v.unit]);
}

/** 校验时长输入：换算后须为整数毫秒且满足下界（allowZero 时 0 合法）。 */
function durationError(v: DurationFieldValue, allowZero: boolean): string | undefined {
  const ms = composeDurationMs(v);
  if (Number.isNaN(ms)) return "请输入数字";
  if (!Number.isInteger(ms)) return "换算成毫秒后需为整数";
  if (allowZero ? ms < 0 : ms <= 0) return allowZero ? "需 ≥ 0" : "需 > 0";
  return undefined;
}

/** 时长输入：数字 + 时间单位下拉（毫秒/秒/分钟/小时），受控。 */
function DurationInput({
  id,
  value,
  onChange,
  ariaInvalid,
}: {
  id?: string;
  value: DurationFieldValue;
  onChange: (next: DurationFieldValue) => void;
  ariaInvalid?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        id={id}
        type="number"
        min={0}
        step="any"
        value={value.num}
        onChange={(e) => onChange({ ...value, num: e.target.value })}
        aria-invalid={ariaInvalid}
        className="h-8 min-w-0 flex-1 font-mono text-xs"
      />
      <Select
        value={value.unit}
        onValueChange={(u) => onChange({ ...value, unit: u as DurationUnit })}
      >
        <SelectTrigger aria-label="时间单位" className="h-8 w-20 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-(--radix-select-trigger-width)">
          {(Object.keys(DURATION_UNIT_LABEL) as DurationUnit[]).map((u) => (
            <SelectItem key={u} value={u}>
              {DURATION_UNIT_LABEL[u]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** 运行时配置面板（分域 Tab）。 */
export function RuntimeSettingsPanel() {
  const query = useQuery({ queryKey: RUNTIME_SETTINGS_QUERY_KEY, queryFn: listSettings });

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
      <Alert>
        <AlertTitle>运行时配置（免重启生效）</AlertTitle>
        <AlertDescription>
          按域分组：配置保存后写入数据库并经 Redis 推送到对应消费方（各域生效时效见 Tab 内说明）。
          标有「已偏离代码默认」的项表示当前值与代码内置默认不同（可能是人为调整，也可能是新版本
          默认值已升级而 DB 仍为旧值），是否跟进由你决定。
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
            <TabsContent key={t.value} value={t.value} className="flex flex-col gap-4 pt-3">
              <p className="text-muted-foreground text-xs">{t.hint}</p>
              {/* anthropic 域的 beta 策略有专用 typed 卡片（含生效探针），生成式卡片跳过该 key。 */}
              {t.value === "anthropic" && <AnthropicBetaPolicyCard />}
              <div className="grid items-start gap-4 md:grid-cols-2">
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {item.label}
          {diverged && <Badge variant="secondary">已偏离代码默认</Badge>}
        </CardTitle>
        <p className="text-muted-foreground text-xs">{item.description}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SettingEditor item={item} />
        <div className="text-muted-foreground border-t pt-2 text-[11px] leading-5">
          <div>
            <span className="font-medium">生效来源</span>：
            {SOURCE_LABEL[item.source] ?? item.source}
          </div>
          <div className="font-mono break-all">
            <span className="font-sans font-medium">当前值</span>：{JSON.stringify(item.value)}
          </div>
          <div className="font-mono break-all">
            <span className="font-sans font-medium">代码默认</span>：
            {JSON.stringify(item.default)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** 按 key 分派 typed 编辑器；未识别的 key 用 JSON 文本兜底（新配置项无前端也可管）。 */
function SettingEditor({ item }: { item: SettingItem }) {
  switch (item.key) {
    case "gateway.circuit_breaker":
      return <CircuitBreakerEditor item={item} />;
    case "gateway.rate_limit_defaults":
      return <RateLimitEditor item={item} />;
    case "gateway.channel_ratelimit_cooldown":
      return <CooldownEditor item={item} />;
    case "gateway.stream_idle_timeout_ms":
    case "gateway.default_channel_timeout_ms":
      return <DurationMsEditor item={item} />;
    case "gateway.credential_401_threshold":
      return <PositiveIntEditor item={item} />;
    case "admin_backend.channel_health_thresholds":
      return <ChannelHealthEditor item={item} />;
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
    onSuccess: () => {
      toast.success("已保存");
      void queryClient.invalidateQueries({ queryKey: RUNTIME_SETTINGS_QUERY_KEY });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

function SaveReset({
  saving,
  onSave,
  onReset,
}: {
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? "保存中…" : "保存"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onReset} disabled={saving}>
        重置
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
  open_duration_ms: number;
}

function CircuitBreakerEditor({ item }: { item: SettingItem }) {
  const server = item.value as CircuitBreakerValue;
  const [enabled, setEnabled] = useState(server.enabled);
  const [window_, setWindow] = useState(() => decomposeDurationMs(server.window_ms));
  const [minRequests, setMinRequests] = useState(String(server.min_requests));
  const [failureRatio, setFailureRatio] = useState(String(server.failure_ratio));
  const [openDuration, setOpenDuration] = useState(() =>
    decomposeDurationMs(server.open_duration_ms),
  );
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setEnabled(server.enabled);
    setWindow(decomposeDurationMs(server.window_ms));
    setMinRequests(String(server.min_requests));
    setFailureRatio(String(server.failure_ratio));
    setOpenDuration(decomposeDurationMs(server.open_duration_ms));
  };

  const save = () => {
    const err = durationError(window_, false) ?? durationError(openDuration, false);
    if (err) {
      toast.error(`时长：${err}`);
      return;
    }
    mutation.mutate({
      enabled,
      window_ms: composeDurationMs(window_),
      min_requests: Number(minRequests),
      failure_ratio: Number(failureRatio),
      open_duration_ms: composeDurationMs(openDuration),
    } satisfies CircuitBreakerValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={`${item.key}-enabled`}>启用熔断</Label>
        <Switch id={`${item.key}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">统计窗口</Label>
          <DurationInput value={window_} onChange={setWindow} />
        </div>
        <FieldText
          label="最小请求数（次）"
          value={minRequests}
          onChange={setMinRequests}
          inputMode="numeric"
        />
        <FieldText
          label="失败比例阈值 (0,1]"
          value={failureRatio}
          onChange={setFailureRatio}
          inputMode="decimal"
        />
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">熔断打开时长</Label>
          <DurationInput value={openDuration} onChange={setOpenDuration} />
        </div>
      </div>
      <SaveReset saving={mutation.isPending} onSave={save} onReset={reset} />
    </div>
  );
}

// ---- gateway.rate_limit_defaults ----

interface RateLimitValue {
  rpm: number;
  tpm: number;
  rpd: number;
  failure_policy: string;
}

function RateLimitEditor({ item }: { item: SettingItem }) {
  const server = item.value as RateLimitValue;
  const [rpm, setRpm] = useState(String(server.rpm));
  const [tpm, setTpm] = useState<RateLimitFieldValue>(() => decomposeRateLimit(server.tpm));
  const [rpd, setRpd] = useState<RateLimitFieldValue>(() => decomposeRateLimit(server.rpd));
  const [policy, setPolicy] = useState(server.failure_policy);
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setRpm(String(server.rpm));
    setTpm(decomposeRateLimit(server.tpm));
    setRpd(decomposeRateLimit(server.rpd));
    setPolicy(server.failure_policy);
  };

  const save = () => {
    // 全局默认没有「继承」语义（它就是兜底），故不允许留空；0=不限。
    for (const [label, v] of [
      ["TPM", tpm],
      ["RPD", rpd],
    ] as const) {
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
      tpm: composeRateLimit(tpm) as number,
      rpd: composeRateLimit(rpd) as number,
      failure_policy: policy,
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
          <Label className="text-xs">TPM（token/分钟，0=不限）</Label>
          <RateLimitInput value={tpm} onChange={setTpm} placeholder="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">RPD（次/天，0=不限）</Label>
          <RateLimitInput value={rpd} onChange={setRpd} placeholder="0" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${item.key}-policy`}>Redis 故障策略</Label>
        <Select value={policy} onValueChange={setPolicy}>
          <SelectTrigger id={`${item.key}-policy`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fail_closed">fail_closed（故障即拒绝，安全优先）</SelectItem>
            <SelectItem value="fail_open">fail_open（故障放行，可用性优先）</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SaveReset saving={mutation.isPending} onSave={save} onReset={reset} />
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
  const [cooldown, setCooldown] = useState(() => decomposeDurationMs(server.cooldown_ms));
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
          <Label className="text-xs">默认冷却（无 Retry-After，0=不冷却）</Label>
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
          setCooldown(decomposeDurationMs(server.cooldown_ms));
          setCap(decomposeDurationMs(server.cap_ms));
        }}
      />
    </div>
  );
}

// ---- int 毫秒标量（流式 idle 超时 / 默认渠道超时）----

function DurationMsEditor({ item }: { item: SettingItem }) {
  const server = item.value as number;
  const [value, setValue] = useState(() => decomposeDurationMs(server));
  const mutation = useSaveSetting(item.key);

  const save = () => {
    const err = durationError(value, false);
    if (err) {
      toast.error(`时长：${err}`);
      return;
    }
    mutation.mutate(composeDurationMs(value));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">时长</Label>
        <DurationInput value={value} onChange={setValue} />
      </div>
      <SaveReset
        saving={mutation.isPending}
        onSave={save}
        onReset={() => setValue(decomposeDurationMs(server))}
      />
    </div>
  );
}

// ---- 正整数单值 ----

function PositiveIntEditor({ item }: { item: SettingItem }) {
  const server = item.value as number;
  const [value, setValue] = useState(String(server));
  const mutation = useSaveSetting(item.key);

  return (
    <div className="flex flex-col gap-3">
      <FieldText label="阈值（次）" value={value} onChange={setValue} inputMode="numeric" />
      <SaveReset
        saving={mutation.isPending}
        onSave={() => mutation.mutate(Number(value))}
        onReset={() => setValue(String(server))}
      />
    </div>
  );
}

// ---- admin_backend.channel_health_thresholds ----

interface ChannelHealthValue {
  healthy_rate: number;
  degraded_rate: number;
}

/** 比率输入的通用前端预检（服务端注册表校验仍是权威）。 */
function rateError(s: string, label: string): string | undefined {
  const n = Number(s);
  if (s.trim() === "" || !Number.isFinite(n)) return `${label}：请输入数字`;
  if (n <= 0 || n > 1) return `${label}：需在 (0, 1] 内`;
  return undefined;
}

function ChannelHealthEditor({ item }: { item: SettingItem }) {
  const server = item.value as ChannelHealthValue;
  const [healthy, setHealthy] = useState(String(server.healthy_rate));
  const [degraded, setDegraded] = useState(String(server.degraded_rate));
  const mutation = useSaveSetting(item.key);

  const save = () => {
    const err = rateError(healthy, "健康线") ?? rateError(degraded, "降级线");
    if (err) {
      toast.error(err);
      return;
    }
    if (Number(degraded) >= Number(healthy)) {
      toast.error("降级线必须低于健康线");
      return;
    }
    mutation.mutate({
      healthy_rate: Number(healthy),
      degraded_rate: Number(degraded),
    } satisfies ChannelHealthValue);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldText
          label="健康线（成功率 ≥ 此值）"
          value={healthy}
          onChange={setHealthy}
          inputMode="decimal"
          placeholder="0.95"
        />
        <FieldText
          label="降级线（成功率 ≥ 此值）"
          value={degraded}
          onChange={setDegraded}
          inputMode="decimal"
          placeholder="0.8"
        />
      </div>
      <SaveReset
        saving={mutation.isPending}
        onSave={save}
        onReset={() => {
          setHealthy(String(server.healthy_rate));
          setDegraded(String(server.degraded_rate));
        }}
      />
    </div>
  );
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
  const [slo, setSlo] = useState(String(server.success_rate_slo));
  const [warn, setWarn] = useState(String(server.success_rate_warn));
  const [ttftWarn, setTtftWarn] = useState(() => decomposeDurationMs(server.ttft_warn_ms));
  const [ttftDanger, setTtftDanger] = useState(() => decomposeDurationMs(server.ttft_danger_ms));
  const [latWarn, setLatWarn] = useState(() => decomposeDurationMs(server.latency_warn_ms));
  const [latDanger, setLatDanger] = useState(() => decomposeDurationMs(server.latency_danger_ms));
  const [profitThin, setProfitThin] = useState(String(server.profit_thin_rate));
  const mutation = useSaveSetting(item.key);

  const reset = () => {
    setSlo(String(server.success_rate_slo));
    setWarn(String(server.success_rate_warn));
    setTtftWarn(decomposeDurationMs(server.ttft_warn_ms));
    setTtftDanger(decomposeDurationMs(server.ttft_danger_ms));
    setLatWarn(decomposeDurationMs(server.latency_warn_ms));
    setLatDanger(decomposeDurationMs(server.latency_danger_ms));
    setProfitThin(String(server.profit_thin_rate));
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
    if (profitThin.trim() === "" || !Number.isFinite(profit) || profit < 0 || profit >= 1) {
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
  const server = useMemo(() => JSON.stringify(item.value, null, 2), [item.value]);
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
      <SaveReset saving={mutation.isPending} onSave={save} onReset={() => setText(server)} />
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}
