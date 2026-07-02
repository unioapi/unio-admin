import { useState } from "react";
import { EllipsisIcon, EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Provider } from "@/lib/api/providers";
import { DeleteProviderDialog } from "@/components/providers/DeleteProviderDialog";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  HoverDropdownMenu,
  HoverDropdownMenuContent,
  HoverDropdownMenuTrigger,
} from "@/components/ui/hover-dropdown-menu";

export function ProviderRowActions({ provider }: { provider: Provider }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function openDialog(setter: (open: boolean) => void) {
    setMenuOpen(false);
    setter(true);
  }

  return (
    <>
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
          <Link to={`/providers/${provider.id}`}>
            <EyeIcon />
          </Link>
        </Button>

        <HoverDropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <HoverDropdownMenuTrigger asChild onOpen={() => setMenuOpen(true)}>
            <Button variant="ghost" size="icon-sm" aria-label="更多">
              <EllipsisIcon />
            </Button>
          </HoverDropdownMenuTrigger>
          <HoverDropdownMenuContent align="end" className="min-w-32">
            <DropdownMenuItem onClick={() => openDialog(setEditOpen)}>编辑</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => openDialog(setDeleteOpen)}
            >
              删除
            </DropdownMenuItem>
          </HoverDropdownMenuContent>
        </HoverDropdownMenu>
      </div>

      <ProviderFormDialog provider={provider} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteProviderDialog provider={provider} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
