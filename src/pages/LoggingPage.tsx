import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EyeIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  getGatewayLogging,
  getGatewayLogs,
  startGatewayDebugSession,
  stopGatewayDebugSession,
  type GatewayLogEntry,
  type GatewayLogFilters,
  type GatewayLogLevel,
  type GatewayLoggingInstance,
  type GatewayLoggingSnapshot,
} from "@/lib/api/system";
import { apiErrorMessage } from "@/lib/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const GATEWAY_LOGGING_QUERY_KEY = ["gateway-logging"] as const;
const GATEWAY_LOGS_QUERY_KEY = ["gateway-logs"] as const;
const DEBUG_DURATIONS = [5, 15, 30, 60] as const;
type DebugDuration = (typeof DEBUG_DURATIONS)[number];

const DEFAULT_LOG_FILTERS: GatewayLogFilters = {
  range: "1h",
  level: "",
  type: "",
  event: "",
  related_id: "",
  search: "",
  limit: 100,
};

const INSTANCE_STATE: Record<
  GatewayLoggingInstance["state"],
  { label: string; variant: "outline" | "secondary" | "destructive" }
> = {
  applied: { label: "已应用", variant: "secondary" },
  pending: { label: "同步中", variant: "outline" },
  unreachable: { label: "不可达", variant: "destructive" },
  environment_debug: { label: "环境变量 DEBUG", variant: "secondary" },
};

export function LoggingPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duration, setDuration] = useState<DebugDuration>(15);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [draftFilters, setDraftFilters] = useState<GatewayLogFilters>(
    DEFAULT_LOG_FILTERS,
  );
  const [filters, setFilters] = useState<GatewayLogFilters>(DEFAULT_LOG_FILTERS);
  const [selectedLog, setSelectedLog] = useState<GatewayLogEntry | null>(null);
  const now = useCurrentSecond();

  const query = useQuery({
    queryKey: GATEWAY_LOGGING_QUERY_KEY,
    queryFn: getGatewayLogging,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const logsQuery = useQuery({
    queryKey: [...GATEWAY_LOGS_QUERY_KEY, filters],
    queryFn: () => getGatewayLogs(filters),
    refetchInterval: false,
  });

  const refreshSnapshot = (snapshot: GatewayLoggingSnapshot) => {
    queryClient.setQueryData(GATEWAY_LOGGING_QUERY_KEY, snapshot);
  };
  const startMutation = useMutation({
    mutationFn: startGatewayDebugSession,
    onSuccess: (snapshot) => {
      refreshSnapshot(snapshot);
      setDialogOpen(false);
      setReason("");
      setReasonTouched(false);
      toast.success("DEBUG 会话已提交");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });
  const stopMutation = useMutation({
    mutationFn: stopGatewayDebugSession,
    onSuccess: (snapshot) => {
      refreshSnapshot(snapshot);
      toast.success("Gateway DEBUG 已关闭");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>日志状态加载失败</AlertTitle>
        <AlertDescription>{apiErrorMessage(query.error)}</AlertDescription>
      </Alert>
    );
  }

  const snapshot = query.data;
  const unhealthy = snapshot.instances.filter(
    (instance) => instance.state === "pending" || instance.state === "unreachable",
  );
  const expiresAt = snapshot.control.expires_at
    ? new Date(snapshot.control.expires_at)
    : null;
  const remainingMs = expiresAt ? Math.max(0, expiresAt.getTime() - now) : 0;
  const reasonInvalid = reasonTouched && reason.trim().length === 0;

  const submitDebug = () => {
    setReasonTouched(true);
    const normalized = reason.trim();
    if (!normalized) return;
    startMutation.mutate({ duration_minutes: duration, reason: normalized });
  };
  const applyFilters = () => {
    setFilters({
      ...draftFilters,
      type: draftFilters.type.trim(),
      event: draftFilters.event.trim(),
      related_id: draftFilters.related_id.trim(),
      search: draftFilters.search.trim(),
    });
  };
  const resetFilters = () => {
    setDraftFilters(DEFAULT_LOG_FILTERS);
    setFilters(DEFAULT_LOG_FILTERS);
  };

  return (
    <div className="flex flex-col gap-4">
      {unhealthy.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Gateway 日志状态未完全同步</AlertTitle>
          <AlertDescription>
            {unhealthy.length} 个实例仍在同步或当前不可达。
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Gateway 日志级别</CardTitle>
          <CardDescription>{modeDescription(snapshot)}</CardDescription>
          <CardAction>
            <ModeBadge mode={snapshot.mode} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="当前模式" value={modeLabel(snapshot.mode)} />
          <Fact
            label="剩余时间"
            value={snapshot.control.active ? formatRemaining(remainingMs) : "—"}
          />
          <Fact
            label="到期时间"
            value={expiresAt ? formatDateTime(expiresAt) : "—"}
          />
          <Fact label="配置版本" value={`v${snapshot.control.revision}`} />
          {snapshot.control.active ? (
            <>
              <Fact
                label="开始时间"
                value={formatOptionalDateTime(snapshot.control.started_at)}
              />
              <Fact
                label="开启人"
                value={operatorLabel(snapshot.control.enabled_by_user_id)}
              />
              <div className="sm:col-span-2">
                <Fact label="开启原因" value={snapshot.control.reason || "—"} />
              </div>
            </>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {snapshot.mode === "environment_debug" ? null : snapshot.control.active ? (
            <Button
              variant="destructive"
              disabled={stopMutation.isPending}
              onClick={() => stopMutation.mutate()}
            >
              {stopMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              关闭 DEBUG
            </Button>
          ) : (
            <Button onClick={() => setDialogOpen(true)}>开启 DEBUG</Button>
          )}
          {snapshot.mode !== "environment_debug" && snapshot.control.active ? (
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              延长会话
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            aria-label="刷新日志级别状态"
            title="刷新日志级别状态"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近日志</CardTitle>
          <CardDescription>{logResultDescription(logsQuery.data?.items.length, filters)}</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="刷新日志"
              title="刷新日志"
              disabled={logsQuery.isFetching}
              onClick={() => void logsQuery.refetch()}
            >
              {logsQuery.isFetching ? <Spinner /> : <RefreshCwIcon />}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <FieldGroup className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="gateway-log-range">时间范围</FieldLabel>
                <Select
                  value={draftFilters.range}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      range: value as GatewayLogFilters["range"],
                    }))
                  }
                >
                  <SelectTrigger id="gateway-log-range" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="15m">最近 15 分钟</SelectItem>
                      <SelectItem value="1h">最近 1 小时</SelectItem>
                      <SelectItem value="6h">最近 6 小时</SelectItem>
                      <SelectItem value="24h">最近 24 小时</SelectItem>
                      <SelectItem value="7d">最近 7 天</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="gateway-log-level">等级</FieldLabel>
                <Select
                  value={draftFilters.level || "all"}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      level: value === "all" ? "" : (value as GatewayLogLevel),
                    }))
                  }
                >
                  <SelectTrigger id="gateway-log-level" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">全部等级</SelectItem>
                      <SelectItem value="debug">DEBUG</SelectItem>
                      <SelectItem value="info">INFO</SelectItem>
                      <SelectItem value="warning">WARNING</SelectItem>
                      <SelectItem value="error">ERROR</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="gateway-log-type">Type</FieldLabel>
                <Input
                  id="gateway-log-type"
                  maxLength={64}
                  placeholder="http"
                  value={draftFilters.type}
                  onChange={(event) =>
                    setDraftFilters((current) => ({ ...current, type: event.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gateway-log-event">Event</FieldLabel>
                <Input
                  id="gateway-log-event"
                  maxLength={64}
                  placeholder="request"
                  value={draftFilters.event}
                  onChange={(event) =>
                    setDraftFilters((current) => ({ ...current, event: event.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gateway-log-related-id">关联 ID</FieldLabel>
                <Input
                  id="gateway-log-related-id"
                  maxLength={128}
                  placeholder="trace_id / request_id / attempt_id"
                  value={draftFilters.related_id}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      related_id: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field className="xl:col-span-2">
                <FieldLabel htmlFor="gateway-log-search">内容</FieldLabel>
                <Input
                  id="gateway-log-search"
                  maxLength={200}
                  placeholder="message 或 data"
                  value={draftFilters.search}
                  onChange={(event) =>
                    setDraftFilters((current) => ({ ...current, search: event.target.value }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gateway-log-limit">条数</FieldLabel>
                <Select
                  value={String(draftFilters.limit)}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      limit: Number(value) as GatewayLogFilters["limit"],
                    }))
                  }
                >
                  <SelectTrigger id="gateway-log-limit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="50">50 条</SelectItem>
                      <SelectItem value="100">100 条</SelectItem>
                      <SelectItem value="200">200 条</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
                <Button type="submit">
                  <SearchIcon data-icon="inline-start" />
                  查询
                </Button>
                <Button type="button" variant="outline" onClick={resetFilters}>
                  <RotateCcwIcon data-icon="inline-start" />
                  重置
                </Button>
              </div>
            </FieldGroup>
          </form>

          {logsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>日志查询失败</AlertTitle>
              <AlertDescription>{apiErrorMessage(logsQuery.error)}</AlertDescription>
            </Alert>
          ) : logsQuery.isPending ? (
            <LogTableSkeleton />
          ) : logsQuery.data.items.length === 0 ? (
            <Empty className="min-h-48 rounded-none border-0">
              <EmptyHeader>
                <EmptyTitle>没有匹配日志</EmptyTitle>
                <EmptyDescription>当前筛选范围内没有记录。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <LogTable items={logsQuery.data.items} onSelect={setSelectedLog} />
          )}
        </CardContent>
        {logsQuery.data?.truncated ? (
          <CardFooter className="text-xs text-muted-foreground">
            已达到 {logsQuery.data.limit} 条上限。
          </CardFooter>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gateway 实例</CardTitle>
          <CardDescription>{snapshot.instances.length} 个已配置实例</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>实例</TableHead>
                <TableHead>环境</TableHead>
                <TableHead>基线</TableHead>
                <TableHead>当前等级</TableHead>
                <TableHead>应用版本</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.instances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    未配置 Gateway 内部地址
                  </TableCell>
                </TableRow>
              ) : (
                snapshot.instances.map((instance) => (
                  <InstanceRow key={instance.url} instance={instance} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LogDetailSheet entry={selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {snapshot.control.active ? "延长 DEBUG 会话" : "开启 Gateway DEBUG"}
            </DialogTitle>
            <DialogDescription>全 Gateway 日志等级临时变更</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>持续时间</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={String(duration)}
                onValueChange={(value) => {
                  if (value) setDuration(Number(value) as DebugDuration);
                }}
              >
                {DEBUG_DURATIONS.map((minutes) => (
                  <ToggleGroupItem key={minutes} value={String(minutes)}>
                    {minutes} 分钟
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field data-invalid={reasonInvalid || undefined}>
              <FieldLabel htmlFor="gateway-debug-reason">原因</FieldLabel>
              <Textarea
                id="gateway-debug-reason"
                value={reason}
                maxLength={200}
                aria-invalid={reasonInvalid || undefined}
                onBlur={() => setReasonTouched(true)}
                onChange={(event) => setReason(event.target.value)}
              />
              <FieldDescription>{reason.length}/200</FieldDescription>
              {reasonInvalid ? <FieldError>请输入开启原因</FieldError> : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={startMutation.isPending} onClick={submitDebug}>
              {startMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {snapshot.control.active ? "确认延长" : "确认开启"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogTable({
  items,
  onSelect,
}: {
  items: GatewayLogEntry[];
  onSelect: (entry: GatewayLogEntry) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>时间</TableHead>
          <TableHead>等级</TableHead>
          <TableHead>分类</TableHead>
          <TableHead>Message</TableHead>
          <TableHead>关联 ID</TableHead>
          <TableHead>实例</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">操作</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-mono text-xs tabular-nums">
              {formatLogTime(entry.timestamp)}
            </TableCell>
            <TableCell>
              <LogLevelBadge level={entry.level} />
            </TableCell>
            <TableCell>
              <div className="flex min-w-28 flex-col gap-0.5 font-mono text-xs">
                <span>{entry.type}</span>
                <span className="text-muted-foreground">{entry.event}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="max-w-md truncate" title={entry.message}>
                {entry.message}
              </div>
            </TableCell>
            <TableCell>
              <div className="max-w-52 truncate font-mono text-xs" title={relatedID(entry)}>
                {relatedID(entry)}
              </div>
            </TableCell>
            <TableCell>
              <div className="max-w-40 truncate text-xs" title={entry.instance}>
                {entry.instance || "—"}
              </div>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`查看日志 ${entry.id}`}
                title="查看详情"
                onClick={() => onSelect(entry)}
              >
                <EyeIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LogTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function LogDetailSheet({
  entry,
  onOpenChange,
}: {
  entry: GatewayLogEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={entry != null} onOpenChange={onOpenChange}>
      <SheetContent className="max-sm:data-[side=right]:w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>日志详情</SheetTitle>
          <SheetDescription>
            {entry ? `${formatDateTime(new Date(entry.timestamp))} · ${entry.instance || "未知实例"}` : "—"}
          </SheetDescription>
        </SheetHeader>
        {entry ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Fact label="等级" value={entry.level.toUpperCase()} />
              <Fact label="环境" value={entry.environment || "—"} />
              <Fact label="Type" value={entry.type} />
              <Fact label="Event" value={entry.event} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Message</div>
              <div className="mt-1 break-words text-sm font-medium">{entry.message}</div>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="font-heading text-sm font-medium">Data</h3>
              <Table>
                <TableBody>
                  {Object.entries(entry.data)
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="w-32 whitespace-normal break-all align-top font-mono text-xs sm:w-44">
                          {key}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <span className="break-all font-mono text-xs">
                            {formatDataValue(value)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function InstanceRow({ instance }: { instance: GatewayLoggingInstance }) {
  const state = INSTANCE_STATE[instance.state];
  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-48 flex-col gap-0.5">
          <span className="font-medium">{instance.instance_id || "未知实例"}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {instance.url}
          </span>
          {instance.error ? (
            <span className="max-w-80 whitespace-normal text-xs text-destructive">
              {instance.error}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>{instance.environment || "—"}</TableCell>
      <TableCell className="font-mono">{instance.baseline_level || "—"}</TableCell>
      <TableCell className="font-mono">{instance.effective_level || "—"}</TableCell>
      <TableCell className="tabular-nums">
        {instance.applied_revision == null ? "—" : `v${instance.applied_revision}`}
      </TableCell>
      <TableCell>
        <Badge variant={state.variant}>{state.label}</Badge>
      </TableCell>
    </TableRow>
  );
}

function ModeBadge({ mode }: { mode: GatewayLoggingSnapshot["mode"] }) {
  return <Badge variant={mode === "info" ? "outline" : "secondary"}>{modeLabel(mode)}</Badge>;
}

function LogLevelBadge({ level }: { level: GatewayLogLevel }) {
  return (
    <Badge variant={level === "error" ? "destructive" : level === "info" ? "outline" : "secondary"}>
      {level.toUpperCase()}
    </Badge>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function useCurrentSecond(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function modeLabel(mode: GatewayLoggingSnapshot["mode"]): string {
  if (mode === "debug") return "临时 DEBUG";
  if (mode === "environment_debug") return "环境变量 DEBUG";
  return "INFO";
}

function modeDescription(snapshot: GatewayLoggingSnapshot): string {
  if (snapshot.mode === "debug") return `会话 ${snapshot.control.session_id ?? "—"}`;
  if (snapshot.mode === "environment_debug") return "开发环境启动基线";
  return "生产运行基线";
}

export function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: Date): string {
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

function formatLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(date);
}

function formatOptionalDateTime(value?: string): string {
  return value ? formatDateTime(new Date(value)) : "—";
}

function operatorLabel(userID: number): string {
  return userID === 0 ? "管理员" : `管理员 #${userID}`;
}

function relatedID(entry: GatewayLogEntry): string {
  for (const key of ["attempt_id", "request_id", "trace_id", "upstream_request_id"]) {
    const value = entry.data[key];
    if ((typeof value === "string" && value) || typeof value === "number") {
      return String(value);
    }
  }
  return "—";
}

function formatDataValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function logResultDescription(count: number | undefined, filters: GatewayLogFilters): string {
  const range = {
    "15m": "最近 15 分钟",
    "1h": "最近 1 小时",
    "6h": "最近 6 小时",
    "24h": "最近 24 小时",
    "7d": "最近 7 天",
  }[filters.range];
  return count == null ? range : `${range} · ${count} 条`;
}
