import { useState, useMemo, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import {
  createModelFromCatalog,
  getCatalogEntry,
  type CatalogCapabilityHint,
  type CatalogEntry,
  type CatalogEntryDetail,
} from "@/lib/api/modelCatalog";
import { listCapabilityKeys, type SupportLevel } from "@/lib/api/capability";
import { AddCapabilitiesDialog } from "@/components/capability/AddCapabilitiesDialog";
import { apiErrorMessage } from "@/lib/api/client";
import { roundPrice3 } from "@/lib/format";
import { HintLabel } from "@/components/common/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
import {
  Field,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

// 去掉 lab/ 前缀，作为 model_id 默认值（阶段 14 Q1）。
function strippedModelID(canonicalID: string): string {
  const idx = canonicalID.indexOf("/");
  return idx >= 0 ? canonicalID.slice(idx + 1) : canonicalID;
}

// 从目录采纳：预填 model_id（去前缀）/元数据/能力清单，全部可改后原子创建。
export function AdoptFromCatalogDialog({
  entry,
  children,
}: {
  entry: CatalogEntry;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["model-catalog-entry", entry.canonical_id],
    queryFn: () => getCatalogEntry(entry.canonical_id),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>采纳为模型</DialogTitle>
          <DialogDescription>
            来自目录 <span className="font-mono">{entry.canonical_id}</span>
            ，预填值可改；提交后创建一个可独立编辑的运营模型并与目录关联（用于追更）。
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isPending ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            <Spinner data-icon="inline-start" />
            加载目录条目...
          </div>
        ) : detailQuery.isError ? (
          <p className="text-destructive py-8 text-center text-sm">
            {apiErrorMessage(detailQuery.error)}
          </p>
        ) : (
          // 详情加载完才挂载表单：能力初值直接来自 props，无需 effect 同步。
          <AdoptForm
            entry={entry}
            detail={detailQuery.data}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdoptForm({
  entry,
  detail,
  onDone,
}: {
  entry: CatalogEntry;
  detail: CatalogEntryDetail;
  onDone: () => void;
}) {
  const [modelId, setModelId] = useState(strippedModelID(entry.canonical_id));
  const [displayName, setDisplayName] = useState(entry.display_name);
  const [ownedBy, setOwnedBy] = useState(entry.lab);
  const [status, setStatus] = useState("disabled");
  const [caps, setCaps] = useState<CatalogCapabilityHint[]>(detail.capabilities);
  const [modelIdError, setModelIdError] = useState("");

  const queryClient = useQueryClient();
  const keysQuery = useQuery({
    queryKey: ["capability-keys", "v2"],
    queryFn: listCapabilityKeys,
  });

  const mutation = useMutation({
    mutationFn: () => {
      // 采纳价只保留三位小数后入库。
      const inputPrice = roundPrice3(entry.input_price_usd_per_million_tokens);
      const outputPrice = roundPrice3(entry.output_price_usd_per_million_tokens);
      return createModelFromCatalog({
        canonical_id: entry.canonical_id,
        model_id: modelId.trim(),
        display_name: displayName.trim(),
        owned_by: ownedBy.trim(),
        status,
        context_window_tokens: entry.context_window_tokens,
        max_output_tokens: entry.max_output_tokens,
        input_price_usd_per_million_tokens: inputPrice === "" ? null : inputPrice,
        output_price_usd_per_million_tokens: outputPrice === "" ? null : outputPrice,
        release_date: entry.release_date,
        capabilities: caps,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["model-catalog"] });
      toast.success(`已采纳为模型「${saved.model_id}」`);
      onDone();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!MODEL_ID_PATTERN.test(modelId.trim())) {
      setModelIdError("字母或数字开头，仅含字母、数字与 . _ : -，长度 1–128");
      return;
    }
    setModelIdError("");
    mutation.mutate();
  }

  const availableKeys = (keysQuery.data ?? []).filter(
    (k) => !caps.some((c) => c.capability_key === k.key),
  );
  const keyDefByKey = useMemo(
    () => new Map((keysQuery.data ?? []).map((k) => [k.key, k])),
    [keysQuery.data],
  );

  function addCapabilities(keys: string[]) {
    setCaps((prev) => [
      ...prev,
      ...keys.map((key) => ({
        capability_key: key,
        support_level: "full" as SupportLevel,
        limits: null,
      })),
    ]);
  }
  function setCapLevel(key: string, level: SupportLevel) {
    setCaps((prev) =>
      prev.map((c) =>
        c.capability_key === key ? { ...c, support_level: level } : c,
      ),
    );
  }
  function removeCap(key: string) {
    setCaps((prev) => prev.filter((c) => c.capability_key !== key));
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!modelIdError}>
            <HintLabel
              htmlFor="adopt_model_id"
              hint="客户调用 API 时使用的模型名；字母或数字开头，仅含字母、数字与 . _ : -，长度 1–128；创建后不可修改。"
            >
              对外模型 ID
            </HintLabel>
            <Input
              id="adopt_model_id"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              aria-invalid={!!modelIdError}
              autoFocus
            />
            <FieldError>{modelIdError}</FieldError>
          </Field>
          <Field>
            <HintLabel htmlFor="adopt_display_name" hint="模型对外展示名称，用于后台与客户端展示。">
              展示名
            </HintLabel>
            <Input
              id="adopt_display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <HintLabel htmlFor="adopt_owned_by" hint="模型归属方/提供方标识（如 deepseek、openai）。">
              归属方
            </HintLabel>
            <Input
              id="adopt_owned_by"
              value={ownedBy}
              onChange={(e) => setOwnedBy(e.target.value)}
            />
          </Field>
          <Field>
            <HintLabel htmlFor="adopt_status" hint="采纳后模型的初始状态；停用则暂不对客户开放调用。">
              状态
            </HintLabel>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="adopt_status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">启用</SelectItem>
                <SelectItem value="disabled">停用</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <HintLabel hint="从目录预填的模型能力清单，可增删条目或调整支持级别后再采纳。">
            能力 ({caps.length})
          </HintLabel>
          <div className="flex flex-col gap-2">
            {caps.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                无能力提示，可在下方新增。
              </p>
            ) : (
              <ul className="divide-border max-h-60 divide-y overflow-y-auto rounded-md border">
                {caps.map((c) => {
                  const def = keyDefByKey.get(c.capability_key);
                  return (
                  <li
                    key={c.capability_key}
                    className="flex items-center gap-2 p-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm">{c.capability_key}</span>
                      </div>
                      {def?.display_name && (
                        <span className="text-muted-foreground text-xs">
                          {def.display_name}
                        </span>
                      )}
                    </div>
                    <Select
                      value={c.support_level}
                      onValueChange={(v) =>
                        setCapLevel(c.capability_key, v as SupportLevel)
                      }
                    >
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">full</SelectItem>
                        <SelectItem value="limited">limited</SelectItem>
                        <SelectItem value="unsupported">unsupported</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="移除"
                      onClick={() => removeCap(c.capability_key)}
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                  );
                })}
              </ul>
            )}
            {keysQuery.isPending ? (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <Spinner data-icon="inline-start" />
                加载能力字典…
              </p>
            ) : keysQuery.isError ? (
              <p className="text-destructive text-sm">
                {apiErrorMessage(keysQuery.error)}
              </p>
            ) : availableKeys.length > 0 ? (
              <AddCapabilitiesDialog
                keys={availableKeys}
                onConfirm={addCapabilities}
              />
            ) : (keysQuery.data?.length ?? 0) > 0 ? (
              <p className="text-muted-foreground text-sm">
                已包含能力字典中的全部 key。
              </p>
            ) : (
              <p className="text-destructive text-sm">
                能力字典为空，请确认 capability_keys 已迁移 seed。
              </p>
            )}
          </div>
        </Field>
      </FieldGroup>

      <DialogFooter className="mt-6">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            取消
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          {mutation.isPending ? "采纳中..." : "采纳"}
        </Button>
      </DialogFooter>
    </form>
  );
}
