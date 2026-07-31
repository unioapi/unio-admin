import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock3Icon,
  RouteIcon,
} from "lucide-react";
import {
  getRequestRoutingDecision,
  type RequestDetail,
} from "@/lib/api/requests";
import type {
  RoutingCandidateScore,
  RoutingDecision,
} from "@/lib/api/routesOps";
import { formatLatencyMs } from "@/lib/format";
import {
  channelBindingLabel,
  resolveStickyMutation,
  resolveStickyOutcome,
  stickyActionLabel,
  stickyMutationLabel,
  stickyOutcomeLabel,
  type StickySummaryFields,
} from "@/lib/sticky";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FINAL_RESULT_LABELS: Record<string, string> = {
  success: "请求成功",
  client_canceled: "客户端取消",
  capacity_exhausted: "渠道容量耗尽",
  rate_limited: "上游限流",
  no_available_channel: "没有可用渠道",
  upstream_failed: "上游调用失败",
  gateway_error: "网关内部错误",
};

const ACQUIRE_REASON_LABELS: Record<string, string> = {
  concurrency_full: "并发已满",
  cooldown: "处于 429 冷却",
  breaker_open: "熔断已打开",
  provider_breaker_open: "服务商熔断已打开",
  channel_breaker_open: "渠道熔断已打开",
  model_permission_paused: "模型权限暂停",
  runtime_sync_required: "运行态尚未同步",
  runtime_sync_pending: "运行态同步中",
  acquired: "已取得容量",
};

const TIMEOUT_PHASE_LABELS: Record<string, string> = {
  response_header: "等待 HTTP 响应头",
  response_body: "读取非流式响应体",
  first_token: "等待流式首个有效事件",
  stream_idle: "流式事件间隔空闲",
};

export function RoutingProcessPanel({
  requestId,
  detail,
}: {
  requestId: string;
  detail: RequestDetail;
}) {
  const query = useQuery({
    queryKey: ["request-routing-decision", requestId],
    queryFn: () => getRequestRoutingDecision(requestId),
    refetchInterval: (q) =>
      q.state.data?.trace_status === "partial" ? 3000 : false,
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>路由过程不可用</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  }

  const decision = query.data;
  if (decision.trace_status === "legacy_sampled") {
    return (
      <Alert>
        <CircleAlertIcon />
        <AlertTitle>历史采样记录</AlertTitle>
        <AlertDescription>
          这条请求产生于完整 trace 上线前，只保留旧摘要，无法还原资格矩阵和执行时间线。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <DecisionConclusion decision={decision} />
      <ProcessSection title="候选资格">
        <QualificationMatrix decision={decision} />
      </ProcessSection>
      <Separator />
      <ProcessSection title="五项评分">
        <ScoreMatrix decision={decision} />
      </ProcessSection>
      <Separator />
      <ProcessSection title="扫描与准入时间线">
        <AcquireTimeline decision={decision} />
      </ProcessSection>
      <Separator />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProcessSection title="粘性">
          <StickySummary decision={decision} />
        </ProcessSection>
        <ProcessSection title="容量等待">
          <CapacityWaitSummary decision={decision} />
        </ProcessSection>
      </div>
      <Separator />
      <ProcessSection title="超时阶段">
        <TimeoutSummary detail={detail} />
      </ProcessSection>
      <InternalDiagnostics decision={decision} />
    </div>
  );
}

function DecisionConclusion({ decision }: { decision: RoutingDecision }) {
  const result = decision.summary.final_result ?? decision.process.final_result;
  const success = result === "success";
  const selected = decision.summary.final_channel_id ?? decision.summary.selected_channel_id;
  return (
    <Alert variant={success ? "default" : "destructive"}>
      {success ? <CheckCircle2Icon /> : <CircleAlertIcon />}
      <AlertTitle>{result ? FINAL_RESULT_LABELS[result] ?? result : "路由尚未收口"}</AlertTitle>
      <AlertDescription>
        候选池 {decision.summary.pool_size} 条，{decision.summary.eligible_count} 条具备资格；
        实际尝试 {decision.summary.attempted_channel_ids.length} 条
        {selected != null ? `，最终渠道 #${selected}` : ""}
        {decision.summary.fallback_count > 0 ? `，发生 ${decision.summary.fallback_count} 次回退` : ""}。
        {decision.trace_status === "partial" ? " 当前 trace 仍是 partial，页面会自动刷新。" : ""}
      </AlertDescription>
    </Alert>
  );
}

function QualificationMatrix({ decision }: { decision: RoutingDecision }) {
  const candidates = decision.process.candidates ?? [];
  if (candidates.length === 0) {
    return <p className="text-muted-foreground text-sm">没有候选资格快照。</p>;
  }
  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>渠道</TableHead>
            <TableHead>资格</TableHead>
            <TableHead>原因</TableHead>
            <TableHead>运行态</TableHead>
            <TableHead>熔断</TableHead>
            <TableHead>429 冷却</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => {
            const runtimeState = runtimeEvaluationState(candidate);
            return (
              <TableRow key={candidate.channel_id}>
                <TableCell className="font-medium tabular-nums">#{candidate.channel_id}</TableCell>
                <TableCell>
                  <Badge variant={candidate.eligible ? "outline" : "destructive"}>
                    {candidate.eligible ? "有资格" : "无资格"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal text-muted-foreground">
                  {candidate.excluded_reason ? reasonLabel(candidate.excluded_reason) : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={runtimeState === "stale" ? "destructive" : "outline"}
                    className={runtimeState === "not_evaluated" ? "text-muted-foreground" : undefined}
                  >
                    {runtimeState === "current"
                      ? "版本一致"
                      : runtimeState === "stale"
                        ? "版本落后"
                        : "未检查"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {runtimeState === "not_evaluated"
                    ? "未检查"
                    : breakerLabel(candidate.provider_breaker_state, candidate.channel_breaker_state)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {runtimeState === "not_evaluated"
                    ? "未检查"
                    : candidate.cooldown_remaining_ms > 0
                      ? formatLatencyMs(candidate.cooldown_remaining_ms)
                      : "无"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ScoreMatrix({ decision }: { decision: RoutingDecision }) {
  const candidates = decision.process.candidates ?? [];
  if (candidates.length === 0) {
    return <p className="text-muted-foreground text-sm">没有评分快照。</p>;
  }
  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border">
      <Table className="min-w-[940px]">
        <TableHeader>
          <TableRow>
            <TableHead>渠道</TableHead>
            <TableHead>成本</TableHead>
            <TableHead>并发</TableHead>
            <TableHead>TTFT</TableHead>
            <TableHead>错误率</TableHead>
            <TableHead>优先级</TableHead>
            <TableHead>总分</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.channel_id}>
              <TableCell className="font-medium tabular-nums">#{candidate.channel_id}</TableCell>
              {hasScoreEvaluation(candidate) ? (
                <>
                  <ScorePart candidate={candidate} score="cost_score" weight="cost_weight_pct" />
                  <ScorePart candidate={candidate} score="concurrency_score" weight="concurrency_weight_pct" />
                  <ScorePart candidate={candidate} score="ttft_score" weight="ttft_weight_pct" />
                  <ScorePart candidate={candidate} score="error_score" weight="error_rate_weight_pct" />
                  <ScorePart candidate={candidate} score="priority_score" weight="priority_weight_pct" />
                  <TableCell className="font-medium tabular-nums">{formatScore(candidate.final_score)}</TableCell>
                </>
              ) : (
                <TableCell colSpan={6} className="text-muted-foreground">
                  未评分{candidate.excluded_reason ? `：${reasonLabel(candidate.excluded_reason)}` : ""}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ScorePart({
  candidate,
  score,
  weight,
}: {
  candidate: RoutingCandidateScore;
  score: "cost_score" | "concurrency_score" | "ttft_score" | "error_score" | "priority_score";
  weight: "cost_weight_pct" | "concurrency_weight_pct" | "ttft_weight_pct" | "error_rate_weight_pct" | "priority_weight_pct";
}) {
  const metric = candidate[score];
  const weightPct = candidate[weight];
  return (
    <TableCell className="tabular-nums">
      <div>{formatScore(metric)} × {weightPct}%</div>
      <div className="text-muted-foreground text-xs">= {formatScore(metric * weightPct / 100)}</div>
    </TableCell>
  );
}

function AcquireTimeline({ decision }: { decision: RoutingDecision }) {
  const outcomes = decision.process.acquire_results ?? [];
  if (outcomes.length === 0) {
    return <p className="text-muted-foreground text-sm">没有准入扫描记录。</p>;
  }
  const attempts = new Set(decision.process.attempted_channel_ids ?? []);
  return (
    <ol className="flex flex-col gap-3">
      {outcomes.map((outcome, index) => (
        <li key={`${outcome.pass}-${outcome.channel_id}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3">
          <Badge variant={outcome.admitted ? "default" : "outline"} className="mt-0.5 tabular-nums">
            {index + 1}
          </Badge>
          <div className="min-w-0 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums">渠道 #{outcome.channel_id}</span>
              <Badge variant={outcome.admitted ? "outline" : "secondary"}>
                {outcome.admitted ? "取得容量" : "跳过"}
              </Badge>
              <Badge variant="outline">第 {outcome.pass + 1} 轮扫描</Badge>
              {attempts.has(outcome.channel_id) ? <Badge>已请求上游</Badge> : null}
            </div>
            {!outcome.admitted && outcome.reason ? (
              <p className="mt-1 text-muted-foreground text-sm">
                {ACQUIRE_REASON_LABELS[outcome.reason] ?? reasonLabel(outcome.reason)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StickySummary({ decision }: { decision: RoutingDecision }) {
  const sticky = decision.process.sticky;
  const fields: StickySummaryFields = {
    sticky_key_present: sticky.key_present,
    sticky_action: sticky.action ?? null,
    sticky_reason: sticky.reason ?? null,
    sticky_before_channel_id: sticky.before_channel_id ?? null,
    sticky_after_channel_id: sticky.after_channel_id ?? null,
    sticky_pinned: sticky.pinned,
    sticky_pinned_non_preferred: sticky.pinned_non_preferred,
  };
  const outcome = resolveStickyOutcome(fields);
  const mutation = resolveStickyMutation(sticky.action ?? null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {outcome ? (
          <Badge variant="outline">{stickyOutcomeLabel(outcome)}</Badge>
        ) : null}
        {mutation ? (
          <Badge variant="secondary">{stickyMutationLabel(mutation)}</Badge>
        ) : (
          <Badge variant="secondary">未改</Badge>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <ProcessValue label="选路结果">
          {outcome ? stickyOutcomeLabel(outcome) : "—"}
        </ProcessValue>
        <ProcessValue label="绑定变更">
          {mutation
            ? stickyMutationLabel(mutation)
            : stickyActionLabel(sticky.action ?? null)}
        </ProcessValue>
        <ProcessValue label="请求前绑定">
          {channelBindingLabel(
            sticky.before_channel_id,
            undefined,
            sticky.before_version,
          )}
        </ProcessValue>
        <ProcessValue label="请求后绑定">
          {channelBindingLabel(
            sticky.after_channel_id,
            undefined,
            sticky.after_version,
          )}
        </ProcessValue>
        <ProcessValue label="动作原因">
          {sticky.reason ? reasonLabel(sticky.reason) : "—"}
        </ProcessValue>
        <ProcessValue label="原始动作">
          {sticky.action ?? "—"}
        </ProcessValue>
      </dl>
    </div>
  );
}

function CapacityWaitSummary({ decision }: { decision: RoutingDecision }) {
  const wait = decision.process.capacity_wait;
  if (!wait.entered) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2Icon className="size-4" />
        未进入容量等待
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary"><Clock3Icon />等待 {formatLatencyMs(wait.waited_ms)}</Badge>
        <Badge variant={wait.result === "acquired" ? "outline" : "destructive"}>
          {capacityResultLabel(wait.result)}
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        等待期间不持有任何渠道 permit；结束后执行一次完整重扫。
      </p>
    </div>
  );
}

function TimeoutSummary({ detail }: { detail: RequestDetail }) {
  const timeoutAttempts = detail.attempts.filter((attempt) => attempt.upstream_timeout_phase);
  if (timeoutAttempts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2Icon className="size-4" />
        没有上游超时
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {timeoutAttempts.map((attempt) => (
        <div key={attempt.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <Badge variant="destructive">attempt #{attempt.attempt_index}</Badge>
          <span className="font-medium tabular-nums">渠道 #{attempt.channel_id}</span>
          <span className="text-muted-foreground">
            {TIMEOUT_PHASE_LABELS[attempt.upstream_timeout_phase ?? ""] ?? attempt.upstream_timeout_phase}
          </span>
        </div>
      ))}
    </div>
  );
}

function InternalDiagnostics({ decision }: { decision: RoutingDecision }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="routing-internal">
        <AccordionTrigger>内部诊断</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ProcessValue label="Trace 状态">{decision.trace_status}</ProcessValue>
              <ProcessValue label="Schema">v{decision.schema_version}</ProcessValue>
              <ProcessValue label="算法">{decision.algorithm_version}</ProcessValue>
              <ProcessValue label="路由模式">{decision.mode}</ProcessValue>
              <ProcessValue label="线路 ID">{decision.route_id}</ProcessValue>
              <ProcessValue label="评分配置版本">{decision.process.score_config.routing_balance_revision}</ProcessValue>
            </dl>
            {decision.process.candidates.map((candidate) => {
              const runtimeEvaluated = runtimeEvaluationState(candidate) !== "not_evaluated";
              return (
                <div key={candidate.channel_id} className="rounded-md border p-3">
                  <div className="mb-2 font-medium tabular-nums">渠道 #{candidate.channel_id}</div>
                  <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <ProcessValue label="运行态检查">{runtimeEvaluated ? "已执行" : "未执行"}</ProcessValue>
                    <ProcessValue label="Origin revision">
                      {candidate.candidate_origin_revision} / {runtimeEvaluated ? candidate.runtime_origin_revision : "—"}
                    </ProcessValue>
                    <ProcessValue label="Provider revision">
                      {candidate.candidate_provider_status_revision} / {runtimeEvaluated ? candidate.runtime_provider_status_revision : "—"}
                    </ProcessValue>
                    <ProcessValue label="Config revision">
                      {candidate.candidate_channel_config_revision} / {runtimeEvaluated ? candidate.runtime_channel_config_revision ?? "—" : "—"}
                    </ProcessValue>
                    <ProcessValue label="Capacity revision">
                      {candidate.candidate_channel_capacity_revision} / {runtimeEvaluated ? candidate.runtime_channel_capacity_revision : "—"}
                    </ProcessValue>
                    <ProcessValue label="全局并发版本">{runtimeEvaluated ? candidate.global_concurrency_revision : "—"}</ProcessValue>
                    <ProcessValue label="熔断版本">{runtimeEvaluated ? candidate.circuit_breaker_revision : "—"}</ProcessValue>
                  </dl>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function ProcessSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <RouteIcon className="size-4" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function ProcessValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="break-all tabular-nums">{children}</dd>
    </div>
  );
}

function breakerLabel(provider?: string, channel?: string): string {
  if (!provider && !channel) return "无熔断快照";
  return `服务商 ${provider ?? "—"} · 渠道 ${channel ?? "—"}`;
}

function capacityResultLabel(result?: string): string {
  if (result === "acquired") return "重扫取得容量";
  if (result === "capacity_exhausted") return "容量仍耗尽";
  if (result === "rate_limited") return "全部处于 429 冷却";
  return result ?? "未知结果";
}

function reasonLabel(reason: string): string {
  return ACQUIRE_REASON_LABELS[reason] ?? reason;
}

function runtimeEvaluationState(
  candidate: RoutingCandidateScore,
): "current" | "stale" | "not_evaluated" {
  if (!candidate.runtime_control_state && !candidate.breaker_store_admission) {
    return "not_evaluated";
  }
  return candidate.runtime_revision_current ? "current" : "stale";
}

function hasScoreEvaluation(candidate: RoutingCandidateScore): boolean {
  return candidate.algorithm_version !== "" && (
    candidate.cost_weight_pct
    + candidate.concurrency_weight_pct
    + candidate.ttft_weight_pct
    + candidate.error_rate_weight_pct
    + candidate.priority_weight_pct
  ) > 0;
}

function formatScore(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
