import { useState, type MouseEvent, type KeyboardEvent } from "react";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  HoverDropdownMenu,
  HoverDropdownMenuContent,
  HoverDropdownMenuTrigger,
} from "@/components/ui/hover-dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { FacetOption } from "./types";

/**
 * 受控 facet 筛选按钮（server 表格用）。
 * 单选（默认）：下拉 Radio，默认带「全部」；多选：Popover + Checkbox。
 * 已选项直接显示在按钮内。
 */
export function FacetFilterButton({
  label,
  value,
  options,
  onChange,
  multiple = false,
  /** 单选时在列表顶部插入「全部」（空值）。传 false 关闭。 */
  allOption = "全部",
}: {
  label: string;
  value: string[];
  options: FacetOption[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  allOption?: string | false;
}) {
  if (multiple) {
    return (
      <MultiFacetFilterButton
        label={label}
        value={value}
        options={options}
        onChange={onChange}
      />
    );
  }
  return (
    <SingleFacetFilterButton
      label={label}
      value={value[0] ?? ""}
      options={options}
      allOption={allOption}
      onChange={(next) => onChange(next ? [next] : [])}
    />
  );
}

function SelectedBadges({
  label,
  selected,
  onClear,
}: {
  label: string;
  selected: FacetOption[];
  onClear?: () => void;
}) {
  const clear = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClear?.();
  };

  return (
    <>
      <Separator orientation="vertical" className="mx-0.5" />
      {selected.length > 2 ? (
        <Badge variant="secondary" className="h-5 rounded-sm px-1.5 font-normal">
          {selected.length} 项
        </Badge>
      ) : (
        selected.map((option) => (
          <Badge
            key={option.value}
            variant="secondary"
            className="h-5 max-w-28 truncate rounded-sm px-1.5 font-normal"
          >
            {option.label}
          </Badge>
        ))
      )}
      {onClear ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`清除${label}筛选`}
          className="text-muted-foreground hover:text-foreground -mr-0.5 rounded-sm p-0.5"
          onClick={clear}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") clear(e);
          }}
        >
          <XIcon className="size-3.5" />
        </span>
      ) : (
        <ChevronDownIcon className="text-muted-foreground size-3.5" />
      )}
    </>
  );
}

/** Radix Radio 不宜用空字符串作 value，用哨兵表示「全部」。 */
const ALL_VALUE = "__all__";

function SingleFacetFilterButton({
  label,
  value,
  options,
  onChange,
  allOption,
}: {
  label: string;
  value: string;
  options: FacetOption[];
  onChange: (next: string) => void;
  allOption: string | false;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);
  const selected: FacetOption | undefined = value
    ? selectedOption
    : allOption !== false
      ? { value: "", label: allOption }
      : undefined;
  const radioValue = value || (allOption !== false ? ALL_VALUE : "");

  return (
    <HoverDropdownMenu open={open} onOpenChange={setOpen}>
      <HoverDropdownMenuTrigger asChild onOpen={() => setOpen(true)}>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5 border-dashed", selected && "border-solid")}
        >
          {label}
          {selected ? (
            <SelectedBadges
              label={label}
              selected={[selected]}
              onClear={value ? () => onChange("") : undefined}
            />
          ) : (
            <ChevronDownIcon className="text-muted-foreground size-3.5" />
          )}
        </Button>
      </HoverDropdownMenuTrigger>
      <HoverDropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuRadioGroup
          value={radioValue}
          onValueChange={(next) => {
            onChange(next === ALL_VALUE ? "" : next);
            setOpen(false);
          }}
        >
          {allOption !== false ? (
            <DropdownMenuRadioItem value={ALL_VALUE}>{allOption}</DropdownMenuRadioItem>
          ) : null}
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.render ? option.render() : option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </HoverDropdownMenuContent>
    </HoverDropdownMenu>
  );
}

function MultiFacetFilterButton({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: FacetOption[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => value.includes(o.value));

  const toggle = (v: string, checked: boolean) => {
    onChange(checked ? [...value, v] : value.filter((x) => x !== v));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 border-dashed",
            selected.length > 0 && "border-solid",
          )}
        >
          {label}
          {selected.length > 0 ? (
            <SelectedBadges
              label={label}
              selected={selected}
              onClear={() => onChange([])}
            />
          ) : (
            <ChevronDownIcon className="text-muted-foreground size-3.5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <div className="rounded-lg border">
          {options.map((option, index) => {
            const checked = value.includes(option.value);
            return (
              <div
                key={option.value}
                className={cn(
                  "hover:bg-accent/50 flex items-center gap-2 px-2.5 py-2",
                  index !== options.length - 1 && "border-b",
                )}
              >
                <Checkbox
                  id={`facet-${label}-${option.value}`}
                  checked={checked}
                  onCheckedChange={(c) => toggle(option.value, !!c)}
                />
                <Label
                  htmlFor={`facet-${label}-${option.value}`}
                  className="text-foreground/80 w-full truncate"
                >
                  {option.render ? option.render() : option.label}
                </Label>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
