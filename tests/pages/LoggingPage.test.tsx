import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGatewayLogging: vi.fn(),
  getGatewayLogs: vi.fn(),
  startGatewayDebugSession: vi.fn(),
  stopGatewayDebugSession: vi.fn(),
}));

vi.mock("@/lib/api/system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/system")>();
  return { ...actual, ...mocks };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { formatRemaining, LoggingPage } from "@/pages/LoggingPage";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const infoSnapshot = {
  mode: "info" as const,
  control: { active: false, enabled_by_user_id: 0, revision: 3 },
  instances: [
    {
      url: "http://gateway:8520",
      state: "applied" as const,
      instance_id: "gw-1",
      environment: "production",
      baseline_level: "info",
      effective_level: "info",
      applied_revision: 3,
    },
  ],
};

const logList = {
  items: [
    {
      id: "log_1",
      timestamp: "2026-08-01T08:59:59Z",
      level: "warning" as const,
      type: "http",
      event: "request",
      message: "request completed",
      environment: "production",
      instance: "gw-1",
      data: {
        trace_id: "trace_1",
        request_id: "req_1",
        attempt_id: 42,
        status_code: 503,
      },
    },
  ],
  from: "2026-08-01T08:00:00Z",
  to: "2026-08-01T09:00:00Z",
  limit: 100,
  truncated: false,
};

describe("LoggingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGatewayLogging.mockResolvedValue(infoSnapshot);
    mocks.getGatewayLogs.mockResolvedValue(logList);
  });

  it("formats the DEBUG countdown without going negative", () => {
    expect(formatRemaining(65_000)).toBe("1:05");
    expect(formatRemaining(1)).toBe("0:01");
    expect(formatRemaining(-1)).toBe("0:00");
  });

  it("starts a fixed-duration DEBUG session with a required reason", async () => {
    const user = userEvent.setup();
    mocks.startGatewayDebugSession.mockResolvedValue({
      ...infoSnapshot,
      mode: "debug",
      control: {
        active: true,
        session_id: "dbg_1",
        started_at: "2026-08-01T08:00:00Z",
        expires_at: "2026-08-01T08:30:00Z",
        reason: "investigate upstream latency",
        enabled_by_user_id: 0,
        revision: 4,
      },
    });

    render(<LoggingPage />, { wrapper });
    expect(await screen.findByText("Gateway 日志级别")).toBeInTheDocument();
    expect(screen.getAllByText("gw-1").length).toBeGreaterThan(0);
    expect(await screen.findByText("request completed")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByText(/Grafana/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "开启 DEBUG" }));
    await user.click(screen.getByRole("button", { name: "确认开启" }));
    expect(await screen.findByText("请输入开启原因")).toBeInTheDocument();
    expect(mocks.startGatewayDebugSession).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: "30 分钟" }));
    await user.type(screen.getByLabelText("原因"), " investigate upstream latency ");
    await user.click(screen.getByRole("button", { name: "确认开启" }));

    await waitFor(() => expect(mocks.startGatewayDebugSession).toHaveBeenCalledTimes(1));
    expect(mocks.startGatewayDebugSession.mock.calls[0]?.[0]).toEqual({
      duration_minutes: 30,
      reason: "investigate upstream latency",
    });
    expect((await screen.findAllByText("临时 DEBUG")).length).toBeGreaterThan(0);
    expect(screen.getByText("investigate upstream latency")).toBeInTheDocument();
    expect(screen.getByText("开始时间")).toBeInTheDocument();
    expect(screen.getByText("开启人")).toBeInTheDocument();
    expect(screen.getByText("管理员")).toBeInTheDocument();
  });

  it("queries logs with explicit filters and opens structured details", async () => {
    const user = userEvent.setup();
    render(<LoggingPage />, { wrapper });

    expect(await screen.findByText("request completed")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Type"));
    await user.type(screen.getByLabelText("Type"), "http");
    await user.type(screen.getByLabelText("关联 ID"), " req_1 ");
    await user.type(screen.getByLabelText("内容"), " timeout ");
    await user.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() => expect(mocks.getGatewayLogs).toHaveBeenCalledTimes(2));
    expect(mocks.getGatewayLogs.mock.calls[1]?.[0]).toEqual({
      range: "1h",
      level: "",
      type: "http",
      event: "",
      related_id: "req_1",
      search: "timeout",
      limit: 100,
    });

    await user.click(screen.getByRole("button", { name: "查看日志 log_1" }));
    expect(await screen.findByRole("heading", { name: "日志详情" })).toBeInTheDocument();
    expect(screen.getByText("status_code")).toBeInTheDocument();
    expect(screen.getByText("503")).toBeInTheDocument();
  });

  it("closes an active DEBUG session", async () => {
    const user = userEvent.setup();
    mocks.getGatewayLogging.mockResolvedValue({
      ...infoSnapshot,
      mode: "debug",
      control: {
        active: true,
        session_id: "dbg_active",
        started_at: new Date(Date.now() - 60_000).toISOString(),
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        reason: "diagnosis",
        enabled_by_user_id: 0,
        revision: 8,
      },
    });
    mocks.stopGatewayDebugSession.mockResolvedValue(infoSnapshot);

    render(<LoggingPage />, { wrapper });
    await user.click(await screen.findByRole("button", { name: "关闭 DEBUG" }));

    await waitFor(() => expect(mocks.stopGatewayDebugSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("生产运行基线")).toBeInTheDocument();
  });

  it("does not offer a temporary session over an environment DEBUG baseline", async () => {
    mocks.getGatewayLogging.mockResolvedValue({
      ...infoSnapshot,
      mode: "environment_debug",
      instances: [
        {
          ...infoSnapshot.instances[0],
          environment: "development",
          baseline_level: "debug",
          effective_level: "debug",
          state: "environment_debug",
        },
      ],
    });

    render(<LoggingPage />, { wrapper });
    expect(await screen.findByText("开发环境启动基线")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开启 DEBUG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "延长会话" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "关闭 DEBUG" })).not.toBeInTheDocument();
  });
});
