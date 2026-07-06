import { Badge } from "@/components/ui/badge";

/** 三态状态徽标：enabled → 启用/default；archived → 已归档/secondary；其余(disabled) → 停用/outline。 */
export function StatusBadge({ status }: { status: string }) {
  if (status === "archived") {
    return <Badge variant="secondary">已归档</Badge>;
  }
  const enabled = status === "enabled";
  return (
    <Badge variant={enabled ? "default" : "outline"}>
      {enabled ? "启用" : "停用"}
    </Badge>
  );
}
