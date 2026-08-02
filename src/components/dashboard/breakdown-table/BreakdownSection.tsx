import { useState } from "react";
import type {
  BreakdownDimension,
  TimeseriesInterval,
} from "@/lib/api/dashboard";
import type { RangeValue } from "@/lib/range";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BREAKDOWN_TABS } from "./constants";
import { BreakdownDataTable } from "./BreakdownDataTable";

export function BreakdownSection({
  rangeValue,
  interval,
}: {
  rangeValue: RangeValue;
  interval: TimeseriesInterval;
}) {
  const [dim, setDim] = useState<BreakdownDimension>("provider");

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">表现</CardTitle>
        <CardAction>
          <Tabs
            value={dim}
            onValueChange={(v) => setDim(v as BreakdownDimension)}
          >
            <TabsList className="h-8">
              {BREAKDOWN_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="px-2.5 text-xs"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-4">
        <BreakdownDataTable
          dimension={dim}
          rangeValue={rangeValue}
          interval={interval}
          active
        />
      </CardContent>
    </Card>
  );
}
