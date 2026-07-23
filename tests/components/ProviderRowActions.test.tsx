import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRowActions } from "@/components/providers/ProviderRowActions";
import type { Provider, ProviderStatusChangeResult } from "@/lib/api/providers";

const pendingResult: ProviderStatusChangeResult = {
  runtime_sync_pending: true,
  affected_endpoint_count: 2,
};

const mocks = vi.hoisted(() => ({
  restoreProvider: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api/providers", () => ({
  restoreProvider: mocks.restoreProvider,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/components/common/ArchiveWithReplacementDialog", () => ({
  ArchiveWithReplacementDialog: ({
    onArchived,
  }: {
    onArchived: (result?: ProviderStatusChangeResult) => void;
  }) => (
    <button
      type="button"
      onClick={() => onArchived({
        runtime_sync_pending: true,
        affected_endpoint_count: 2,
      })}
    >
      complete-provider-archive
    </button>
  ),
}));

vi.mock("@/components/providers/ProviderFormDialog", () => ({
  ProviderFormDialog: () => null,
}));

vi.mock("@/components/providers/ProviderEndpointsSection", () => ({
  ProviderEndpointFormDialog: () => null,
}));

vi.mock("@/components/providers/DeleteProviderDialog", () => ({
  DeleteProviderDialog: () => null,
}));

vi.mock("@/components/ui/hover-dropdown-menu", () => ({
  HoverDropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverDropdownMenuTrigger: ({ children }: { children: ReactNode }) => children,
  HoverDropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

const provider = {
  id: 7,
  slug: "provider-a",
  name: "Provider A",
  status: "enabled",
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
  archived_at: null,
  runtime_sync_pending: false,
  affected_endpoint_count: 0,
} satisfies Provider;

function TestProviders({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("ProviderRowActions runtime sync feedback", () => {
  beforeEach(() => {
    mocks.restoreProvider.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("reports a pending Provider archive and refreshes Endpoint facts", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    render(
      <TestProviders client={client}>
        <ProviderRowActions provider={provider} />
      </TestProviders>,
    );
    await user.click(screen.getByRole("button", { name: "complete-provider-archive" }));

    expect(mocks.toastSuccess).toHaveBeenCalledWith("已保存，运行态同步中");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["provider-endpoints"] });
  });

  it("reports a pending Provider restore and refreshes Endpoint facts", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    mocks.restoreProvider.mockResolvedValue(pendingResult);

    render(
      <TestProviders client={client}>
        <ProviderRowActions
          provider={{ ...provider, status: "archived", archived_at: provider.updated_at }}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: "恢复" }));

    await waitFor(() => expect(mocks.restoreProvider).toHaveBeenCalledWith(7));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("已保存，运行态同步中");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["provider-endpoints"] });
  });
});
