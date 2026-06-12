import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = {
  succeeded: "成功",
  failed: "失败",
  running: "进行中",
  pending: "待处理",
  canceled: "已取消",
};

// 请求/尝试状态徽标：成功=默认，失败=destructive，进行中/待处理=secondary，其余 outline。
export function RequestStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  switch (status) {
    case "succeeded":
      return <Badge variant="default">{label}</Badge>;
    case "failed":
      return <Badge variant="destructive">{label}</Badge>;
    case "running":
    case "pending":
      return <Badge variant="secondary">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}
