import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { deleteRoute, type Route } from "@/lib/api/routes";
import { apiErrorMessage } from "@/lib/api/client";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { RouteFormDialog } from "@/components/routes/RouteFormDialog";
import { Button } from "@/components/ui/button";

export function RouteDetailActions({ route }: { route: Route }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => deleteRoute(route.id),
    onSuccess: () => {
      toast.success("已删除线路");
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      navigate("/routes");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
        编辑
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDeleteOpen(true)}
        disabled={del.isPending}
      >
        删除
      </Button>

      <RouteFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        route={route}
        onSaved={() => {
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: ["routes"] });
          queryClient.invalidateQueries({ queryKey: ["route", route.id] });
        }}
      />

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!o && del.isPending) return;
          setDeleteOpen(o);
        }}
        title="删除线路"
        description={`确认删除线路「${route.name}」？删除不可恢复，删除后该线路将立即停止服务，绑定到它的 Key 需另行调整。`}
        confirmLabel="确认删除"
        destructive
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </>
  );
}
