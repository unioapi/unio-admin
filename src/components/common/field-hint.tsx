import { type ReactNode } from "react";
import { CircleHelpIcon } from "lucide-react";
import { FieldLabel } from "@/components/ui/field";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// FieldHint 是字段标签旁的「圆圈问号」,悬浮显示该字段说明(把冗长 description 收进 tooltip,表单只留标签+输入)。
export function FieldHint({ text }: { text: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label="字段说明"
            onClick={(e) => e.preventDefault()}
            className="text-muted-foreground/60 hover:text-foreground inline-flex items-center"
          >
            <CircleHelpIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// HintLabel = 字段标签 + 圆圈问号说明(FieldLabel 本身是 flex gap-2,问号内联在文字右侧)。
export function HintLabel({
  htmlFor,
  hint,
  children,
}: {
  htmlFor?: string;
  hint: ReactNode;
  children: ReactNode;
}) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      {children}
      <FieldHint text={hint} />
    </FieldLabel>
  );
}
