import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskSecret } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export async function copySecretToClipboard(
  value: string | null | undefined,
  messages?: {
    success?: string;
    empty?: string;
    failed?: string;
  },
): Promise<boolean> {
  const trimmed = value?.trim();
  if (!trimmed) {
    toast.error(messages?.empty ?? "无可复制内容");
    return false;
  }
  try {
    await navigator.clipboard.writeText(trimmed);
    toast.success(messages?.success ?? "已复制到剪贴板");
    return true;
  } catch {
    toast.error(messages?.failed ?? "复制失败，请手动选择复制");
    return false;
  }
}

export interface SecretCopyCellProps {
  /** 完整明文；有值时可悬停查看并复制。 */
  value?: string | null;
  /** 展示文案；缺省时对 value 脱敏，无 value 时显示 —。 */
  display?: string;
  tooltipTitle?: string;
  copyAriaLabel?: string;
  copyMessages?: {
    success?: string;
    empty?: string;
    failed?: string;
  };
}

export function SecretCopyCell({
  value,
  display,
  tooltipTitle = "完整密钥",
  copyAriaLabel = "复制",
  copyMessages,
}: SecretCopyCellProps) {
  const trimmed = value?.trim();
  const masked = display ?? (trimmed ? maskSecret(trimmed) : "—");

  if (!trimmed && masked === "—") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div
      className="flex min-w-0 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {trimmed ? (
        <HoverCard openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>
            <span
              className={cn(
                "min-w-0 truncate font-mono text-xs",
                "cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
              )}
            >
              {masked}
            </span>
          </HoverCardTrigger>
          <HoverCardContent align="start" className="w-auto max-w-sm">
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">{tooltipTitle}</p>
            <code className="break-all font-mono text-xs">{trimmed}</code>
          </HoverCardContent>
        </HoverCard>
      ) : (
        <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
          {masked}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copyAriaLabel}
        onClick={() => copySecretToClipboard(trimmed, copyMessages)}
      >
        <CopyIcon />
      </Button>
    </div>
  );
}
