import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type DetailSideSection = {
  id: string;
  label: string;
  content: ReactNode;
};

export function DetailSideNav({
  sections,
  defaultSectionId,
  orientation = "vertical",
  className,
}: {
  sections: DetailSideSection[];
  defaultSectionId?: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  const [activeId, setActiveId] = useState(
    defaultSectionId ?? sections[0]?.id ?? "",
  );
  const active =
    sections.find((section) => section.id === activeId) ?? sections[0];

  if (!active) return null;

  if (orientation === "horizontal") {
    return (
      <Tabs
        value={active.id}
        onValueChange={setActiveId}
        className={cn("min-w-0 gap-5", className)}
      >
        <div className="overflow-x-auto border-b">
          <TabsList
            variant="line"
            aria-label="章节导航"
            className="h-11 min-w-max justify-start gap-2 p-0"
          >
            {sections.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="h-11 min-w-20 flex-none px-3 text-sm"
              >
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id} className="min-w-0">
            {section.content}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:gap-8", className)}>
      <nav
        className="flex shrink-0 gap-1 overflow-x-auto border-b pb-3 md:w-32 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:pb-0 md:pr-4"
        aria-label="章节导航"
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveId(section.id)}
            aria-current={activeId === section.id ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-left text-sm transition-colors md:w-full",
              activeId === section.id
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <h2 className="font-heading mb-4 text-base font-semibold tracking-tight">
          {active.label}
        </h2>
        {active.content}
      </div>
    </div>
  );
}
