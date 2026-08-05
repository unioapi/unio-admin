import { describe, expect, it, vi } from "vitest";
import { collectAllPages } from "@/lib/api/list-params";

describe("collectAllPages", () => {
  it("loads pages until the reported total is collected", async () => {
    const loadPage = vi.fn(async (page: number) => ({
      items: page === 1 ? [1, 2] : [3],
      total: 3,
    }));

    await expect(collectAllPages(loadPage, 2)).resolves.toEqual([1, 2, 3]);
    expect(loadPage).toHaveBeenNthCalledWith(1, 1, 2);
    expect(loadPage).toHaveBeenNthCalledWith(2, 2, 2);
  });
});
