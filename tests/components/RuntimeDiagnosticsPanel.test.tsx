import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRuntimeDiagnostics = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/system", () => ({ getRuntimeDiagnostics }));

import { RuntimeDiagnosticsPanel, formatAge } from "@/components/system/RuntimeDiagnosticsPanel";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("RuntimeDiagnosticsPanel", () => {
  beforeEach(() => {
    getRuntimeDiagnostics.mockReset();
  });

  it("renders only the redacted runtime maintenance facts", async () => {
    getRuntimeDiagnostics.mockResolvedValue({
      readiness: { ready: false, reason: "marker_mismatch" },
      runtime_state_epoch: { state: "ready", revision: 7, match: false },
      operations: {
        endpoint_routing: { nonterminal_count: 1, oldest_age_seconds: 17 },
        runtime_control: { nonterminal_count: 2, oldest_age_seconds: 125 },
      },
    });

    render(<RuntimeDiagnosticsPanel />, { wrapper });

    expect(await screen.findByText("准入已拒绝")).toBeInTheDocument();
    expect(screen.getByText("完整性标记不匹配")).toBeInTheDocument();
    expect(screen.getByText("marker_mismatch")).toBeInTheDocument();
    expect(screen.getByText("ready · v7")).toBeInTheDocument();
    expect(screen.getByText("不匹配")).toBeInTheDocument();
    expect(screen.getByText("1 个待收口")).toBeInTheDocument();
    expect(screen.getByText("最老 17 秒")).toBeInTheDocument();
    expect(screen.getByText("2 个待收口")).toBeInTheDocument();
    expect(screen.getByText("最老 2 分 5 秒")).toBeInTheDocument();
    expect(screen.queryByText("00112233445566778899aabbccddeeff")).not.toBeInTheDocument();
    expect(screen.queryByText(/payload_hash|operation_token/)).not.toBeInTheDocument();
  });

  it("renders a compact failure state when the diagnostic request fails", async () => {
    getRuntimeDiagnostics.mockRejectedValue(new Error("network down"));

    render(<RuntimeDiagnosticsPanel />, { wrapper });

    expect(await screen.findByText("运行态诊断加载失败")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();
    await waitFor(() => expect(getRuntimeDiagnostics).toHaveBeenCalledTimes(1));
  });

  it("formats pending ages without fractional or negative values", () => {
    expect(formatAge(-1)).toBe("0 秒");
    expect(formatAge(60)).toBe("1 分钟");
    expect(formatAge(3_780)).toBe("1 小时 3 分");
  });
});
