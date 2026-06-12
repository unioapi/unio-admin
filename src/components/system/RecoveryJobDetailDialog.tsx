import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRecoveryJob,
  type RecoveryJobDetail,
} from "@/lib/api/system";
import { formatDateTime, trimDecimal } from "@/lib/format";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RecoveryStatusBadge } from "@/components/system/RecoveryStatusBadge";

// children-trigger 弹窗：open 时才拉详情；含「显示内部诊断详情」排查开关。
export function RecoveryJobDetailDialog({
  jobId,
  children,
}: {
  jobId: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {open && <DetailBody jobId={jobId} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ jobId }: { jobId: number }) {
  const [includeInternal, setIncludeInternal] = useState(false);

  const query = useQuery({
    queryKey: ["recovery-job-detail", jobId, includeInternal],
    queryFn: () => getRecoveryJob(jobId, includeInternal),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>结算补偿任务 #{jobId}</DialogTitle>
        <DialogDescription>
          上游已成功、settlement 确认前的持久化补偿任务事实
        </DialogDescription>
      </DialogHeader>

      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={includeInternal}
          onCheckedChange={setIncludeInternal}
          aria-label="显示内部诊断详情"
        />
        显示内部诊断详情（仅排查用）
      </label>

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
        <DetailContent detail={query.data} />
      )}
    </>
  );
}

function DetailContent({ detail }: { detail: RecoveryJobDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="任务状态">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="状态">
            <RecoveryStatusBadge status={detail.status} />
          </Row>
          <Row label="重试次数">
            {detail.attempt_count} / {detail.max_attempts}
          </Row>
          <Row label="下次执行">{formatDateTime(detail.next_run_at)}</Row>
          <Row label="最近尝试">
            {detail.last_attempted_at
              ? formatDateTime(detail.last_attempted_at)
              : "—"}
          </Row>
          <Row label="完成时间">
            {detail.completed_at ? formatDateTime(detail.completed_at) : "—"}
          </Row>
          <Row label="锁定者">{dash(detail.locked_by)}</Row>
          <Row label="创建时间">{formatDateTime(detail.created_at)}</Row>
          <Row label="更新时间">{formatDateTime(detail.updated_at)}</Row>
        </dl>
      </Section>

      <Section title="归属与路由">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="用户 ID">{detail.user_id}</Row>
          <Row label="请求记录 ID">{detail.request_record_id}</Row>
          <Row label="Attempt ID">{detail.attempt_id}</Row>
          <Row label="预授权 ID">{detail.reservation_id}</Row>
          <Row label="模型 ID">{detail.model_id}</Row>
          <Row label="Provider / Channel">
            {detail.provider_id} / {detail.channel_id}
          </Row>
          <Row label="响应模型">{detail.response_model_id}</Row>
          <Row label="上游模型 / 协议">
            {detail.upstream_model} · {detail.upstream_protocol}
          </Row>
          <Row label="finish / HTTP">
            {detail.finish_class} · {detail.upstream_status_code}
          </Row>
        </dl>
      </Section>

      <Section title="金额（授权快照）">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="估算金额">
            {trimDecimal(detail.estimated_amount)} {detail.currency}
          </Row>
          <Row label="冻结金额">
            {trimDecimal(detail.authorized_amount)} {detail.currency}
          </Row>
          <Row label="计价 / 公式">
            {detail.pricing_unit} · {detail.formula_version}
          </Row>
        </dl>
      </Section>

      <Section title="用量事实">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="未缓存输入">{detail.uncached_input_tokens}</Row>
          <Row label="缓存读取">{detail.cache_read_input_tokens}</Row>
          <Row label="输出总量">{detail.output_tokens_total}</Row>
          <Row label="reasoning 输出">{detail.reasoning_output_tokens}</Row>
          <Row label="5m 缓存写入">{detail.cache_write_5m_input_tokens}</Row>
          <Row label="1h 缓存写入">{detail.cache_write_1h_input_tokens}</Row>
          <Row label="来源 / 映射">
            {detail.usage_source} · {detail.usage_mapping_version}
          </Row>
        </dl>
      </Section>

      {(detail.last_error_code || detail.last_error_message) && (
        <Section title="最近错误（对外）">
          <div className="text-sm">
            {detail.last_error_code && (
              <div className="font-mono text-xs">{detail.last_error_code}</div>
            )}
            {detail.last_error_message && (
              <div className="text-muted-foreground">
                {detail.last_error_message}
              </div>
            )}
          </div>
        </Section>
      )}

      {detail.last_internal_error_detail && (
        <Section title="内部诊断详情">
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {detail.last_internal_error_detail}
          </pre>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </h3>
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
