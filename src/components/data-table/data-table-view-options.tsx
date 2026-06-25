import type { Table } from "@tanstack/react-table";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DataTableViewOptions<TData>({
  table,
  labels,
  onReset,
}: {
  table: Table<TData>;
  labels: Record<string, string>;
  onReset?: () => void;
}) {
  const hideable = table
    .getAllColumns()
    .filter((column) => column.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" title="勾选显示列；表头悬停可拖拽 ⋮⋮ 调序、右缘调宽；布局保存在本浏览器">
          列设置
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>显示列</DropdownMenuLabel>
          {hideable.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {labels[column.id] ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {onReset ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start px-2 font-normal"
                onClick={onReset}
              >
                恢复默认布局
              </Button>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
