import { Badge } from "@/components/ui/badge";

// settlement recovery job 状态：pending / running / succeeded / dead。
export function RecoveryStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "succeeded":
      return <Badge variant="default">已完成</Badge>;
    case "running":
      return <Badge variant="secondary">运行中</Badge>;
    case "pending":
      return <Badge variant="outline">待执行</Badge>;
    case "dead":
      return <Badge variant="destructive">已死信</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
