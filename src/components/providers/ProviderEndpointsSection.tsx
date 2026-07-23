import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIcon,
  ArchiveIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  PlusIcon,
  RotateCcwIcon,
  Settings2Icon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createProviderEndpoint,
  getProviderEndpointRuntime,
  listProviderEndpoints,
  resetProviderEndpointBreaker,
  updateProviderEndpointBaseURL,
  updateProviderEndpointName,
  updateProviderEndpointStatus,
  type CreatableProviderEndpointStatus,
  type ProviderEndpoint,
  type ProviderEndpointStatus,
} from "@/lib/api/providerEndpoints";
import type { RuntimeSyncState } from "@/lib/api/runtime";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { HintLabel } from "@/components/common/field-hint";
import {
  ErrorBox,
  SectionEmpty,
  TableSkeleton,
} from "@/components/common/detail-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ENDPOINTS_QUERY_KEY = "provider-endpoints";

const RUNTIME_SYNC_COPY: Record<
  RuntimeSyncState,
  { label: string; description: string }
> = {
  active: { label: "已同步", description: "数据库版本与 Redis 运行态一致。" },
  runtime_sync_pending: {
    label: "配置同步中",
    description: "数据库已提交，Redis 运行态尚未确认；新上游准入已拒绝。",
  },
  runtime_sync_required: {
    label: "待建立运行态",
    description: "运行态 control 缺失；新上游准入已拒绝。",
  },
  stale: {
    label: "运行态已过期",
    description: "数据库与 Redis revision 不一致；旧快照不作为当前事实展示。",
  },
  store_unavailable: {
    label: "基础设施故障",
    description: "Redis 或 BreakerStore 不可用；新上游准入已拒绝。",
  },
  runtime_state_lost: {
    label: "运行态完整性丢失",
    description: "完整性门禁未恢复；新上游准入已拒绝。",
  },
};

function endpointSyncState(endpoint: ProviderEndpoint): RuntimeSyncState {
  if (endpoint.runtime_sync_state) return endpoint.runtime_sync_state;
  return endpoint.runtime_sync_pending ? "runtime_sync_pending" : "active";
}

export function ProviderEndpointsSection({
  providerId,
}: {
  providerId: number;
}) {
  const query = useQuery({
    queryKey: [ENDPOINTS_QUERY_KEY, "by-provider", providerId],
    queryFn: () => listProviderEndpoints({ providerId }),
  });

  if (query.isPending) return <TableSkeleton rows={4} cols={7} />;
  if (query.isError) return <ErrorBox message={apiErrorMessage(query.error)} />;

  const endpoints = query.data.items;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm tabular-nums">
          共 {query.data.total} 个端点
        </span>
        <ProviderEndpointFormDialog providerId={providerId}>
          <Button size="sm">
            <PlusIcon data-icon="inline-start" />
            新建端点
          </Button>
        </ProviderEndpointFormDialog>
      </div>

      {endpoints.length === 0 ? (
        <SectionEmpty
          icon={ActivityIcon}
          title="暂无端点"
          description="创建一个上游 API Root 后，渠道才能绑定并参与路由"
        />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>端点</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>渠道</TableHead>
                <TableHead>熔断 / 错误率</TableHead>
                <TableHead>运行态同步</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell className="max-w-96">
                    <div className="font-medium">{endpoint.name}</div>
                    <div className="text-muted-foreground truncate font-mono text-xs">
                      {endpoint.base_url}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={endpoint.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    <div>
                      数据库：地址 v{endpoint.base_url_revision} · 状态 v
                      {endpoint.status_revision}
                    </div>
                    <div className="mt-1">
                      Redis：地址 v
                      {endpoint.runtime_active_base_url_revision || "—"} · 状态
                      v{endpoint.runtime_active_status_revision || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {endpoint.channel_count}
                  </TableCell>
                  <TableCell>
                    <EndpointRuntimeSummary endpoint={endpoint} />
                  </TableCell>
                  <TableCell>
                    <RuntimeSyncBadge state={endpointSyncState(endpoint)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <EndpointRuntimeDialog endpoint={endpoint} />
                      <EndpointStatusActions endpoint={endpoint} />
                      <ProviderEndpointFormDialog
                        providerId={providerId}
                        endpoint={endpoint}
                      >
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`编辑 ${endpoint.name}`}
                          title={
                            endpointSyncState(endpoint) === "active"
                              ? `编辑 ${endpoint.name}`
                              : "运行态未同步，暂不能修改"
                          }
                          disabled={endpointSyncState(endpoint) !== "active"}
                        >
                          <Settings2Icon />
                        </Button>
                      </ProviderEndpointFormDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function ProviderEndpointFormDialog({
  providerId,
  endpoint,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  providerId: number;
  endpoint?: ProviderEndpoint;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [status, setStatus] =
    useState<CreatableProviderEndpointStatus>("enabled");
  const [errors, setErrors] = useState<{ name?: string; base_url?: string }>(
    {},
  );
  const queryClient = useQueryClient();

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  useEffect(() => {
    if (!open) return;
    setName(endpoint?.name ?? "");
    setBaseURL(endpoint?.base_url ?? "");
    setStatus(endpoint?.status === "disabled" ? "disabled" : "enabled");
    setErrors({});
  }, [endpoint, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!endpoint) {
        return createProviderEndpoint({
          provider_id: providerId,
          name: name.trim(),
          base_url: baseURL.trim(),
          status,
        });
      }

      let saved = endpoint;
      if (name.trim() !== endpoint.name) {
        saved = await updateProviderEndpointName(endpoint.id, name.trim());
      }
      if (baseURL.trim() !== endpoint.base_url) {
        saved = await updateProviderEndpointBaseURL(
          endpoint.id,
          baseURL.trim(),
        );
      }
      return saved;
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: [ENDPOINTS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["providers"] });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      toast.success(
        endpointSyncState(saved) !== "active"
          ? `端点「${saved.name}」已保存，运行态同步待恢复`
          : endpoint
            ? `已保存端点「${saved.name}」`
            : `已创建端点「${saved.name}」`,
      );
      setOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: { name?: string; base_url?: string } = {};
    if (!name.trim()) next.name = "名称不能为空";
    if (!isValidEndpointURL(baseURL.trim())) {
      next.base_url = "请输入不含参数或片段的 http(s) API Root";
    }
    setErrors(next);
    if (Object.keys(next).length === 0) mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {endpoint ? "编辑端点" : "新建端点"}
          </DialogTitle>
          <DialogDescription>
            一个端点对应一个上游 API Root，也是独立熔断的公共故障域。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <HintLabel
                htmlFor="endpoint_name"
                hint="同一服务商下用于区分上游入口的名称。"
              >
                名称
              </HintLabel>
              <Input
                id="endpoint_name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="primary"
                aria-invalid={!!errors.name}
                autoFocus
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={!!errors.base_url}>
              <HintLabel
                htmlFor="endpoint_base_url"
                hint="API Root 由端点独占；修改后地址版本递增，旧请求结果不会污染新运行态。"
              >
                API Root
              </HintLabel>
              <Input
                id="endpoint_base_url"
                value={baseURL}
                onChange={(event) => setBaseURL(event.target.value)}
                placeholder="https://api.example.com/v1"
                aria-invalid={!!errors.base_url}
              />
              <FieldError>{errors.base_url}</FieldError>
            </Field>
            {!endpoint ? (
              <Field>
                <HintLabel
                  htmlFor="endpoint_status"
                  hint="停用后该端点下的新渠道尝试不再准入。"
                >
                  状态
                </HintLabel>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as CreatableProviderEndpointStatus)
                  }
                >
                  <SelectTrigger id="endpoint_status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="enabled">启用</SelectItem>
                      <SelectItem value="disabled">停用</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {mutation.isPending ? "保存中..." : endpoint ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EndpointStatusActions({ endpoint }: { endpoint: ProviderEndpoint }) {
  const [nextStatus, setNextStatus] = useState<ProviderEndpointStatus>();
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: (status: ProviderEndpointStatus) =>
      updateProviderEndpointStatus(endpoint.id, status),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: [ENDPOINTS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      const action =
        saved.status === "enabled"
          ? "启用"
          : saved.status === "disabled"
            ? endpoint.status === "archived"
              ? "恢复"
              : "停用"
            : "归档";
      toast.success(
        endpointSyncState(saved) !== "active"
          ? `端点「${saved.name}」已${action}，运行态同步待恢复`
          : `已${action}端点「${saved.name}」`,
      );
      setNextStatus(undefined);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const archived = endpoint.status === "archived";
  const runtimeConflicted = endpointSyncState(endpoint) !== "active";
  const toggleStatus: ProviderEndpointStatus = archived
    ? "disabled"
    : endpoint.status === "enabled"
      ? "disabled"
      : "enabled";
  const ToggleIcon = archived
    ? Undo2Icon
    : endpoint.status === "enabled"
      ? CirclePauseIcon
      : CirclePlayIcon;
  const toggleLabel = archived
    ? "恢复为停用"
    : endpoint.status === "enabled"
      ? "停用"
      : "启用";

  const confirmTitle =
    nextStatus === "archived"
      ? "归档端点"
      : nextStatus === "enabled"
        ? "启用端点"
        : archived
          ? "恢复端点"
          : "停用端点";
  const confirmDescription =
    nextStatus === "archived"
      ? `确认归档「${endpoint.name}」？只有未绑定渠道的端点才能归档。`
      : nextStatus === "enabled"
        ? `确认启用「${endpoint.name}」？运行态同步完成后，其下符合条件的渠道可参与路由。`
        : archived
          ? `确认恢复「${endpoint.name}」为停用？恢复后不会自动参与路由。`
          : `确认停用「${endpoint.name}」？其下渠道的新上游尝试将停止准入。`;

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`${toggleLabel} ${endpoint.name}`}
        title={
          runtimeConflicted
            ? "运行态未同步，暂不能修改状态"
            : `${toggleLabel} ${endpoint.name}`
        }
        disabled={runtimeConflicted}
        onClick={() => setNextStatus(toggleStatus)}
      >
        <ToggleIcon />
      </Button>
      {!archived ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`归档 ${endpoint.name}`}
          title={
            endpoint.channel_count > 0
              ? `仍绑定 ${endpoint.channel_count} 个渠道，不能归档`
              : `归档 ${endpoint.name}`
          }
          disabled={runtimeConflicted || endpoint.channel_count > 0}
          onClick={() => setNextStatus("archived")}
        >
          <ArchiveIcon />
        </Button>
      ) : null}
      <ConfirmActionDialog
        open={nextStatus != null}
        onOpenChange={(open) => {
          if (!open) setNextStatus(undefined);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={
          nextStatus === "archived" ? "确认归档" : `确认${toggleLabel}`
        }
        destructive={nextStatus === "archived" || nextStatus === "disabled"}
        pending={statusMutation.isPending}
        onConfirm={() => {
          if (nextStatus) statusMutation.mutate(nextStatus);
        }}
      />
    </>
  );
}

function EndpointRuntimeDialog({ endpoint }: { endpoint: ProviderEndpoint }) {
  const [open, setOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const syncState = endpointSyncState(endpoint);
  const runtime = useQuery({
    queryKey: [ENDPOINTS_QUERY_KEY, endpoint.id, "runtime"],
    queryFn: () => getProviderEndpointRuntime(endpoint.id),
    enabled: open && syncState === "active",
    retry: 1,
  });
  const reset = useMutation({
    mutationFn: () => resetProviderEndpointBreaker(endpoint.id),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(
        [ENDPOINTS_QUERY_KEY, endpoint.id, "runtime"],
        snapshot,
      );
      toast.success(`已复位端点「${endpoint.name}」熔断状态`);
      setResetConfirmOpen(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const snapshot = runtime.data;
  const stateLabel = !snapshot?.exists
    ? "无运行样本"
    : snapshot.state === "half_open"
      ? "半开"
      : snapshot.state === "open"
        ? "熔断"
        : "关闭";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`查看 ${endpoint.name} 运行态`}
            title={`查看 ${endpoint.name} 运行态`}
          >
            <ActivityIcon />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{endpoint.name} 运行态</DialogTitle>
            <DialogDescription>{endpoint.base_url}</DialogDescription>
          </DialogHeader>

          {syncState !== "active" ? (
            <Alert variant="destructive">
              <AlertTitle>{RUNTIME_SYNC_COPY[syncState].label}</AlertTitle>
              <AlertDescription>
                {RUNTIME_SYNC_COPY[syncState].description}
                旧快照不作为当前事实展示。
              </AlertDescription>
            </Alert>
          ) : runtime.isPending ? (
            <div className="flex min-h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : runtime.isError ? (
            <Alert variant="destructive">
              <AlertTitle>运行态不可用</AlertTitle>
              <AlertDescription>
                基础设施故障，新的上游准入已拒绝。
                {apiErrorMessage(runtime.error)}
              </AlertDescription>
            </Alert>
          ) : snapshot && !snapshot.exists ? (
            <Alert>
              <AlertTitle>无运行样本</AlertTitle>
              <AlertDescription>
                Redis 查询成功，但当前端点尚未产生可展示的熔断样本。
              </AlertDescription>
            </Alert>
          ) : snapshot ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <RuntimeFact label="熔断状态" value={stateLabel} />
              <RuntimeFact
                label="错误率"
                value={formatPercent(snapshot.error_rate)}
              />
              <RuntimeFact
                label="成功 / 失败"
                value={`${snapshot.eligible_successes} / ${snapshot.eligible_failures}`}
              />
              <RuntimeFact
                label="窗口样本"
                value={String(snapshot.sample_count)}
              />
              <RuntimeFact
                label="连续失败"
                value={String(snapshot.consecutive_failures)}
              />
              <RuntimeFact
                label="打开剩余"
                value={
                  snapshot.state === "open"
                    ? `${snapshot.open_remaining_ms} ms`
                    : "—"
                }
              />
            </dl>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                关闭
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={
                reset.isPending ||
                syncState !== "active" ||
                runtime.isPending ||
                runtime.isError
              }
              onClick={() => setResetConfirmOpen(true)}
            >
              <RotateCcwIcon data-icon="inline-start" />
              复位熔断
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="复位端点熔断状态"
        description={`确认复位「${endpoint.name}」？当前熔断窗口和连续失败计数将被清空。`}
        confirmLabel="确认复位"
        destructive
        pending={reset.isPending}
        onConfirm={() => reset.mutate()}
      />
    </>
  );
}

function EndpointRuntimeSummary({ endpoint }: { endpoint: ProviderEndpoint }) {
  const syncState = endpointSyncState(endpoint);
  const runtime = useQuery({
    queryKey: [ENDPOINTS_QUERY_KEY, endpoint.id, "runtime"],
    queryFn: () => getProviderEndpointRuntime(endpoint.id),
    enabled: syncState === "active",
    refetchInterval: syncState === "active" ? 5_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  if (syncState !== "active") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (runtime.isPending) return <Spinner className="size-4" />;
  if (runtime.isError) {
    return (
      <span
        className="text-destructive text-xs"
        title={apiErrorMessage(runtime.error)}
      >
        基础设施故障，准入已拒绝
      </span>
    );
  }
  if (!runtime.data.exists) {
    return <Badge variant="outline">无运行样本</Badge>;
  }

  return (
    <div className="text-xs tabular-nums">
      <div className="flex items-center gap-1.5">
        <Badge
          variant={
            runtime.data.state === "closed" ? "secondary" : "destructive"
          }
        >
          {runtime.data.state === "closed"
            ? "闭合"
            : runtime.data.state === "half_open"
              ? "半开"
              : "熔断中"}
        </Badge>
        {runtime.data.state === "open" ? (
          <span className="text-muted-foreground">
            {Math.ceil(runtime.data.open_remaining_ms / 1_000)} 秒
          </span>
        ) : null}
      </div>
      <div className="text-muted-foreground mt-1">
        错误率 {formatPercent(runtime.data.error_rate)} ·{" "}
        {runtime.data.sample_count} 个样本
      </div>
    </div>
  );
}

function RuntimeSyncBadge({ state }: { state: RuntimeSyncState }) {
  return (
    <Badge variant={state === "active" ? "outline" : "destructive"}>
      {RUNTIME_SYNC_COPY[state].label}
    </Badge>
  );
}

function RuntimeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function isValidEndpointURL(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
