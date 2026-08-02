import { describe, expect, it } from "vitest";
import { ROUTE_STATUS_OPTIONS } from "@/components/openstatus-table/routes-os-columns";

describe("route status options", () => {
  it("does not expose archived routes in the main list", () => {
    expect(ROUTE_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      "enabled",
      "disabled",
    ]);
  });
});
