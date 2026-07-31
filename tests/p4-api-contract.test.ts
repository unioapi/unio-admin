import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({ api: mocks }));

import { createChannel, updateChannel } from "@/lib/api/channels";
import { getChannelRuntime, resetChannelBreaker } from "@/lib/api/channelsOps";
import {
  archiveProvider,
  createProvider,
  getProviderRuntime,
  resetProviderBreaker,
  restoreProvider,
  updateProvider,
  updateProviderOrigin,
  updateProviderStatus,
} from "@/lib/api/providers";
import { getRuntimeDiagnostics, listSettings, updateSetting } from "@/lib/api/system";

describe("P4 admin API contracts", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("preserves critical-setting database and Redis activation revisions", async () => {
    mocks.get.mockResolvedValue({
      data: { data: [{
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
      }] },
    });
    mocks.put.mockResolvedValue({
      data: { data: {
        Key: "gateway.routing_balance",
        Revision: 4,
        State: "runtime_sync_pending",
        ActiveRevision: 3,
        PendingRevision: 4,
      } },
    });

    const [item] = await listSettings();
    const result = await updateSetting("gateway.routing_balance", {
      cost_weight_pct: 25,
      concurrency_weight_pct: 20,
      ttft_weight_pct: 25,
      error_rate_weight_pct: 20,
      priority_weight_pct: 10,
      ttft_window_ms: 1_800_000,
      ttft_penalty_unit_ms: 1_000,
      ttft_penalty_points_per_unit: 2.5,
      error_window_ms: 1_800_000,
      error_penalty_points_per_percent: 2.5,
    });

    expect(item).toMatchObject({ revision: 4, runtime_active_revision: 3, runtime_pending_revision: 4 });
    expect(result).toMatchObject({ revision: 4, state: "runtime_sync_pending", active_revision: 3, pending_revision: 4 });
  });

  it("reads redacted Provider routing diagnostics", async () => {
    const diagnostics = {
      readiness: { ready: false, reason: "runtime_operation_pending" },
      runtime_state_epoch: { state: "ready", revision: 7, match: true },
      operations: {
        provider_routing: { nonterminal_count: 1, oldest_age_seconds: 12 },
        runtime_control: { nonterminal_count: 2, oldest_age_seconds: 20 },
      },
    };
    mocks.get.mockResolvedValue({ data: { data: diagnostics } });

    expect(await getRuntimeDiagnostics()).toEqual(diagnostics);
    expect(mocks.get).toHaveBeenCalledWith("/admin/v1/system/runtime-diagnostics");
  });

  it("uses Provider origin/status CAS and Provider runtime routes", async () => {
    const provider = {
      id: 3,
      slug: "provider-a",
      name: "Provider A",
      origin: "https://api.example.test/v1",
      origin_revision: 2,
      status: "enabled",
      status_revision: 4,
      runtime_sync_pending: false,
    };
    const runtime = { id: 3, runtime_sync_state: "active" };
    mocks.post.mockResolvedValue({ data: { data: provider } });
    mocks.patch.mockResolvedValue({ data: { data: provider } });
    mocks.get.mockResolvedValue({ data: { data: runtime } });
    mocks.delete.mockResolvedValue({ data: { data: runtime } });

    await createProvider({ slug: "provider-a", name: "Provider A", origin: provider.origin, status: "enabled" });
    await updateProvider({ id: 3, name: "Provider Renamed" });
    await updateProviderOrigin({
      id: 3,
      origin: "https://next.example.test/v1",
      expected_origin_revision: 2,
      confirm_enabled_channels: true,
    });
    await updateProviderStatus({ id: 3, status: "disabled", expected_status_revision: 4 });
    await getProviderRuntime(3);
    await resetProviderBreaker(3);

    expect(mocks.post).toHaveBeenCalledWith("/admin/v1/providers", {
      slug: "provider-a", name: "Provider A", origin: provider.origin, status: "enabled",
    });
    expect(mocks.patch).toHaveBeenCalledWith("/admin/v1/providers/3", { name: "Provider Renamed" });
    expect(mocks.patch).toHaveBeenCalledWith("/admin/v1/providers/3/origin", {
      origin: "https://next.example.test/v1",
      expected_origin_revision: 2,
      confirm_enabled_channels: true,
    });
    expect(mocks.post).toHaveBeenCalledWith("/admin/v1/providers/3/status", {
      status: "disabled", expected_status_revision: 4,
    });
    expect(mocks.get).toHaveBeenCalledWith("/admin/v1/providers/3/ops/runtime");
    expect(mocks.delete).toHaveBeenCalledWith("/admin/v1/providers/3/ops/circuit-breaker");
  });

  it("keeps lifecycle results limited to runtime synchronization facts", async () => {
    mocks.post
      .mockResolvedValueOnce({ data: { data: { runtime_sync_pending: true } } })
      .mockResolvedValueOnce({ data: { data: { runtime_sync_pending: false } } });

    expect(await archiveProvider(3)).toEqual({ runtime_sync_pending: true });
    expect(await restoreProvider(3)).toEqual({ runtime_sync_pending: false });
    expect(mocks.post).toHaveBeenNthCalledWith(1, "/admin/v1/providers/3/archive", {});
    expect(mocks.post).toHaveBeenNthCalledWith(2, "/admin/v1/providers/3/restore");
  });

  it("binds Channel writes directly to provider_id", async () => {
    mocks.post.mockResolvedValue({ data: { data: { id: 9 } } });
    mocks.patch.mockResolvedValue({ data: { data: { id: 9 } } });

    await createChannel({
      provider_id: 3,
      name: "channel-a",
      protocol: "openai",
      adapter_key: "openai",
      credential: "secret",
      status: "enabled",
      priority: 0,
      response_timeout_ms: null,
      first_token_timeout_ms: null,
      sticky_enabled: null,
      sticky_ttl_ms: null,
      concurrency_limit: null,
    });
    await updateChannel({
      id: 9,
      provider_id: 3,
      name: "channel-a",
      status: "disabled",
      priority: 0,
      response_timeout_ms: null,
      first_token_timeout_ms: null,
      sticky_enabled: false,
      sticky_ttl_ms: null,
      concurrency_limit: null,
    });

    expect(mocks.post.mock.calls[0][1]).toMatchObject({
      provider_id: 3,
      sticky_enabled: null,
      sticky_ttl_ms: null,
    });
    expect(mocks.patch.mock.calls[0][1]).toMatchObject({
      provider_id: 3,
      sticky_enabled: false,
      sticky_ttl_ms: null,
    });
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty("provider_origin_id");
    expect(mocks.patch.mock.calls[0][1]).not.toHaveProperty("provider_origin_id");
  });

  it("uses the Redis-backed Channel runtime and breaker reset routes", async () => {
    const runtime = {
      id: 9,
      provider_id: 3,
      origin_revision: 2,
      provider_status_revision: 4,
      config_revision: 3,
      admission_limits_revision: 5,
      runtime_sync_state: "active" as const,
      runtime_provider_id: 3,
      runtime_origin_revision: 2,
      runtime_provider_status_revision: 4,
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

    expect((await getChannelRuntime(9)).breaker?.observed_at).toEqual(expect.any(String));
    expect((await resetChannelBreaker(9)).breaker?.observed_at).toEqual(expect.any(String));
    expect(mocks.get).toHaveBeenCalledWith("/admin/v1/channels/9/ops/runtime");
    expect(mocks.delete).toHaveBeenCalledWith("/admin/v1/channels/9/ops/circuit-breaker");
  });
});
