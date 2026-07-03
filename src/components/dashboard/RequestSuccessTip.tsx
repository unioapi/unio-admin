import type { ReactNode } from "react";
import type { RadarRequests } from "@/lib/api/dashboard";
import { formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  rateIntent,
  requestInFlight,
  requestTerminal,
} from "@/components/dashboard/metrics";

const FINISHED_FIELDS = [
  { key: "succeeded", getValue: (r: RadarRequests) => r.succeeded, meaning: "请求已成功完成" },
  { key: "failed", getValue: (r: RadarRequests) => r.failed, meaning: "请求已失败" },
] as const;

function TipSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border/60 space-y-2 border-t pt-2.5">
      {title ? (
        <h4 className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {title}
        </h4>
      ) : null}
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold text-foreground" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FormulaBlock({
  title,
  rows,
}: {
  title: string;
  rows: { op: "=" | "+"; label: string; value: string }[];
}) {
  return (
    <div className="bg-muted/30 overflow-hidden rounded-md">
      <div className="text-muted-foreground border-border/40 border-b px-2.5 py-1.5 text-xs font-medium">
        {title}
      </div>
      <div className="space-y-1 px-2.5 py-2 font-mono text-[11px] leading-none">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1rem_minmax(0,1fr)_3.5rem] items-baseline gap-x-2"
          >
            <span className="text-muted-foreground/70 text-right select-none">{row.op}</span>
            <span className="text-muted-foreground truncate">{row.label}</span>
            <span className="text-foreground text-right tabular-nums font-medium">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function rateColor(rate: number): string {
  const intent = rateIntent(rate);
  return intent === "success"
    ? "text-emerald-600 dark:text-emerald-400"
    : intent === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";
}

/** 请求成功率卡片悬浮详情。 */
export function RequestSuccessTip({ requests }: { requests: RadarRequests }) {
  const terminal = requestTerminal(requests);
  const inFlight = requestInFlight(requests);

  const successPct = terminal > 0 ? requests.succeeded / terminal : 0;
  const failedPct = terminal > 0 ? requests.failed / terminal : 0;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold leading-tight">请求成功率</div>
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            成功 ÷ 完成
          </div>
        </div>
        <div
          className={cn(
            "font-heading text-xl font-semibold tabular-nums",
            rateColor(requests.success_rate),
          )}
        >
          {formatPercent(requests.success_rate)}
        </div>
      </div>

      {terminal > 0 ? (
        <div className="space-y-2">
          <div className="bg-muted/80 flex h-2 overflow-hidden rounded-full">
            {successPct > 0 ? (
              <div
                className="bg-emerald-500/85 h-full"
                style={{ width: `${successPct * 100}%` }}
              />
            ) : null}
            {failedPct > 0 ? (
              <div
                className="bg-destructive/75 h-full"
                style={{ width: `${failedPct * 100}%` }}
              />
            ) : null}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            <LegendDot className="bg-emerald-500/85" label={`成功 ${formatCompact(requests.succeeded)}`} />
            <LegendDot className="bg-destructive/75" label={`失败 ${formatCompact(requests.failed)}`} />
          </div>
        </div>
      ) : null}

      <TipSection title="汇总">
        <div className="space-y-1.5">
          <SummaryRow label="总请求" value={formatCompact(requests.total)} />
          <SummaryRow label="完成（成功+失败）" value={formatCompact(terminal)} emphasis />
          {requests.canceled > 0 ? (
            <SummaryRow label="取消（不计入成功率）" value={formatCompact(requests.canceled)} />
          ) : null}
          <SummaryRow label="进行中" value={formatCompact(inFlight)} />
          {requests.timeout > 0 ? (
            <SummaryRow label="超时" value={formatCompact(requests.timeout)} />
          ) : null}
        </div>
      </TipSection>

      <TipSection title="数量构成">
        <FormulaBlock
          title="完成"
          rows={FINISHED_FIELDS.map(({ key, getValue }, i) => ({
            op: i === 0 ? ("=" as const) : ("+" as const),
            label: key,
            value: formatCompact(getValue(requests)),
          }))}
        />
        <div className="mt-2">
          <FormulaBlock
            title="总请求"
            rows={[
              { op: "=", label: "完成", value: formatCompact(terminal) },
              { op: "+", label: "取消", value: formatCompact(requests.canceled) },
              { op: "+", label: "进行中", value: formatCompact(inFlight) },
            ]}
          />
        </div>
      </TipSection>

      <TipSection title="比率计算">
        <div className="bg-muted/30 space-y-1.5 rounded-md px-2.5 py-2 text-[11px]">
          <p className="text-muted-foreground leading-relaxed">
            <span className="text-foreground/90 font-medium">成功率</span>
            {" = 成功 ÷ 完成"}
          </p>
          <p className="text-foreground font-mono text-[10px] tabular-nums">
            {formatCompact(requests.succeeded)} ÷ {formatCompact(terminal)} ={" "}
            {formatPercent(requests.success_rate)}
          </p>
          <div className="border-border/40 border-t pt-1.5" />
          <p className="text-muted-foreground leading-relaxed">
            <span className="text-foreground/90 font-medium">失败率</span>
            {" = 失败 ÷ 完成"}
          </p>
          <p className="text-foreground font-mono text-[10px] tabular-nums">
            {formatCompact(requests.failed)} ÷ {formatCompact(terminal)} ={" "}
            {formatPercent(requests.error_rate)}
          </p>
        </div>
      </TipSection>

      <TipSection title="字段说明">
        <ul className="space-y-2">
          {FINISHED_FIELDS.map(({ key, meaning }) => (
            <li key={key} className="space-y-0.5">
              <code className="bg-muted/60 rounded px-1 py-px font-mono text-[10px]">
                {key}
              </code>
              <p className="text-muted-foreground text-[11px] leading-relaxed">{meaning}</p>
            </li>
          ))}
          <li className="space-y-0.5">
            <code className="bg-muted/60 rounded px-1 py-px font-mono text-[10px]">
              canceled
            </code>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              客户端取消，非渠道/平台责任，不计入成功率分母
            </p>
          </li>
          <li className="space-y-0.5">
            <code className="bg-muted/60 rounded px-1 py-px font-mono text-[10px]">
              in_flight
            </code>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              pending / running，不计入成功率
            </p>
          </li>
          {requests.timeout > 0 ? (
            <li className="space-y-0.5">
              <code className="bg-muted/60 rounded px-1 py-px font-mono text-[10px]">
                timeout
              </code>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                超时错误次数（failed 子集）
              </p>
            </li>
          ) : null}
        </ul>
      </TipSection>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-1.5 shrink-0 rounded-full", className)} />
      {label}
    </span>
  );
}

/** 卡片副栏：完成 / 成功。 */
export function RequestSuccessHint({ requests }: { requests: RadarRequests }) {
  const terminal = requestTerminal(requests);
  return (
    <div className="grid grid-cols-2 gap-x-2 tabular-nums">
      <span className="truncate">完成 {formatCompact(terminal)}</span>
      <span className="truncate text-right">成功 {formatCompact(requests.succeeded)}</span>
    </div>
  );
}
