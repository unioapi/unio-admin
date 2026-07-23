import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  api: mocks,
}));

import { createChannel, updateChannel } from "@/lib/api/channels";
import {
  getChannelRuntime,
  resetChannelBreaker,
} from "@/lib/api/channelsOps";
import {
  createProviderEndpoint,
  getProviderEndpoint,
  getProviderEndpointRuntime,
  listProviderEndpoints,
  resetProviderEndpointBreaker,
  updateProviderEndpointBaseURL,
  updateProviderEndpointName,
  updateProviderEndpointStatus,
} from "@/lib/api/providerEndpoints";
import {
  archiveProvider,
  restoreProvider,
  updateProvider,
} from "@/lib/api/providers";
import { getRuntimeDiagnostics, listSettings, updateSetting } from "@/lib/api/system";

const endpoint = {
  id: 7,
  provider_id: 3,
  provider_name: "Provider A",
  name: "primary",
  base_url: "https://api.example.test/v1",
  base_url_revision: 2,
  status: "enabled" as const,
  status_revision: 4,
  channel_count: 1,
  runtime_sync_pending: false,
  runtime_sync_state: "active" as const,
  runtime_active_base_url_revision: 2,
  runtime_pending_base_url_revision: null,
  runtime_active_status_revision: 4,
  runtime_pending_status_revision: null,
  runtime_effective_status: "enabled" as const,
  archived_at: null,
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
};

describe("P4 admin API contracts", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.put.mockReset();
    mocks.patch.mockReset();
    mocks.delete.mockReset();
  });

  it("preserves critical-setting database and Redis activation revisions", async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: [
          {
            key: "gateway.routing_balance",
            category: "gateway",
            label: "Balanced 路由",
            description: "",
            hot_reload: true,
            default: {},
            value: {},
            source: "db",
            revision: 4,
            runtime_active_revision: 3,
            runtime_pending_revision: 4,
            runtime_sync_state: "runtime_sync_pending",
          },
        ],
      },
    });
    mocks.put.mockResolvedValue({
      data: {
        data: {
          Key: "gateway.routing_balance",
          Revision: 4,
          State: "runtime_sync_pending",
          ActiveRevision: 3,
          PendingRevision: 4,
        },
      },
    });

    const [item] = await listSettings();
    const result = await updateSetting("gateway.routing_balance", {
      ttft_target_ms: 2_000,
      ttft_weight: 0.35,
      cost_weight: 0.5,
      minimum_routing_factor: 0.05,
      ttft_ewma_alpha: 0.2,
    });

    expect(item).toMatchObject({
      revision: 4,
      runtime_active_revision: 3,
      runtime_pending_revision: 4,
      runtime_sync_state: "runtime_sync_pending",
    });
    expect(result).toEqual({
      key: "gateway.routing_balance",
      revision: 4,
      state: "runtime_sync_pending",
      active_revision: 3,
      pending_revision: 4,
    });
  });

  it("reads the redacted runtime maintenance diagnostics route", async () => {
    const diagnostics = {
      readiness: { ready: false, reason: "runtime_operation_pending" },
      runtime_state_epoch: { state: "ready", revision: 7, match: true },
      operations: {
        endpoint_routing: { nonterminal_count: 1, oldest_age_seconds: 12 },
        runtime_control: { nonterminal_count: 2, oldest_age_seconds: 20 },
      },
    };
    mocks.get.mockResolvedValue({ data: { data: diagnostics } });

    const result = await getRuntimeDiagnostics();

    expect(mocks.get).toHaveBeenCalledWith("/admin/v1/system/runtime-diagnostics");
    expect(result).toEqual(diagnostics);
    expect(result.runtime_state_epoch).not.toHaveProperty("epoch");
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("payload_hash");
  });

  it("uses the dedicated ProviderEndpoint CRUD, fence and runtime routes", async () => {
    mocks.get
      .mockResolvedValueOnce({ data: { data: [endpoint], meta: { total: 1 } } })
      .mockResolvedValueOnce({ data: { data: endpoint } })
      .mockResolvedValueOnce({ data: { data: { scope: "endpoint", id: 7 } } });
    mocks.post.mockResolvedValue({ data: { data: endpoint } });
    mocks.patch.mockResolvedValue({ data: { data: endpoint } });
    mocks.delete.mockResolvedValue({
      data: { data: { scope: "endpoint", id: 7 } },
    });

    await listProviderEndpoints({
      providerId: 3,
      status: "enabled",
      page: 2,
      pageSize: 25,
    });
    await getProviderEndpoint(7);
    await createProviderEndpoint({
      provider_id: 3,
      name: "primary",
      base_url: endpoint.base_url,
      status: "enabled",
    });
    await updateProviderEndpointName(7, "renamed");
    await updateProviderEndpointBaseURL(7, "https://next.example.test/v1");
    await updateProviderEndpointStatus(7, "disabled");
    await getProviderEndpointRuntime(7);
    await resetProviderEndpointBreaker(7);

    expect(mocks.get).toHaveBeenNthCalledWith(
      1,
      "/admin/v1/provider-endpoints",
      {
        params: {
          provider_id: 3,
          status: "enabled",
          q: undefined,
          page: 2,
          page_size: 25,
        },
      },
    );
    expect(mocks.get).toHaveBeenNthCalledWith(
      2,
      "/admin/v1/provider-endpoints/7",
    );
    expect(mocks.post).toHaveBeenCalledWith("/admin/v1/provider-endpoints", {
      provider_id: 3,
      name: "primary",
      base_url: endpoint.base_url,
      status: "enabled",
    });
    expect(mocks.patch).toHaveBeenCalledWith("/admin/v1/provider-endpoints/7", {
      name: "renamed",
    });
    expect(mocks.post).toHaveBeenCalledWith(
      "/admin/v1/provider-endpoints/7/base-url",
      { base_url: "https://next.example.test/v1" },
    );
    expect(mocks.post).toHaveBeenCalledWith(
      "/admin/v1/provider-endpoints/7/status",
      { status: "disabled" },
    );
    expect(mocks.get).toHaveBeenNthCalledWith(
      3,
      "/admin/v1/provider-endpoints/7/ops/runtime",
    );
    expect(mocks.delete).toHaveBeenCalledWith(
      "/admin/v1/provider-endpoints/7/ops/circuit-breaker",
    );
  });

  it("preserves Provider status-fence summaries without exposing operation details", async () => {
    const pending = {
      runtime_sync_pending: true,
      affected_endpoint_count: 2,
    };
    const committed = {
      runtime_sync_pending: false,
      affected_endpoint_count: 1,
    };
    mocks.patch.mockResolvedValue({
      data: {
        data: {
          id: 3,
          slug: "provider-a",
          name: "Provider A",
          status: "disabled",
          created_at: "2026-07-22T00:00:00Z",
          updated_at: "2026-07-22T00:00:00Z",
          archived_at: null,
          ...pending,
        },
      },
    });
    mocks.post
      .mockResolvedValueOnce({ data: { data: pending } })
      .mockResolvedValueOnce({ data: { data: committed } });

    const updated = await updateProvider({
      id: 3,
      name: "Provider A",
      status: "disabled",
    });
    const archived = await archiveProvider(3, 9);
    const restored = await restoreProvider(3);

    expect(updated).toMatchObject(pending);
    expect(archived).toEqual(pending);
    expect(restored).toEqual(committed);
    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      "/admin/v1/providers/3/archive",
      { replacement_channel_id: 9 },
    );
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      "/admin/v1/providers/3/restore",
    );
    expect(archived).not.toHaveProperty("token");
    expect(archived).not.toHaveProperty("payload");
    expect(archived).not.toHaveProperty("payload_hash");
    expect(archived).not.toHaveProperty("base_url");
  });

  it("binds channel writes to provider_endpoint_id and never sends base_url", async () => {
    mocks.post.mockResolvedValue({ data: { data: { id: 9 } } });
    mocks.patch.mockResolvedValue({ data: { data: { id: 9 } } });

    await createChannel({
      provider_id: 3,
      provider_endpoint_id: 7,
      name: "channel-a",
      protocol: "openai",
      adapter_key: "openai",
      credential: "secret",
      status: "enabled",
      priority: 0,
      timeout_ms: null,
    });
    await updateChannel({
      id: 9,
      provider_endpoint_id: 7,
      name: "channel-a",
      status: "disabled",
      priority: 0,
      timeout_ms: null,
    });

    const createBody = mocks.post.mock.calls[0][1];
    const updateBody = mocks.patch.mock.calls[0][1];
    expect(createBody).toMatchObject({
      provider_id: 3,
      provider_endpoint_id: 7,
    });
    expect(updateBody).toMatchObject({ provider_endpoint_id: 7 });
    expect(createBody).not.toHaveProperty("base_url");
    expect(updateBody).not.toHaveProperty("base_url");
  });

  it("uses the Redis-backed channel runtime and breaker reset routes", async () => {
    const runtime = {
      id: 9,
      provider_endpoint_id: 7,
      endpoint_base_url_revision: 2,
      endpoint_status_revision: 4,
      config_revision: 3,
      admission_limits_revision: 5,
      runtime_sync_state: "active" as const,
      runtime_provider_endpoint_id: 7,
      runtime_endpoint_base_url_revision: 2,
      runtime_endpoint_status_revision: 4,
      runtime_config_revision: 3,
      runtime_admission_active_revision: 5,
      runtime_admission_pending_revision: null,
      admission_payload_matches: true,
      breaker: {
        scope: "channel" as const,
        id: 9,
        exists: false,
        state: "closed" as const,
        open_remaining_ms: 0,
        open_level: 0,
        eligible_successes: 0,
        eligible_failures: 0,
        consecutive_failures: 0,
        error_rate: 0,
        sample_count: 0,
        ttft_ewma_ms: 0,
        ttft_samples: 0,
        ttft_sample_source: "stream_only" as const,
      },
    };
    mocks.get.mockResolvedValue({ data: { data: runtime } });
    mocks.delete.mockResolvedValue({ data: { data: runtime } });

    const current = await getChannelRuntime(9);
    const reset = await resetChannelBreaker(9);

    expect(mocks.get).toHaveBeenCalledWith(
      "/admin/v1/channels/9/ops/runtime",
    );
    expect(mocks.delete).toHaveBeenCalledWith(
      "/admin/v1/channels/9/ops/circuit-breaker",
    );
    expect(current.breaker?.observed_at).toEqual(expect.any(String));
    expect(reset.breaker?.observed_at).toEqual(expect.any(String));
  });
});
