import { Badge } from "@/components/ui/badge";

/** 启用/停用状态徽标（enabled → 启用/default，其余 → 停用/outline）。 */
export function StatusBadge({ status }: { status: string }) {
  const enabled = status === "enabled";
  return (
    <Badge variant={enabled ? "default" : "outline"}>
      {enabled ? "启用" : "停用"}
    </Badge>
  );
}
