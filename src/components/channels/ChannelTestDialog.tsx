import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { testChannel, type Channel, type ChannelTestResult } from "@/lib/api/channels";
import { listChannelModels } from "@/lib/api/channelModels";
import { ChannelLastTestDetail } from "@/components/channels/ChannelLastTest";
import { apiErrorMessage } from "@/lib/api/client";
import { formatLatencySec } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { HintLabel } from "@/components/common/field-hint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 自动选模型的哨兵值（Radix Select 不允许空字符串 value）。
const AUTO_MODEL = "__auto__";

// 检测失败错误码 → 简短中文标签（Badge 用）；后端 message 已是可读中文，作详细说明。
const ERROR_CODE_LABEL: Record<string, string> = {
  credential_invalid: "凭据无效",
  model_unavailable: "模型不可用",
  timeout: "超时",
  unreachable: "连不上",
  rate_limited: "被限流",
  protocol_error: "协议错误",
  upstream_error: "上游错误",
  canceled: "已取消",
};

function shortReason(code: string | null): string {
  if (!code) return "异常";
  return ERROR_CODE_LABEL[code] ?? "异常";
}

// 受控弹窗：内层随 open 挂载/卸载，重新打开自动清空上次选择与结果。
export function ChannelTestDialog({
  open,
  onOpenChange,
  channel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <TestPanel channel={channel} />}
      </DialogContent>
    </Dialog>
  );
}

function TestPanel({ channel }: { channel: Channel }) {
  const queryClient = useQueryClient();
  const [model, setModel] = useState<string>(AUTO_MODEL);

  const modelsQuery = useQuery({
    queryKey: ["channel-models", channel.id],
    queryFn: () => listChannelModels(channel.id),
  });
  const models = modelsQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      testChannel(channel.id, {
        model: model === AUTO_MODEL ? undefined : model,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["channel", channel.id] });
      queryClient.invalidateQueries({ queryKey: ["channels", "ops"] });
      if (result.success) {
        toast.success(`检测通过 · ${result.tested_model} · ${formatLatencySec(result.latency_ms)}`);
      } else {
        toast.error(`检测失败 · ${shortReason(result.error_code)}`);
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const result = mutation.data;

  return (
    <>
      <DialogHeader>
        <DialogTitle>检测渠道</DialogTitle>
        <DialogDescription>
          向「{channel.name}」的真实上游发一个最小请求，验证连通性、凭据与模型是否可用。检测会产生一次计费极小的真实请求，不计入客户账单，也不会改变渠道启停状态。探测超时取自系统设置「渠道检测超时」，与渠道行上的用户请求超时无关。
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <LastResult channel={channel} />

        <Field>
          <HintLabel
            htmlFor="test_model"
            hint="留空则自动使用该渠道第一个启用的绑定模型；也可指定某个绑定模型单独检测。"
          >
            测试模型
          </HintLabel>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="test_model">
              <SelectValue placeholder="自动（第一个可用模型）" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_MODEL}>自动（第一个可用模型）</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.model_external_id}>
                  {m.model_external_id}
                  {m.upstream_model !== m.model_external_id ? ` → ${m.upstream_model}` : ""}
                  {m.status !== "enabled" ? "（停用）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {result ? <CurrentResult result={result} /> : null}
      </div>

      <DialogFooter className="mt-6">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            关闭
          </Button>
        </DialogClose>
        <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          {mutation.isPending ? "检测中..." : result ? "重新检测" : "开始检测"}
        </Button>
      </DialogFooter>
    </>
  );
}

// 展示持久化的「最近一次检测」结果（来自 channel.last_test_*）。
function LastResult({ channel }: { channel: Channel }) {
  return <ChannelLastTestDetail info={channel} />;
}

// 展示本次刚触发的检测结果。
function CurrentResult({ result }: { result: ChannelTestResult }) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-sm"
      data-ok={result.success}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={result.success ? "default" : "destructive"}>
          {result.success ? "检测通过" : `检测失败 · ${shortReason(result.error_code)}`}
        </Badge>
        <span className="text-muted-foreground tabular-nums text-xs">
          {formatLatencySec(result.latency_ms)}
        </span>
        {result.http_status > 0 ? (
          <span className="text-muted-foreground tabular-nums text-xs">
            HTTP {result.http_status}
          </span>
        ) : null}
      </div>
      <div className="text-muted-foreground break-all text-xs">
        模型 <span className="font-mono">{result.tested_model}</span>
      </div>
      {!result.success && result.message ? (
        <p className="text-muted-foreground break-words text-xs leading-relaxed">{result.message}</p>
      ) : null}
      {!result.success && result.upstream_error ? (
        <div className="mt-1">
          <div className="text-muted-foreground mb-1 text-xs font-medium">上游响应原文</div>
          <pre className="bg-muted/50 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md p-2 font-mono text-[11px] leading-relaxed">
            {result.upstream_error}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
