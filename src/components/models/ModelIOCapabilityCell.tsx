import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Image,
  Mic,
  Type,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listModelCapabilities, type ModelCapability } from "@/lib/api/capability";
import { SupportLevelBadge } from "@/components/capability/shared";
import { TipHoverCardContent } from "@/components/dashboard/TipHoverCardContent";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

export type IOCapabilityDirection = "input" | "output";

/** models.dev 同款 I/O 模态图标映射（18px 槽位，仅 .input / .output）。 */
const IO_CAPABILITY_SPECS: Record<
  IOCapabilityDirection,
  { key: string; label: string; icon: LucideIcon }[]
> = {
  input: [
    { key: "text.input", label: "文本", icon: Type },
    { key: "image.input", label: "图像", icon: Image },
    { key: "audio.input", label: "音频", icon: Mic },
    { key: "file.input", label: "文件", icon: FileText },
  ],
  output: [
    { key: "text.output", label: "文本", icon: Type },
    { key: "image.output", label: "图像", icon: Image },
    { key: "audio.output", label: "音频", icon: Volume2 },
  ],
};

function isIOCapabilityKey(key: string, direction: IOCapabilityDirection): boolean {
  return key.endsWith(`.${direction}`);
}

function capabilityByKey(caps: ModelCapability[]): Map<string, ModelCapability> {
  return new Map(caps.map((c) => [c.capability_key, c]));
}

function isDeclaredCapability(cap: ModelCapability | undefined): cap is ModelCapability {
  return cap != null && (cap.support_level === "full" || cap.support_level === "limited");
}

const MODALITY_ICON_SLOT =
  "modality-icon inline-flex size-[18px] shrink-0 items-center justify-center text-[#666666] dark:text-muted-foreground";
const MODALITY_ICON_CLASS = "size-4 shrink-0";
const MODALITY_ICON_STROKE = 2;

function ModalityIcon({
  label,
  icon: Icon,
  level,
}: {
  label: string;
  icon: LucideIcon;
  level: ModelCapability["support_level"];
}) {
  return (
    <span
      className={cn(MODALITY_ICON_SLOT, level === "limited" && "opacity-70")}
      title={`${label} · ${level}`}
    >
      <Icon className={MODALITY_ICON_CLASS} strokeWidth={MODALITY_ICON_STROKE} aria-hidden />
    </span>
  );
}

export function ModelIOCapabilityCell({
  modelId,
  direction,
}: {
  modelId: number;
  direction: IOCapabilityDirection;
}) {
  const [open, setOpen] = useState(false);
  const specs = IO_CAPABILITY_SPECS[direction];
  const directionLabel = direction === "input" ? "输入" : "输出";

  const capsQuery = useQuery({
    queryKey: ["model", modelId, "capabilities", "io", direction],
    queryFn: () => listModelCapabilities(modelId),
    staleTime: 5 * 60_000,
  });

  const caps = (capsQuery.data ?? []).filter(
    (c) => isIOCapabilityKey(c.capability_key, direction) && isDeclaredCapability(c),
  );
  const capMap = capabilityByKey(capsQuery.data ?? []);
  const declaredSpecs = specs.filter((spec) => isDeclaredCapability(capMap.get(spec.key)));

  if (capsQuery.isPending) {
    return <span className="text-muted-foreground text-xs">…</span>;
  }

  if (capsQuery.isError) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (declaredSpecs.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex w-fit cursor-default items-center gap-1"
          aria-label={`查看${directionLabel}能力详情`}
        >
          {declaredSpecs.map((spec) => {
            const cap = capMap.get(spec.key)!;
            return (
              <ModalityIcon
                key={spec.key}
                label={spec.label}
                icon={spec.icon}
                level={cap.support_level}
              />
            );
          })}
        </button>
      </HoverCardTrigger>
      <TipHoverCardContent align="start" className="w-72">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs font-medium">
            {directionLabel}能力（{caps.length}）
          </div>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {caps.map((c) => {
              const spec = specs.find((s) => s.key === c.capability_key);
              return (
                <li
                  key={c.capability_key}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                >
                  <span className="inline-flex items-center gap-2 truncate text-xs">
                    {spec ? (
                      <span className={MODALITY_ICON_SLOT}>
                        <spec.icon
                          className={MODALITY_ICON_CLASS}
                          strokeWidth={MODALITY_ICON_STROKE}
                          aria-hidden
                        />
                      </span>
                    ) : null}
                    {spec?.label ?? c.capability_key}
                  </span>
                  <SupportLevelBadge level={c.support_level} />
                </li>
              );
            })}
          </ul>
        </div>
      </TipHoverCardContent>
    </HoverCard>
  );
}
