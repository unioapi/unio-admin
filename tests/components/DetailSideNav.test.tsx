import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DetailSideNav } from "@/components/common/DetailSideNav";

const sections = [
  { id: "runtime", label: "实时路由", content: <div>运行态内容</div> },
  { id: "performance", label: "性能", content: <div>性能内容</div> },
  { id: "pool", label: "渠道池", content: <div>渠道池内容</div> },
];

describe("DetailSideNav", () => {
  it("uses horizontal tabs and switches the active section", async () => {
    render(
      <DetailSideNav
        sections={sections}
        defaultSectionId="runtime"
        orientation="horizontal"
      />,
    );

    expect(screen.getByRole("tablist", { name: "章节导航" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "实时路由" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByText("运行态内容")).toBeVisible();

    await userEvent.click(screen.getByRole("tab", { name: "性能" }));

    expect(screen.getByRole("tab", { name: "性能" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByText("性能内容")).toBeVisible();
    expect(screen.queryByText("运行态内容")).not.toBeInTheDocument();
  });
});
