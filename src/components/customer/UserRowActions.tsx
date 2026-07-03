import { useState } from "react";
import { EllipsisIcon, EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { UserOpsRow } from "@/lib/api/customerOps";
import type { User } from "@/lib/api/users";
import { UserBalanceDialog } from "@/components/customer/UserBalanceDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  HoverDropdownMenu,
  HoverDropdownMenuContent,
  HoverDropdownMenuTrigger,
} from "@/components/ui/hover-dropdown-menu";

function toUser(row: UserOpsRow): User {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}

export function UserRowActions({ row }: { row: UserOpsRow }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);

  function openDialog(setter: (open: boolean) => void) {
    setMenuOpen(false);
    setter(true);
  }

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button asChild variant="ghost" size="icon-sm" aria-label="查看">
          <Link to={`/users/${row.id}`}>
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
            <DropdownMenuItem onClick={() => openDialog(setBalanceOpen)}>调额</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/users/${row.id}/api-keys`}>API Key</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/ledger?userId=${row.id}`}>账本</Link>
            </DropdownMenuItem>
          </HoverDropdownMenuContent>
        </HoverDropdownMenu>
      </div>

      <UserBalanceDialog user={toUser(row)} open={balanceOpen} onOpenChange={setBalanceOpen} />
    </>
  );
}
