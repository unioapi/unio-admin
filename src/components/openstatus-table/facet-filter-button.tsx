import { useCallback, useMemo, useState } from "react";
import { Check, PlusCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { FacetOption } from "./types";

/**
 * 受控 facet 筛选（server 表格用），视觉对齐请求中心 `DataTableFacetedFilter`：
 * 虚线描边 + PlusCircle / XCircle + Command 列表 + 已选 Badge。
 */
export function FacetFilterButton({
  label,
  value,
  options,
  onChange,
  multiple = false,
}: {
  label: string;
  value: string[];
  options: FacetOption[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  /** @deprecated 保留以免破坏调用方；清除用 × /「全部」 */
  allOption?: string | false;
}) {
  const [open, setOpen] = useState(false);
  const selectedValues = useMemo(() => new Set(value), [value]);

  const clear = useCallback(() => {
    onChange([]);
    setOpen(false);
  }, [onChange]);

  const onItemSelect = useCallback(
    (option: FacetOption, isSelected: boolean) => {
      if (multiple) {
        const next = new Set(selectedValues);
        if (isSelected) next.delete(option.value);
        else next.add(option.value);
        onChange(Array.from(next));
        return;
      }
      if (isSelected) {
        clear();
        return;
      }
      onChange([option.value]);
      setOpen(false);
    },
    [clear, multiple, onChange, selectedValues],
  );

  /** 阻止事件冒泡到 PopoverTrigger，否则点 × 只会打开菜单、清不掉。 */
  const stopTrigger = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-dashed font-normal">
          {selectedValues.size > 0 ? (
            <span
              role="button"
              aria-label={`清除${label}筛选`}
              tabIndex={0}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onPointerDown={stopTrigger}
              onClick={(event) => {
                stopTrigger(event);
                clear();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  stopTrigger(event);
                  clear();
                }
              }}
            >
              <XCircle />
            </span>
          ) : (
            <PlusCircle />
          )}
          {label}
          {selectedValues.size > 0 ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    已选 {selectedValues.size}
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="max-w-28 truncate rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-50 p-0" align="start">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList className="max-h-full">
            <CommandEmpty>无匹配项</CommandEmpty>
            <CommandGroup className="max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden">
              {!multiple ? (
                <CommandItem
                  className="[&>svg:last-child]:hidden"
                  onSelect={() => clear()}
                >
                  <div
                    className={cn(
                      "flex size-4 items-center justify-center rounded-sm border border-primary",
                      selectedValues.size === 0
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible",
                    )}
                  >
                    <Check />
                  </div>
                  <span className="truncate">全部</span>
                </CommandItem>
              ) : null}
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    className="[&>svg:last-child]:hidden"
                    onSelect={() => onItemSelect(option, isSelected)}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check />
                    </div>
                    <OptionLabel option={option} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => clear()}
                    className="justify-center text-center"
                  >
                    清除筛选
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OptionLabel({ option }: { option: FacetOption }) {
  if (option.render) {
    return <span className="min-w-0 flex-1 truncate">{option.render()}</span>;
  }
  return <span className="truncate">{option.label}</span>;
}
