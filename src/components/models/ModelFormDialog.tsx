import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createModel, updateModel, type Model } from "@/lib/api/models";
import { apiErrorMessage } from "@/lib/api/client";
import { roundPrice3 } from "@/lib/format";
import { StatusChangeConfirmDialog } from "@/components/common/StatusChangeConfirmDialog";
import { HintLabel } from "@/components/common/field-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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

// 与后端 model.modelIDPattern 保持一致：字母/数字开头，允许字母数字与 . _ : -，长度 1–128。
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

interface FieldErrors {
  model_id?: string;
  display_name?: string;
  owned_by?: string;
  max_output_tokens?: string;
}

// 同一个弹窗承担新建与编辑：传了 model 即编辑（model_id 只读），否则新建。
//
// 支持两种用法：① 传 children 作为内置触发器（自管 open）；② 传 open/onOpenChange 受控
// （供 ModelsPage「新建」下拉的「自定义」项打开，无需独立触发按钮）。
export function ModelFormDialog({
  model,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  model?: Model;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!model;

  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ownedBy, setOwnedBy] = useState("");
  const [status, setStatus] = useState("enabled");
  const [maxOutputTokens, setMaxOutputTokens] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const str = (s: string) => (s.trim() === "" ? null : s.trim());
      const meta = {
        max_output_tokens: num(maxOutputTokens),
        context_window_tokens: num(contextWindow),
        input_price_usd_per_million_tokens: str(inputPrice),
        output_price_usd_per_million_tokens: str(outputPrice),
        release_date: str(releaseDate),
      };
      if (model) {
        return updateModel({
          id: model.id,
          display_name: displayName.trim(),
          owned_by: ownedBy.trim(),
          status,
          ...meta,
        });
      }
      return createModel({
        model_id: modelId.trim(),
        display_name: displayName.trim(),
        owned_by: ownedBy.trim(),
        status,
        ...meta,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      toast.success(
        isEdit ? `已保存「${saved.display_name}」` : `已创建模型「${saved.display_name}」`,
      );
      setOpen(false);
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
    },
  });

  // 打开时按当前 model 预填（编辑）或清空（新建），并清掉上次的校验/请求状态。
  // 用 effect 而非 onOpenChange：受控用法（ModelRowActions 编辑）通过 open prop 程序化打开，
  // 不会触发 Dialog 的 onOpenChange，必须在 open 变 true 时主动回填。
  useEffect(() => {
    if (!open) return;
    setModelId(model?.model_id ?? "");
    setDisplayName(model?.display_name ?? "");
    setOwnedBy(model?.owned_by ?? "");
    setStatus(model?.status ?? "enabled");
    setMaxOutputTokens(
      model?.max_output_tokens != null ? String(model.max_output_tokens) : "",
    );
    setContextWindow(
      model?.context_window_tokens != null
        ? String(model.context_window_tokens)
        : "",
    );
    setInputPrice(roundPrice3(model?.input_price_usd_per_million_tokens));
    setOutputPrice(roundPrice3(model?.output_price_usd_per_million_tokens));
    setReleaseDate(model?.release_date ?? "");
    setErrors({});
    mutation.reset();
    setStatusConfirmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, model?.id]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    // model_id 编辑时只读且已合法，只在新建时校验。
    if (!isEdit && !MODEL_ID_PATTERN.test(modelId.trim())) {
      next.model_id =
        "字母或数字开头，仅含字母、数字与 . _ : -，长度 1–128";
    }
    if (displayName.trim() === "") {
      next.display_name = "展示名不能为空";
    }
    if (ownedBy.trim() === "") {
      next.owned_by = "归属方不能为空";
    }
    if (maxOutputTokens.trim() !== "") {
      const n = Number(maxOutputTokens);
      if (!Number.isInteger(n) || n <= 0) {
        next.max_output_tokens = "需为正整数";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit && model && status !== model.status) {
      setStatusConfirmOpen(true);
      return;
    }
    mutation.mutate();
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑模型" : "新建模型"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "对外模型 ID（model_id）作为稳定标识不可修改。"
              : "model_id 是客户 API 调用时使用的模型名，创建后不可修改。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!errors.model_id}>
              <HintLabel
                htmlFor="model_id"
                hint="客户调用 API 时使用的模型名；字母或数字开头，仅含字母、数字与 . _ : -，长度 1–128；创建后不可修改。"
              >
                对外模型 ID
              </HintLabel>
              <Input
                id="model_id"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="deepseek-chat"
                aria-invalid={!!errors.model_id}
                disabled={isEdit}
                autoFocus={!isEdit}
              />
              <FieldError>{errors.model_id}</FieldError>
            </Field>

            <Field data-invalid={!!errors.display_name}>
              <HintLabel htmlFor="display_name" hint="模型对外展示名称，用于后台与客户端展示。">
                展示名
              </HintLabel>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="DeepSeek Chat"
                aria-invalid={!!errors.display_name}
                autoFocus={isEdit}
              />
              <FieldError>{errors.display_name}</FieldError>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.owned_by}>
                <HintLabel htmlFor="owned_by" hint="模型归属方/提供方标识（如 deepseek、openai）。">
                  归属方
                </HintLabel>
                <Input
                  id="owned_by"
                  value={ownedBy}
                  onChange={(e) => setOwnedBy(e.target.value)}
                  placeholder="deepseek"
                  aria-invalid={!!errors.owned_by}
                />
                <FieldError>{errors.owned_by}</FieldError>
              </Field>

              <Field>
                <HintLabel htmlFor="status" hint="停用后该模型不对客户开放调用。">
                  状态
                </HintLabel>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">启用</SelectItem>
                    <SelectItem value="disabled">停用</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.max_output_tokens}>
                <HintLabel htmlFor="max_output_tokens" hint="模型单次回复的最大输出 token 数；可选。">
                  最大输出 token
                </HintLabel>
                <Input
                  id="max_output_tokens"
                  type="number"
                  min={1}
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(e.target.value)}
                  placeholder="可选"
                  aria-invalid={!!errors.max_output_tokens}
                />
                <FieldError>{errors.max_output_tokens}</FieldError>
              </Field>

              <Field>
                <HintLabel
                  htmlFor="context_window_tokens"
                  hint="模型上下文窗口大小；可选，仅作展示，不参与计费。"
                >
                  上下文长度
                </HintLabel>
                <Input
                  id="context_window_tokens"
                  type="number"
                  min={1}
                  value={contextWindow}
                  onChange={(e) => setContextWindow(e.target.value)}
                  placeholder="可选（仅展示）"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field>
                <HintLabel
                  htmlFor="input_price"
                  hint="输入侧价格基线（USD/百万 token）；仅作展示，不参与计费（计费以售价/成本价为准）。"
                >
                  输入价格基线
                </HintLabel>
                <Input
                  id="input_price"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  placeholder="USD/百万 token"
                />
              </Field>
              <Field>
                <HintLabel
                  htmlFor="output_price"
                  hint="输出侧价格基线（USD/百万 token）；仅作展示，不参与计费（计费以售价/成本价为准）。"
                >
                  输出价格基线
                </HintLabel>
                <Input
                  id="output_price"
                  value={outputPrice}
                  onChange={(e) => setOutputPrice(e.target.value)}
                  placeholder="USD/百万 token"
                />
              </Field>
              <Field>
                <HintLabel htmlFor="release_date" hint="模型发布日期；可选，仅作展示。">
                  发布日期
                </HintLabel>
                <DatePicker
                  id="release_date"
                  value={releaseDate}
                  onChange={setReleaseDate}
                  placeholder="可选"
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              {mutation.isPending ? "保存中..." : isEdit ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {isEdit && model ? (
      <StatusChangeConfirmDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
        entityLabel="模型"
        entityName={displayName.trim() || model.display_name}
        enabling={status === "enabled"}
        pending={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    ) : null}
    </>
  );
}
