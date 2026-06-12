import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  BanIcon,
  GaugeIcon,
  KeyRoundIcon,
  PlusIcon,
} from "lucide-react";
import {
  listApiKeys,
  revokeApiKey,
  updateApiKey,
  type ApiKey,
} from "@/lib/api/apiKeys";
import { getProject } from "@/lib/api/projects";
import { apiErrorMessage } from "@/lib/api/client";
import { formatDateTime, trimDecimal } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { TablePagination } from "@/components/common/TablePagination";
import { CreateApiKeyDialog } from "@/components/customer/CreateApiKeyDialog";
import { ApiKeySpendLimitDialog } from "@/components/customer/ApiKeySpendLimitDialog";

const COLS = 7;
const PAGE_SIZE = 20;

export function ApiKeysPage() {
  const { projectId: projectIdParam } = useParams();
  const projectId = Number(projectIdParam);
  const [page, setPage] = useState(1);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: Number.isInteger(projectId) && projectId > 0,
  });

  const query = useQuery({
    queryKey: ["api-keys", projectId, { page }],
    queryFn: () => listApiKeys(projectId, page, PAGE_SIZE),
    enabled: Number.isInteger(projectId) && projectId > 0,
    placeholderData: keepPreviousData,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pageCount) setPage(pageCount);

  return (
    <Card>
      <CardHeader className="border-b">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2 mb-1 w-fit"
        >
          <Link to="/projects">
            <ArrowLeftIcon data-icon="inline-start" />
            返回项目
          </Link>
        </Button>
        <CardTitle>
          API Keys
          {projectQuery.data ? ` · ${projectQuery.data.name}` : ""}
        </CardTitle>
        <CardDescription>
          费用上限为生命周期累计封顶；明文仅创建时展示一次
        </CardDescription>
        <CardAction>
          <CreateApiKeyDialog projectId={projectId}>
            <Button size="sm">
              <PlusIcon data-icon="inline-start" />
              新建
            </Button>
          </CreateApiKeyDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>加载失败</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <Table className={query.isFetching ? "opacity-60" : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>前缀</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">已用 / 上限</TableHead>
                  <TableHead>最近使用</TableHead>
                  <TableHead className="w-16 text-center">启用</TableHead>
                  <TableHead className="w-28 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: COLS }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLS} className="h-48">
                      <ApiKeysEmpty />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {k.key_prefix}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={k.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {trimDecimal(k.spent_total)}
                        {" / "}
                        {k.spend_limit === null ? (
                          <span className="text-muted-foreground">∞</span>
                        ) : (
                          trimDecimal(k.spend_limit)
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {k.last_used_at ? formatDateTime(k.last_used_at) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusToggle apiKey={k} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ApiKeySpendLimitDialog apiKey={k}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="费用上限"
                              disabled={k.status === "revoked"}
                            >
                              <GaugeIcon />
                            </Button>
                          </ApiKeySpendLimitDialog>
                          <RevokeApiKeyDialog apiKey={k}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="吊销"
                              disabled={k.status === "revoked"}
                            >
                              <BanIcon />
                            </Button>
                          </RevokeApiKeyDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <TablePagination
              page={page}
              pageCount={pageCount}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <Badge>启用中</Badge>;
    case "disabled":
      return <Badge variant="secondary">已禁用</Badge>;
    case "revoked":
      return <Badge variant="destructive">已吊销</Badge>;
    case "expired":
      return <Badge variant="outline">已过期</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// 启停开关：吊销/过期不可切换；其余按 disabled 状态翻转。
function StatusToggle({ apiKey }: { apiKey: ApiKey }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (disabled: boolean) =>
      updateApiKey({ id: apiKey.id, disabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["api-keys", apiKey.project_id],
      });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  const lockedOut = apiKey.status === "revoked" || apiKey.status === "expired";

  return (
    <Switch
      checked={apiKey.status === "active"}
      disabled={lockedOut || mutation.isPending}
      onCheckedChange={(checked) => mutation.mutate(!checked)}
      aria-label="启用/禁用"
    />
  );
}

// 吊销确认弹窗：不可逆，需二次确认。
function RevokeApiKeyDialog({
  apiKey,
  children,
}: {
  apiKey: ApiKey;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => revokeApiKey(apiKey.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["api-keys", apiKey.project_id],
      });
      toast.success(`已吊销「${apiKey.name}」`);
      setOpen(false);
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>吊销 API Key</DialogTitle>
          <DialogDescription>
            将永久吊销「{apiKey.name}」（{apiKey.key_prefix}）。此操作不可逆，使用该
            Key 的请求会立即失败。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            {mutation.isPending ? "吊销中..." : "确认吊销"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeysEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <KeyRoundIcon />
        </EmptyMedia>
        <EmptyTitle>暂无 API Key</EmptyTitle>
        <EmptyDescription>该项目下还没有任何 API Key。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
