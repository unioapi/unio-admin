import { cn } from "@/lib/utils";

/** 长上下文计费标记：奶油色小胶囊 + Long（与请求中心费用列同款）。 */
export function LongContextBadge({
  title = "长上下文计费：输入 ×2 / 输出 ×1.5",
}: {
  title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[15px] shrink-0 items-center rounded-full border px-[5px]",
        "border-[#ECD9A8] bg-[#FBF4E3] text-[10px] font-medium leading-none text-[#C47B2D]",
        "dark:border-[#6B5428] dark:bg-[#2C2416] dark:text-[#E0B56A]",
      )}
      title={title}
      aria-label="长上下文计费"
    >
      Long
    </span>
  );
}
