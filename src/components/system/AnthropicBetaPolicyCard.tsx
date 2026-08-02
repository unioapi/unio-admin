import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAnthropicBetaPolicy,
  updateAnthropicBetaPolicy,
  listSettings,
  type AnthropicBetaMode,
  type AnthropicBetaPolicy,
} from "@/lib/api/system";
import { apiErrorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODE_HINT: Record<AnthropicBetaMode, string> = {
  passthrough: "全透传：客户端发的所有 anthropic-beta 头都原样转发上游（最宽松）。",
  filter: "黑名单：默认透传，仅下方清单里的 beta 不转发上游（推荐）。",
  whitelist: "白名单：只有下方清单里的 beta 才转发上游，其余全部拦截（最严）。",
};

const LIST_LABEL: Record<AnthropicBetaMode, string> = {
  passthrough: "beta 清单（passthrough 模式下忽略）",
  filter: "黑名单（每行一个 beta，不转发上游）",
  whitelist: "白名单（每行一个 beta，仅这些转发上游）",
};

function toText(list: string[]): string {
  return list.join("\n");
}

function fromText(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Anthropic beta 转发策略：管理端可编辑，gateway 约 30s 内热更新（无需重启）。 */
export function AnthropicBetaPolicyCard() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["anthropic-beta-policy"],
    queryFn: getAnthropicBetaPolicy,
  });

  const [mode, setMode] = useState<AnthropicBetaMode>("filter");
  const [listText, setListText] = useState("");

  // 加载完成后用服务端值初始化本地表单（仅在数据变化时同步）。
  useEffect(() => {
    if (query.data) {
      setMode(query.data.mode);
      setListText(toText(query.data.list));
    }
  }, [query.data]);

  // 生效值探针：/settings 返回的 value/source 就是 gateway 经 Redis 读到的当前值，用于验证配置已传播。
  const effective = useQuery({
    queryKey: ["settings-effective"],
    queryFn: ({ signal }) => listSettings(signal),
    refetchInterval: 5000,
  });
  const betaEffective = effective.data?.find((s) => s.key === "anthropic.beta_policy");

  const mutation = useMutation({
    mutationFn: (policy: AnthropicBetaPolicy) => updateAnthropicBetaPolicy(policy),
    onSuccess: (saved) => {
      toast.success("已保存 Anthropic beta 策略");
      queryClient.setQueryData(["anthropic-beta-policy"], saved);
      void effective.refetch();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const sourceLabel: Record<string, string> = {
    redis: "已生效（Redis 实时源，gateway 秒级读到）",
    db: "数据库（Redis 未命中，回退库）",
    default: "内置默认（尚未保存过）",
  };

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>{apiErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  }

  if (query.isPending) {
    return <Skeleton className="h-72 w-full max-w-2xl" />;
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-sm">Anthropic · beta 头转发策略</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert>
          <AlertTitle>作用范围</AlertTitle>
          <AlertDescription>
            控制发往 Anthropic 官方上游的 <code>anthropic-beta</code> 头。修改后 gateway 约 30
            秒内生效，无需重启。默认「黑名单」仅拦截 <code>context-1m-2025-08-07</code>
            （遗留模型分层价缺口）。
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Label htmlFor="beta_mode">模式</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as AnthropicBetaMode)}>
            <SelectTrigger id="beta_mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="passthrough">透传（全部转发）</SelectItem>
              <SelectItem value="filter">黑名单（默认）</SelectItem>
              <SelectItem value="whitelist">白名单（最严）</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{MODE_HINT[mode]}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="beta_list">{LIST_LABEL[mode]}</Label>
          <Textarea
            id="beta_list"
            value={listText}
            onChange={(e) => setListText(e.target.value)}
            disabled={mode === "passthrough"}
            rows={6}
            placeholder={"context-1m-2025-08-07\ncode-execution-2025-05-22"}
            className="font-mono text-xs"
          />
          <p className="text-muted-foreground text-xs">
            每行一个 beta 名，如 <code>context-1m-2025-08-07</code>。留空即不拦截任何 beta。
          </p>
        </div>

        {betaEffective && (
          <div className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
            <span className="font-medium text-foreground">当前生效</span>
            {"："}
            {sourceLabel[betaEffective.source] ?? betaEffective.source}
            <span className="ml-1 font-mono">{JSON.stringify(betaEffective.value)}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={() => mutation.mutate({ mode, list: fromText(listText) })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "保存中…" : "保存"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const defaults = betaEffective?.default as
                | AnthropicBetaPolicy
                | undefined;
              if (!defaults) {
                toast.error("尚未拿到代码默认值，请稍后重试");
                return;
              }
              setMode(defaults.mode);
              setListText(toText(defaults.list ?? []));
            }}
            disabled={mutation.isPending}
          >
            恢复默认
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
