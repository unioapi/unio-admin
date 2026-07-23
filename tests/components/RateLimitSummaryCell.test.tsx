import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RateLimitSummaryCell } from "@/components/rate-limit/RateLimitSummaryCell";

describe("RateLimitSummaryCell", () => {
  it("names inherited defaults by channel or route scope", () => {
    render(
      <>
        <RateLimitSummaryCell
          rpm={null}
          tpm={null}
          rpd={null}
          defaultScope="渠道"
        />
        <RateLimitSummaryCell
          rpm={null}
          tpm={null}
          rpd={null}
          defaultScope="线路"
        />
      </>,
    );

    expect(screen.getByText("渠道默认")).toBeVisible();
    expect(screen.getByText("线路默认")).toBeVisible();
  });

  it("keeps the scope explicit for a partially overridden limit", async () => {
    const user = userEvent.setup();
    render(
      <RateLimitSummaryCell
        rpm={null}
        tpm={1_000}
        rpd={null}
        defaultScope="渠道"
      />,
    );

    const summary = screen.getByText("渠道默认");
    expect(summary).toBeVisible();
    await user.hover(summary);

    expect(await screen.findAllByText("继承渠道默认限流")).toHaveLength(2);
    expect(
      screen.getByText("留空继承渠道默认限流，0 表示不限。"),
    ).toBeVisible();
  });
});
