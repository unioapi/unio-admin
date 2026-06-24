import { Badge } from "@/components/ui/badge";
import type { SupportLevel } from "@/lib/api/capability";

// 支持级别徽标：full=放行，limited=受 limits 约束，unsupported=不支持。
export function SupportLevelBadge({ level }: { level: SupportLevel }) {
  if (level === "full") {
    return <Badge variant="default">full</Badge>;
  }
  if (level === "limited") {
    return <Badge variant="secondary">limited</Badge>;
  }
  return <Badge variant="outline">unsupported</Badge>;
}
