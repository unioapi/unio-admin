import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import {
  getProviderRuntime,
  resetProviderBreaker,
  updateProviderOrigin,
  type Provider,
} from "@/lib/api/providers";
import { apiErrorMessage, apiErrorStatus } from "@/lib/api/client";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ProviderRuntimeSection({ provider }: { provider: Provider }) {
  const queryClient = useQueryClient();
  const [originOpen, setOriginOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const runtimeQ = useQuery({
    queryKey: ["provider", provider.id, "runtime"],
    queryFn: () => getProviderRuntime(provider.id),
    refetchInterval: 5_000,
    retry: 1,
  });
  const reset = useMutation({
    mutationFn: () => resetProviderBreaker(provider.id),
    onSuccess: (runtime) => {
      queryClient.setQueryData(["provider", provider.id, "runtime"], runtime);
      toast.success(`已复位服务商「${provider.name}」熔断状态`);
      setResetOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Fact label="API Root" value={provider.origin} mono />
        <Fact label="地址版本" value={`v${provider.origin_revision}`} />
        <Fact label="状态版本" value={`v${provider.status_revision}`} />
        <Fact
          label="运行态"
          value={
            runtimeQ.isError ? (
              <span className="text-destructive">运行态不可用</span>
            ) : runtimeQ.data ? (
              <Badge variant={runtimeQ.data.runtime_sync_state === "active" ? "secondary" : "destructive"}>
                {runtimeQ.data.runtime_sync_state}
              </Badge>
            ) : (
              "加载中…"
            )
          }
        />
      </div>

      {runtimeQ.data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Fact label="生效状态" value={runtimeQ.data.effective_status} />
          <Fact
            label="revision 状态"
            value={`${runtimeQ.data.origin_revision_state} / ${runtimeQ.data.status_revision_state}`}
          />
          <Fact label="Breaker" value={runtimeQ.data.state} />
          <Fact label="Breaker generation" value={String(runtimeQ.data.state_generation)} />
        </div>
      ) : null}

      {runtimeQ.isError ? (
        <Alert variant="destructive">
          <AlertTitle>运行态加载失败</AlertTitle>
          <AlertDescription>{apiErrorMessage(runtimeQ.error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={provider.status === "archived"}
          onClick={() => setOriginOpen(true)}
        >
          修改 API Root
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={runtimeQ.data?.runtime_sync_state !== "active" || reset.isPending}
          onClick={() => setResetOpen(true)}
        >
          <RotateCcwIcon data-icon="inline-start" />
          复位 Provider 熔断
        </Button>
      </div>

      <ProviderAddressDialog
        provider={provider}
        open={originOpen}
        onOpenChange={setOriginOpen}
      />
      <ConfirmActionDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="复位 Provider 熔断状态"
        description={`确认复位「${provider.name}」？当前 Provider breaker 窗口与失败证据将被清空。`}
        confirmLabel="确认复位"
        destructive
        pending={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </div>
  );
}

function ProviderAddressDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState(provider.origin);
  const [confirmEnabledChannels, setConfirmEnabledChannels] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrigin(provider.origin);
    setConfirmEnabledChannels(false);
    setError("");
  }, [open, provider.origin]);

  const mutation = useMutation({
    mutationFn: () =>
      updateProviderOrigin({
        id: provider.id,
        origin: origin.trim(),
        expected_origin_revision: provider.origin_revision,
        confirm_enabled_channels: confirmEnabledChannels,
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["provider", provider.id, "runtime"] });
      toast.success(saved.runtime_sync_pending ? "地址已保存，运行态同步中" : "API Root 已更新");
      onOpenChange(false);
    },
    onError: (failure) => {
      if (apiErrorStatus(failure) === 409 && !confirmEnabledChannels) {
        setConfirmEnabledChannels(true);
        setError("该 Provider 存在启用渠道。再次提交将确认这些渠道立即切换到新地址。");
        return;
      }
      if (apiErrorStatus(failure) === 409) {
        setError("地址版本已变化，请刷新页面后重新修改。");
        return;
      }
      setError(apiErrorMessage(failure));
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidOrigin(origin)) {
      setError("请输入不含参数或片段的 http(s) API Root");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改 Provider API Root</DialogTitle>
          <DialogDescription>
            当前地址版本 v{provider.origin_revision}。提交使用 CAS；冲突时必须刷新后重试。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-api-root">API Root</Label>
            <Input
              id="provider-api-root"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              aria-invalid={!!error}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {confirmEnabledChannels ? (
            <Alert variant="destructive">
              <AlertTitle>确认启用渠道切换地址</AlertTitle>
              <AlertDescription>
                新请求会使用新地址；已取得 permit 的在途请求继续按冻结地址完成。
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>取消</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {confirmEnabledChannels ? "确认切换" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={mono ? "mt-1 truncate font-mono text-xs" : "mt-1 text-sm"}>{value}</div>
    </div>
  );
}

function isValidOrigin(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}
