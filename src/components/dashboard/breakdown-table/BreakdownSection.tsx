import { useState } from "react";
import type { BreakdownDimension, RangeQuery } from "@/lib/api/dashboard";
import { TableToolbarSelect } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BREAKDOWN_TABS } from "./constants";
import { BreakdownDataTable } from "./BreakdownDataTable";

export function BreakdownSection({ range }: { range: RangeQuery }) {
  const [dim, setDim] = useState<BreakdownDimension>("provider");

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">表现</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <BreakdownDataTable
          dimension={dim}
          range={range}
          active
          toolbarStart={
            <TableToolbarSelect
              value={dim}
              onValueChange={(v) => setDim(v as BreakdownDimension)}
              options={BREAKDOWN_TABS}
              triggerClassName="w-36"
            />
          }
        />
      </CardContent>
    </Card>
  );
}
