import { cn } from "@/lib/utils";

interface UnioMarkProps {
  className?: string;
}

export function UnioMark({ className }: UnioMarkProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      aria-hidden="true"
    >
      <img
        src="/unio-mark.svg"
        alt=""
        width="678"
        height="496"
        className="size-full object-contain dark:hidden"
      />
      <img
        src="/unio-mark-white.svg"
        alt=""
        width="678"
        height="496"
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}
