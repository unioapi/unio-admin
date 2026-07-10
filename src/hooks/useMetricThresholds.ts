import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RUNTIME_SETTINGS_QUERY_KEY,
  listSettings,
} from "@/lib/api/system";
import {
  DEFAULT_METRIC_THRESHOLDS,
  type MetricThresholds,
} from "@/components/dashboard/metrics";

// 仪表盘告警灯阈值的消费入口（admin_frontend.dashboard_thresholds）。
//
// 与运行时配置面板共用 RUNTIME_SETTINGS_QUERY_KEY：多组件并发调用被 react-query 去重为
// 一次请求；面板保存后 invalidate，所有仪表盘颜色立即换档。
// fallback 语义：加载中 / 请求失败 / 值形状异常 → 回退 DEFAULT_METRIC_THRESHOLDS
// （与后端注册表默认同源同值），纯展示层,回退默认档位无风险。

const KEY = "admin_frontend.dashboard_thresholds";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 解码后端 snake_case JSON → 前端 camelCase;任一字段缺失/非数值即整体判失败回退默认。 */
function decodeThresholds(value: unknown): MetricThresholds | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const successRateSlo = num(v.success_rate_slo);
  const successRateWarn = num(v.success_rate_warn);
  const ttftWarnMs = num(v.ttft_warn_ms);
  const ttftDangerMs = num(v.ttft_danger_ms);
  const latencyWarnMs = num(v.latency_warn_ms);
  const latencyDangerMs = num(v.latency_danger_ms);
  const profitThinRate = num(v.profit_thin_rate);
  if (
    successRateSlo == null ||
    successRateWarn == null ||
    ttftWarnMs == null ||
    ttftDangerMs == null ||
    latencyWarnMs == null ||
    latencyDangerMs == null ||
    profitThinRate == null
  ) {
    return null;
  }
  return {
    successRateSlo,
    successRateWarn,
    ttftWarnMs,
    ttftDangerMs,
    latencyWarnMs,
    latencyDangerMs,
    profitThinRate,
  };
}

/** 读取当前生效的告警灯阈值；未就绪/失败时返回内置默认。 */
export function useMetricThresholds(): MetricThresholds {
  const query = useQuery({
    queryKey: RUNTIME_SETTINGS_QUERY_KEY,
    queryFn: listSettings,
    staleTime: 30_000,
  });
  const value = query.data?.find((s) => s.key === KEY)?.value;
  return useMemo(
    () => decodeThresholds(value) ?? DEFAULT_METRIC_THRESHOLDS,
    [value],
  );
}
