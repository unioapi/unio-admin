import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({ api: apiMocks }));

import {
  bindChannelModels,
  createChannelModelDiscovery,
  createChannelModelVerification,
  getChannelModelInventory,
} from "@/lib/api/channelModelInventory";

describe("channel model inventory API contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses channel-scoped upstream discovery and inventory endpoints", async () => {
    apiMocks.get.mockResolvedValueOnce({ data: { data: { items: [] } } });
    apiMocks.post.mockResolvedValueOnce({ data: { data: { id: 11 } } });

    await getChannelModelInventory(7);
    await createChannelModelDiscovery(7, "setup");

    expect(apiMocks.get).toHaveBeenCalledWith("/admin/v1/channels/7/model-inventory");
    expect(apiMocks.post).toHaveBeenCalledWith(
      "/admin/v1/channels/7/model-discoveries",
      { source: "setup" },
    );
  });

  it("submits explicit verification targets and atomic disabled bindings", async () => {
    apiMocks.post.mockResolvedValue({ data: { data: [] } });

    await createChannelModelVerification(
      7,
      [{ model_id: 9, upstream_model: "provider-model" }],
      "manual",
    );
    await bindChannelModels(7, [{ model_id: 9, upstream_model: "provider-model" }]);

    expect(apiMocks.post).toHaveBeenNthCalledWith(
      1,
      "/admin/v1/channels/7/model-verifications",
      {
        source: "manual",
        targets: [{ model_id: 9, upstream_model: "provider-model" }],
      },
    );
    expect(apiMocks.post).toHaveBeenNthCalledWith(
      2,
      "/admin/v1/channels/7/models/batch",
      { bindings: [{ model_id: 9, upstream_model: "provider-model" }] },
    );
  });
});
