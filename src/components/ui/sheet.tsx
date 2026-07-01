"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

type SheetSide = "top" | "right" | "bottom" | "left"

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getSheetSizeLimits(side: SheetSide) {
  if (typeof window === "undefined") {
    return { min: 280, max: 960 }
  }

  if (side === "left" || side === "right") {
    return {
      min: 280,
      max: Math.min(window.innerWidth * 0.95, 1400),
    }
  }

  return {
    min: 200,
    max: window.innerHeight * 0.9,
  }
}

function useSheetResize(
  side: SheetSide,
  contentRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const [size, setSize] = React.useState<number | null>(null)
  const [resizing, setResizing] = React.useState(false)
  const isHorizontal = side === "left" || side === "right"

  const onResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return

      event.preventDefault()
      const content = contentRef.current
      if (!content) return

      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)

      const startPos = isHorizontal ? event.clientX : event.clientY
      const startSize = isHorizontal ? content.offsetWidth : content.offsetHeight
      const { min, max } = getSheetSizeLimits(side)

      setResizing(true)
      document.body.style.userSelect = "none"
      document.body.style.cursor = isHorizontal ? "ew-resize" : "ns-resize"

      const onPointerMove = (ev: PointerEvent) => {
        const pos = isHorizontal ? ev.clientX : ev.clientY
        let next = startSize

        if (side === "right") next = startSize + (startPos - pos)
        else if (side === "left") next = startSize + (pos - startPos)
        else if (side === "bottom") next = startSize + (startPos - pos)
        else next = startSize + (pos - startPos)

        setSize(clamp(next, min, max))
      }

      const onPointerUp = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId)
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
        window.removeEventListener("pointercancel", onPointerUp)
        setResizing(false)
        document.body.style.removeProperty("user-select")
        document.body.style.removeProperty("cursor")
      }

      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", onPointerUp)
      window.addEventListener("pointercancel", onPointerUp)
    },
    [contentRef, enabled, isHorizontal, side],
  )

  return { size, resizing, onResizeStart, isHorizontal }
}

function SheetResizeHandle({
  side,
  onResizeStart,
}: {
  side: SheetSide
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="separator"
      aria-orientation={side === "left" || side === "right" ? "vertical" : "horizontal"}
      aria-label="拖动调整抽屉大小"
      onPointerDown={onResizeStart}
      className={cn(
        "absolute z-10 touch-none select-none",
        side === "right" &&
          "inset-y-0 left-0 w-3 -translate-x-1/2 cursor-ew-resize after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:bg-transparent hover:after:bg-border",
        side === "left" &&
          "inset-y-0 right-0 w-3 translate-x-1/2 cursor-ew-resize after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:bg-transparent hover:after:bg-border",
        side === "bottom" &&
          "inset-x-0 top-0 h-3 -translate-y-1/2 cursor-ns-resize after:absolute after:inset-x-0 after:top-1/2 after:h-0.5 after:bg-transparent hover:after:bg-border",
        side === "top" &&
          "inset-x-0 bottom-0 h-3 translate-y-1/2 cursor-ns-resize after:absolute after:inset-x-0 after:top-1/2 after:h-0.5 after:bg-transparent hover:after:bg-border",
      )}
    />
  )
}

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  resizable = true,
  closeOnOutsideClick = false,
  overlayClassName,
  onPointerDownOutside,
  onInteractOutside,
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide
  showCloseButton?: boolean
  resizable?: boolean
  /** 点击遮罩层是否关闭；默认 false。 */
  closeOnOutsideClick?: boolean
  overlayClassName?: string
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const { size, resizing, onResizeStart, isHorizontal } = useSheetResize(
    side,
    contentRef,
    resizable,
  )

  const sizeStyle = React.useMemo(() => {
    if (size == null) return undefined
    return isHorizontal
      ? { width: size, maxWidth: size }
      : { height: size, maxHeight: size }
  }, [isHorizontal, size])

  return (
    <SheetPortal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        data-side={side}
        data-resizing={resizing ? "" : undefined}
        style={{ ...sizeStyle, ...style }}
        onPointerDownOutside={(e) => {
          if (!closeOnOutsideClick) e.preventDefault()
          onPointerDownOutside?.(e)
        }}
        onInteractOutside={(e) => {
          if (!closeOnOutsideClick) e.preventDefault()
          onInteractOutside?.(e)
        }}
        className={cn(
          "fixed z-50 flex flex-col bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[resizing]:transition-none data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
          className
        )}
        {...props}
      >
        {resizable ? (
          <SheetResizeHandle side={side} onResizeStart={onResizeStart} />
        ) : null}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-1 border-b p-4 pr-12", className)}
      {...props}
    />
  )
}

function SheetToolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-toolbar"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3",
        className,
      )}
      {...props}
    />
  )
}

function SheetMain({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-main"
      className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-4", className)}
      {...props}
    />
  )
}

function DetailSheetContent({
  className,
  size = "lg",
  ...props
}: React.ComponentProps<typeof SheetContent> & {
  size?: "md" | "lg"
}) {
  return (
    <SheetContent
      className={cn(
        "flex h-full w-full flex-col gap-0 overflow-hidden p-0",
        size === "lg" ? "sm:max-w-2xl" : "sm:max-w-xl",
        className,
      )}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  DetailSheetContent,
  SheetHeader,
  SheetToolbar,
  SheetMain,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
