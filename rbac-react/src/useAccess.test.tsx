import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAccess, type UseAccessOptions } from "./useAccess.js";
import { buildBlogRbac } from "./testing/blog.js";
import { renderWithRbac } from "./testing/render.js";
import { USERS } from "./testing/users.js";

function Probe({ roles, ...options }: UseAccessOptions & { roles: readonly string[] }) {
  const { allowed, isLoading } = useAccess(roles, options);
  return <span data-testid="state">{isLoading ? "pending" : String(allowed)}</span>;
}

function state(): string {
  return screen.getByTestId("state").textContent ?? "";
}

async function expectState(expected: string): Promise<void> {
  await waitFor(() => {
    expect(state()).toBe(expected);
  });
}

describe("useAccess", () => {
  it("matches a role the user holds", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe roles={["author", "admin"]} />, manager, USERS.alice);

    await expectState("true");
  });

  it("does not match a role the user lacks", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe roles={["admin"]} />, manager, USERS.alice);

    await expectState("false");
  });

  it('matches "?" for a guest and "@" for an authenticated user', async () => {
    const { manager } = await buildBlogRbac();

    const { rerender } = renderWithRbac(<Probe roles={["?"]} />, manager, null);
    await expectState("true");

    rerender(<Probe roles={["@"]} />);
    await expectState("false");

    rerender(<Probe roles={["@"]} />, USERS.bob);
    await expectState("true");
  });

  it("matches everyone on an empty list", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe roles={[]} />, manager, null);

    await expectState("true");
  });

  it("turns the list into a deny list with allow={false}", async () => {
    const { manager } = await buildBlogRbac();

    const { rerender } = renderWithRbac(
      <Probe roles={["admin"]} allow={false} />,
      manager,
      USERS.alice,
    );
    await expectState("true");

    rerender(<Probe roles={["admin"]} allow={false} />, USERS.root);
    await expectState("false");
  });

  it("denies an inactive user even against a deny list", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe roles={["admin"]} allow={false} />, manager, USERS.banned);

    await expectState("false");
  });

  it("does not re-run the check for an equal role list written inline", async () => {
    const { manager } = await buildBlogRbac();
    const checkAccess = vi.spyOn(manager, "checkAccess");

    const { rerender } = renderWithRbac(<Probe roles={["admin"]} />, manager, USERS.alice);
    await expectState("false");
    expect(checkAccess).toHaveBeenCalledTimes(1);

    rerender(<Probe roles={["admin"]} />);
    rerender(<Probe roles={["admin"]} />);

    expect(checkAccess).toHaveBeenCalledTimes(1);
  });
});
