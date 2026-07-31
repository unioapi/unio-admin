import type { Column } from "@tanstack/react-table";

export function getColumnPinningStyle<TData>({
  column,
  withBorder = false,
}: {
  column: Column<TData>;
  withBorder?: boolean;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");
  // 只在「固定列」或「列定义显式写了 size」时落 width。
  // 未写 size 时不要用 getSize()（默认 150），否则短列被统一撑开、看起来忽宽忽窄。
  const applyWidth = Boolean(isPinned) || column.columnDef.size != null;

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? "-4px 0 4px -4px var(--border) inset"
        : isFirstRightPinnedColumn
          ? "4px 0 4px -4px var(--border) inset"
          : undefined
      : undefined,
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: isPinned ? 0.97 : undefined,
    position: isPinned ? "sticky" : undefined,
    background: isPinned ? "var(--background)" : undefined,
    width: applyWidth ? column.getSize() : undefined,
    minWidth: column.columnDef.minSize,
    zIndex: isPinned ? 1 : undefined,
  };
}
