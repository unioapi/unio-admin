import { cn } from "@/lib/utils";

interface UnioMarkProps {
  className?: string;
}

export function UnioMark({ className }: UnioMarkProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-md",
        className,
      )}
      aria-hidden="true"
    >
      <img
        src="/unio-mark-on-white-square.svg"
        alt=""
        width="678"
        height="678"
        className="size-full object-cover dark:hidden"
      />
      <img
        src="/unio-mark-on-black-square.svg"
        alt=""
        width="678"
        height="678"
        className="hidden size-full object-cover dark:block"
      />
    </span>
  );
}
