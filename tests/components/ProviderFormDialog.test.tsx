import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderFormDialog } from "@/components/providers/ProviderFormDialog";
import type { Provider } from "@/lib/api/providers";

const mocks = vi.hoisted(() => ({
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api/providers", () => ({
  createProvider: mocks.createProvider,
  updateProvider: mocks.updateProvider,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
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
  affected_origin_count: 0,
} satisfies Provider;

function TestProviders({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("ProviderFormDialog runtime sync feedback", () => {
  beforeEach(() => {
    mocks.createProvider.mockReset();
    mocks.updateProvider.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("reports pending status and refreshes ProviderOrigin facts after an edit", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    mocks.updateProvider.mockResolvedValue({
      ...provider,
      runtime_sync_pending: true,
      affected_origin_count: 2,
    });

    render(
      <TestProviders client={client}>
        <ProviderFormDialog
          provider={provider}
          open
          onOpenChange={vi.fn()}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocks.updateProvider).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("已保存，运行态同步中");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["provider-origins"] });
  });
});
