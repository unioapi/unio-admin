import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api/client";
import {
  getRuntimeDiagnostics,
  type RuntimeOperationSummary,
} from "@/lib/api/system";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const READINESS_REASON_LABELS: Record<string, string> = {
  ready: "运行态可用",
  postgres_unavailable: "PostgreSQL 不可用",
  epoch_not_ready: "Epoch 尚未就绪",
  control_revision_invalid: "控制版本无效",
  runtime_operation_pending: "运行态操作待收口",
  redis_unavailable: "Redis 不可用",
  marker_absent: "完整性标记缺失",
  marker_not_ready: "完整性标记未就绪",
  marker_mismatch: "完整性标记不匹配",
  runtime_not_ready: "运行态未就绪",
  control_absent: "关键控制缺失",
  control_pending: "关键控制待提交",
  control_revision_mismatch: "关键控制版本不匹配",
  control_invalid: "关键控制无效",
  control_payload_mismatch: "关键控制内容不匹配",
};

export function RuntimeDiagnosticsPanel() {
  const query = useQuery({
    queryKey: ["runtime-diagnostics"],
    queryFn: getRuntimeDiagnostics,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  if (query.isPending) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>运行态诊断加载失败</AlertTitle>
        <AlertDescription>{apiErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  }

  const diagnostics = query.data;
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>运行态诊断</CardTitle>
        <Badge variant={diagnostics.readiness.ready ? "secondary" : "destructive"}>
          {diagnostics.readiness.ready ? "准入正常" : "准入已拒绝"}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DiagnosticFact
          label="就绪原因"
          value={
            READINESS_REASON_LABELS[diagnostics.readiness.reason] ??
            diagnostics.readiness.reason
          }
          detail={diagnostics.readiness.reason}
        />
        <DiagnosticFact
          label="完整性 Epoch"
          value={
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono">
                {diagnostics.runtime_state_epoch.state} · v
                {diagnostics.runtime_state_epoch.revision}
              </span>
              <Badge
                variant={
                  diagnostics.runtime_state_epoch.match ? "outline" : "destructive"
                }
              >
                {diagnostics.runtime_state_epoch.match ? "匹配" : "不匹配"}
              </Badge>
            </span>
          }
        />
        <OperationFact label="Endpoint 围栏" summary={diagnostics.operations.endpoint_routing} />
        <OperationFact label="运行态控制" summary={diagnostics.operations.runtime_control} />
      </CardContent>
    </Card>
  );
}

function DiagnosticFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
      {detail ? (
        <div className="text-muted-foreground mt-0.5 break-all font-mono text-xs">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function OperationFact({
  label,
  summary,
}: {
  label: string;
  summary: RuntimeOperationSummary;
}) {
  return (
    <DiagnosticFact
      label={label}
      value={<span className="tabular-nums">{summary.nonterminal_count} 个待收口</span>}
      detail={
        summary.oldest_age_seconds == null
          ? "无等待操作"
          : `最老 ${formatAge(summary.oldest_age_seconds)}`
      }
    />
  );
}

export function formatAge(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) return `${safeSeconds} 秒`;
  if (safeSeconds < 3_600) {
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return remainder === 0 ? `${minutes} 分钟` : `${minutes} 分 ${remainder} 秒`;
  }
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分`;
}
