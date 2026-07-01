import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, EyeIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { deleteRoute, getRoute, type Route } from "@/lib/api/routes";
import { apiErrorMessage } from "@/lib/api/client";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { RouteFormDialog } from "@/components/routes/RouteFormDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  HoverDropdownMenu,
  HoverDropdownMenuContent,
  HoverDropdownMenuTrigger,
} from "@/components/ui/hover-dropdown-menu";

export function RouteRowActions({
  routeId,
  routeName,
}: {
  routeId: number;
  routeName?: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const needRoute = editOpen || deleteOpen || menuOpen;
  const routeQ = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => getRoute(routeId),
    enabled: needRoute,
  });

  const route = routeQ.data;

  const del = useMutation({
    mutationFn: () => deleteRoute(routeId),
    onSuccess: () => {
      toast.success("已删除线路");
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      navigate("/routes");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function openDialog(setter: (open: boolean) => void) {
    setMenuOpen(false);
    setter(true);
  }

  return (
    <>
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
          <Link to={`/routes/${routeId}`}>
            <EyeIcon />
          </Link>
        </Button>

        <HoverDropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <HoverDropdownMenuTrigger asChild onOpen={() => setMenuOpen(true)}>
            <Button variant="ghost" size="icon-sm" aria-label="更多">
              <EllipsisIcon />
            </Button>
          </HoverDropdownMenuTrigger>
          <HoverDropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem disabled={!route} onClick={() => openDialog(setEditOpen)}>
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => openDialog(setDeleteOpen)}
            >
              删除
            </DropdownMenuItem>
          </HoverDropdownMenuContent>
        </HoverDropdownMenu>
      </div>

      {route ? (
        <RouteFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          route={route as Route}
          onSaved={() => {
            setEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ["routes"] });
            queryClient.invalidateQueries({ queryKey: ["route", routeId] });
          }}
        />
      ) : null}

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!o && del.isPending) return;
          setDeleteOpen(o);
        }}
        title="删除线路"
        description={`确认删除线路「${routeName ?? route?.name ?? routeId}」？删除不可恢复，删除后该线路将立即停止服务，绑定到它的 Key 需另行调整。`}
        confirmLabel="确认删除"
        destructive
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </>
  );
}
