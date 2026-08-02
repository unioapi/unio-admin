import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRequest,
  type Attempt,
  type RequestDetail,
} from "@/lib/api/requests";
import type { BillingException, LedgerEntry } from "@/lib/api/ledger";
import { billingExceptionEventLabel } from "@/components/openstatus-table/ledger-os-columns";
import { formatDateTime, formatLatencyMs, formatTPS, trimDecimal } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequestStatusBadge } from "@/components/requests/RequestStatusBadge";
import { RequestCostBreakdown } from "@/components/requests/cost-breakdown";
import { RoutingProcessPanel } from "@/components/requests/RoutingProcessPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// 证据中心弹窗：默认 children-trigger 自管 open；也支持受控（深链自动打开）。
export function RequestDetailDialog({
  requestId,
  children,
  focusAttemptId,
  open: controlledOpen,
  onOpenChange,
}: {
  requestId: string;
  children?: ReactNode;
  focusAttemptId?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="w-full min-w-0 gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {open && <DetailBody requestId={requestId} focusAttemptId={focusAttemptId} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({
  requestId,
  focusAttemptId,
}: {
  requestId: string;
  focusAttemptId?: number;
}) {
  // includeInternal 是运营排查开关：勾选后带 ?include_internal=true 重新拉取，回显内部错误详情。
  const [includeInternal, setIncludeInternal] = useState(false);
  const [activeTab, setActiveTab] = useState("detail");

  const query = useQuery({
    queryKey: ["request-detail", requestId, includeInternal],
    queryFn: ({ signal }) => getRequest(requestId, includeInternal, signal),
    // 请求仍在进行中/待处理时每 5s 轮询，终态后停止（避免打开历史请求时无谓查询）。
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "running" || s === "pending" ? 5000 : false;
    },
  });

  useEffect(() => {
    if (!focusAttemptId || activeTab !== "detail" || !query.data) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById(`request-attempt-${focusAttemptId}`)?.scrollIntoView({
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeTab, focusAttemptId, query.data]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex w-full min-w-0 flex-col gap-0"
    >
      <div className="flex flex-col gap-4 px-6 pt-6 pr-12">
        <DialogHeader>
          <DialogTitle>请求详情</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {requestId}
          </DialogDescription>
        </DialogHeader>
        <TabsList>
          <TabsTrigger value="detail">请求详情</TabsTrigger>
          <TabsTrigger value="routing">路由过程</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="detail" className="mt-0 w-full min-w-0 overflow-hidden">
        <div className="max-h-[min(72vh,42rem)] w-full min-w-0 overflow-x-hidden overflow-y-auto">
          <div className="w-full min-w-0 px-6 py-5">
            {query.isError ? (
              <Alert variant="destructive">
                <AlertTitle>加载失败</AlertTitle>
                <AlertDescription>{query.error.message}</AlertDescription>
              </Alert>
            ) : query.isPending ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <DetailContent
                detail={query.data}
                includeInternal={includeInternal}
                onIncludeInternalChange={setIncludeInternal}
                focusAttemptId={focusAttemptId}
              />
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="routing" className="mt-0 w-full min-w-0 overflow-hidden">
        <div className="max-h-[min(72vh,42rem)] w-full min-w-0 overflow-x-hidden overflow-y-auto">
          <div className="w-full min-w-0 px-6 py-5">
            {query.isError ? (
              <Alert variant="destructive">
                <AlertTitle>加载失败</AlertTitle>
                <AlertDescription>{query.error.message}</AlertDescription>
              </Alert>
            ) : query.isPending ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <RoutingProcessPanel requestId={requestId} detail={query.data} />
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// TimingSection 使用后端从原始时间戳派生的毫秒值，避免 RFC3339 展示时间丢失亚秒精度。
function TimingSection({ detail }: { detail: RequestDetail }) {
	const latencyMs = detail.latency_ms;
	const gatewayTtftMs = detail.stream ? detail.gateway_ttft_ms : null;
	const tps = detail.stream ? detail.tps : null;

  if (latencyMs == null && gatewayTtftMs == null && tps == null) return null;

  return (
    <Section title="时延">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Row label="总耗时">{latencyMs != null ? formatLatencyMs(latencyMs) : "—"}</Row>
        {detail.stream ? (
          <>
            <Row label="Gateway TTFT">
              {gatewayTtftMs != null ? formatLatencyMs(gatewayTtftMs) : "—"}
            </Row>
            <Row label="TPS">{tps != null ? formatTPS(tps) : "—"}</Row>
          </>
        ) : null}
      </dl>
    </Section>
  );
}

function hasRequestError(detail: RequestDetail): boolean {
  if (detail.status === "failed") return true;
  if (detail.error_code || detail.error_message) return true;
  return detail.attempts.some(
    (a) => a.status === "failed" || Boolean(a.error_code || a.error_message),
  );
}

function DetailContent({
  detail,
  includeInternal,
  onIncludeInternalChange,
  focusAttemptId,
}: {
  detail: RequestDetail;
  includeInternal: boolean;
  onIncludeInternalChange: (checked: boolean) => void;
  focusAttemptId?: number;
}) {
  const showInternalToggle = hasRequestError(detail);

  return (
    <div className="flex flex-col gap-5">
      <Section title="基本信息">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="状态">
            <RequestStatusBadge status={detail.status} />
          </Row>
          <Row label="请求模型">{detail.requested_model_id}</Row>
          <Row label="响应模型">{dash(detail.response_model_id)}</Row>
          <Row label="协议 / 端点">
            {detail.ingress_protocol} · {detail.endpoint}
          </Row>
          <Row label="流式">{detail.stream ? "是" : "否"}</Row>
          <Row label="交付状态">{detail.delivery_status}</Row>
          <Row label="用户 ID">{detail.user_id}</Row>
          <Row label="API Key ID">{detail.api_key_id}</Row>
          <Row label="客户端 IP">{dash(detail.client_ip)}</Row>
          <Row label="推理强度">
            {detail.reasoning_effort
              ? detail.reasoning_budget_tokens != null
                ? `${detail.reasoning_effort}（预算 ${detail.reasoning_budget_tokens.toLocaleString()}）`
                : detail.reasoning_effort
              : "—"}
          </Row>
          <Row label="最终 Provider">{dash(detail.final_provider_id)}</Row>
          <Row label="最终 Channel">{dash(detail.final_channel_id)}</Row>
          <Row label="创建时间">{formatDateTime(detail.created_at)}</Row>
          <Row label="开始时间">{formatDateTime(detail.started_at)}</Row>
          <Row label="完成时间">
            {detail.completed_at ? formatDateTime(detail.completed_at) : "—"}
          </Row>
        </dl>
      </Section>

      <TimingSection detail={detail} />

      {(detail.error_code || detail.error_message) && (
        <Section title="错误（对外）">
          <div className="text-sm">
            {detail.error_code && (
              <div className="font-mono text-xs">{detail.error_code}</div>
            )}
            {detail.error_message && (
              <div className="text-muted-foreground">{detail.error_message}</div>
            )}
          </div>
        </Section>
      )}

      <Section
        title={`上游尝试（${detail.attempts.length}）`}
        action={
          showInternalToggle ? (
            <label className="flex items-center gap-2 text-xs font-normal normal-case tracking-normal text-foreground">
              <Switch
                checked={includeInternal}
                onCheckedChange={onIncludeInternalChange}
                aria-label="显示内部错误"
              />
              内部错误
            </label>
          ) : null
        }
      >
        {detail.attempts.length === 0 ? (
          <p className="text-muted-foreground text-sm">无上游尝试</p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {detail.attempts.map((a) => (
              <AttemptRow key={a.id} attempt={a} focused={a.id === focusAttemptId} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="用量">
        {detail.usage ? (
          <UsageBlock usage={detail.usage} />
        ) : (
          <p className="text-muted-foreground text-sm">无用量记录</p>
        )}
      </Section>

      <CostSection detail={detail} />

      <Section title={`账本流水（${detail.ledger_entries.length}）`}>
        {detail.ledger_entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">无账本流水</p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {detail.ledger_entries.map((e) => (
              <LedgerRow key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </Section>

      {detail.billing_exception && (
        <Section title="计费异常">
          <BillingExceptionBlock exception={detail.billing_exception} />
        </Section>
      )}
    </div>
  );
}

const FAULT_PARTY_META: Record<
  string,
  { label: string; variant: "outline" | "destructive" | "secondary" }
> = {
  upstream: { label: "上游故障", variant: "destructive" },
  client: { label: "客户端", variant: "secondary" },
  platform: { label: "平台", variant: "destructive" },
};

function FaultPartyBadge({ party }: { party: string }) {
  const meta = FAULT_PARTY_META[party];
  if (!meta) return null;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function AttemptRow({ attempt, focused = false }: { attempt: Attempt; focused?: boolean }) {
  return (
    <li
      id={`request-attempt-${attempt.id}`}
      className={cn("flex flex-col gap-1 p-3 text-sm", focused && "ring-2 ring-ring ring-inset")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="tabular-nums">
          #{attempt.attempt_index}
        </Badge>
        <RequestStatusBadge status={attempt.status} />
        {attempt.fault_party ? <FaultPartyBadge party={attempt.fault_party} /> : null}
        <span className="text-muted-foreground">
          provider {attempt.provider_id} · channel {attempt.channel_id} ·{" "}
          {attempt.adapter_key}
        </span>
        {attempt.upstream_status_code != null && (
          <span className="text-muted-foreground tabular-nums">
            HTTP {attempt.upstream_status_code}
          </span>
        )}
      </div>
      <div className="text-muted-foreground text-xs">
        上游模型 {attempt.upstream_model} · {attempt.upstream_protocol}
        {attempt.upstream_finish_reason &&
          ` · finish ${attempt.upstream_finish_reason}`}
      </div>
      {(attempt.upstream_total_ms != null || attempt.upstream_ttft_ms != null) && (
        <div className="text-muted-foreground text-xs tabular-nums">
          {attempt.upstream_total_ms != null
            ? `上游总耗时 ${formatLatencyMs(attempt.upstream_total_ms)}`
            : null}
          {attempt.upstream_total_ms != null && attempt.upstream_ttft_ms != null
            ? " · "
            : null}
          {attempt.upstream_ttft_ms != null
            ? `上游 TTFT ${formatLatencyMs(attempt.upstream_ttft_ms)}`
            : null}
        </div>
      )}
      {attempt.error_message && (
        <div className="text-destructive text-xs">
          {attempt.error_code ? `${attempt.error_code}: ` : ""}
          {attempt.error_message}
        </div>
      )}
      {attempt.internal_error_detail && (
        <pre className="bg-muted mt-1 max-h-32 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
          {attempt.internal_error_detail}
        </pre>
      )}
    </li>
  );
}

function CostSection({ detail }: { detail: RequestDetail }) {
  const u = detail.usage;
  const cs = detail.cost_snapshot;
  const ps = detail.price_snapshot;
  if (!u && !cs && !ps) return null;

  // 净扣费 = debit/adjustment_debit 之和 − credit/refund/adjustment_credit 之和（与列表口径一致）。
  let userCharge: string | null = null;
  if (detail.ledger_entries.length > 0) {
    let net = 0;
    for (const e of detail.ledger_entries) {
      const amt = Number(e.amount);
      if (Number.isNaN(amt)) continue;
      if (e.entry_type === "debit" || e.entry_type === "adjustment_debit") net += amt;
      else if (e.entry_type === "credit" || e.entry_type === "refund" || e.entry_type === "adjustment_credit")
        net -= amt;
    }
    if (net !== 0) userCharge = String(net);
  }

  return (
    <Section title="费用明细">
      <RequestCostBreakdown
        data={{
          tokens: {
            uncachedInput: u?.uncached_input_tokens ?? 0,
            cacheRead: u?.cache_read_input_tokens ?? 0,
            cacheWrite5m: u?.cache_write_5m_input_tokens ?? 0,
            cacheWrite1h: u?.cache_write_1h_input_tokens ?? 0,
            cacheWrite30m: u?.cache_write_30m_input_tokens ?? 0,
            outputTotal: u?.output_tokens_total ?? 0,
            reasoningOutput: u?.reasoning_output_tokens ?? 0,
          },
          costUnit: {
            uncachedInput: cs?.uncached_input_cost_unit ?? null,
            cacheRead: cs?.cache_read_input_cost_unit ?? null,
            cacheWrite5m: cs?.cache_write_5m_input_cost_unit ?? null,
            cacheWrite1h: cs?.cache_write_1h_input_cost_unit ?? null,
            cacheWrite30m: cs?.cache_write_30m_input_cost_unit ?? null,
            output: cs?.output_cost_unit ?? null,
            reasoning: cs?.reasoning_output_cost_unit ?? null,
          },
          priceUnit: {
            uncachedInput: ps?.uncached_input_price ?? null,
            cacheRead: ps?.cache_read_input_price ?? null,
            cacheWrite5m: ps?.cache_write_5m_input_price ?? null,
            cacheWrite1h: ps?.cache_write_1h_input_price ?? null,
            cacheWrite30m: ps?.cache_write_30m_input_price ?? null,
            output: ps?.output_price ?? null,
            reasoning: ps?.reasoning_output_price ?? null,
          },
          costAmount: cs
            ? {
                uncachedInput: cs.uncached_input_cost_amount,
                cacheRead: cs.cache_read_input_cost_amount,
                cacheWrite5m: cs.cache_write_5m_input_cost_amount,
                cacheWrite1h: cs.cache_write_1h_input_cost_amount,
                cacheWrite30m: cs.cache_write_30m_input_cost_amount,
                output: cs.output_cost_amount,
                reasoning: cs.reasoning_output_cost_amount,
                total: cs.total_cost_amount,
              }
            : null,
          userCharge,
          routeRatio: detail.route_price_ratio,
          channelCostMultiplier: cs?.channel_cost_multiplier ?? null,
          rechargeFactor: cs?.recharge_factor ?? null,
        }}
      />
    </Section>
  );
}

function UsageBlock({ usage }: { usage: RequestDetail["usage"] }) {
  if (!usage) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
      <Row label="未缓存输入">{usage.uncached_input_tokens}</Row>
      <Row label="缓存读取输入">{usage.cache_read_input_tokens}</Row>
      <Row label="输出总量">{usage.output_tokens_total}</Row>
      <Row label="reasoning 输出">{usage.reasoning_output_tokens}</Row>
      <Row label="5m 缓存写入">{usage.cache_write_5m_input_tokens}</Row>
      <Row label="1h 缓存写入">{usage.cache_write_1h_input_tokens}</Row>
      <Row label="30m 缓存写入">{usage.cache_write_30m_input_tokens}</Row>
      <Row label="来源">{usage.usage_source}</Row>
      <Row label="映射版本">{usage.usage_mapping_version}</Row>
    </dl>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{entry.entry_type}</Badge>
        <span className="font-medium tabular-nums">
          {trimDecimal(entry.amount)} {entry.currency}
        </span>
        <span className="text-muted-foreground text-xs">{entry.reason}</span>
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {trimDecimal(entry.balance_before)} → {trimDecimal(entry.balance_after)}
      </span>
    </li>
  );
}

function BillingExceptionBlock({
  exception,
}: {
  exception: BillingException;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
      <Row label="类型">
        <Badge variant={exception.event_type === "risk_exposure" ? "outline" : "destructive"}>
          {billingExceptionEventLabel(exception.event_type)}
        </Badge>
      </Row>
      <Row label="平台承担">
        {trimDecimal(exception.platform_amount)} {exception.currency}
      </Row>
      <Row label="已 capture">{trimDecimal(exception.captured_amount)}</Row>
      <Row label="实际金额">
        {exception.actual_amount ? trimDecimal(exception.actual_amount) : "—"}
      </Row>
      <Row label="原因码">{exception.reason_code}</Row>
      <Row label="原因">{exception.reason}</Row>
    </dl>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
