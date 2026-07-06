import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisIcon, EyeIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { deleteRoute, getRoute, restoreRoute, type Route } from "@/lib/api/routes";
import { apiErrorMessage } from "@/lib/api/client";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { ArchiveRouteDialog } from "@/components/routes/ArchiveRouteDialog";
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
  const [archiveOpen, setArchiveOpen] = useState(false);

  const needRoute = editOpen || deleteOpen || archiveOpen || menuOpen;
  const routeQ = useQuery({
    queryKey: ["route", routeId],
    queryFn: () => getRoute(routeId),
    enabled: needRoute,
  });

  const route = routeQ.data;
  const archived = route?.status === "archived";

  const del = useMutation({
    mutationFn: () => deleteRoute(routeId),
    onSuccess: () => {
      toast.success("已删除线路");
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      navigate("/routes");
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const restore = useMutation({
    mutationFn: () => restoreRoute(routeId),
    onSuccess: () => {
      toast.success("已恢复线路为停用（归档前已无 Key，恢复后需手动绑定）");
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["route", routeId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  function openDialog(setter: (open: boolean) => void) {
    setMenuOpen(false);
    setter(true);
  }
  function runAndClose(fn: () => void) {
    setMenuOpen(false);
    fn();
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
            {archived ? (
              <>
                <DropdownMenuItem
                  disabled={!route || restore.isPending}
                  onClick={() => runAndClose(() => restore.mutate())}
                >
                  恢复
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => openDialog(setDeleteOpen)}>
                  删除
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem disabled={!route} onClick={() => openDialog(setEditOpen)}>
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!route} onClick={() => openDialog(setArchiveOpen)}>
                  归档
                </DropdownMenuItem>
              </>
            )}
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

      <ArchiveRouteDialog
        routeId={routeId}
        routeName={routeName ?? route?.name ?? String(routeId)}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!o && del.isPending) return;
          setDeleteOpen(o);
        }}
        title="删除线路"
        description={`确认删除已归档线路「${routeName ?? route?.name ?? routeId}」？仅当无请求/账务历史时可删除，此操作不可逆。`}
        confirmLabel="确认删除"
        destructive
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </>
  );
}
