import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RbacUser } from "@iushev/rbac";
import { describe, expect, it, vi } from "vitest";

import { RbacProvider } from "./RbacProvider.js";
import { useRbac, useRbacUser } from "./context.js";
import { useCan } from "./useCan.js";
import { buildBlogRbac } from "./testing/blog.js";
import { renderWithRbac } from "./testing/render.js";
import { USERS } from "./testing/users.js";

function Username() {
  const user = useRbacUser();
  return <span data-testid="username">{user.isGuest ? "guest" : user.username}</span>;
}

function CreatePost() {
  const { allowed, isLoading } = useCan("createPost");
  const { refresh } = useRbac();
  return (
    <button type="button" onClick={refresh} data-testid="state">
      {isLoading ? "pending" : String(allowed)}
    </button>
  );
}

function state(): string {
  return screen.getByTestId("state").textContent ?? "";
}

describe("useRbac", () => {
  it("refuses to run outside a provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Username />)).toThrow("useRbac() must be called inside <RbacProvider>.");

    consoleError.mockRestore();
  });
});

describe("RbacProvider", () => {
  it("builds the user from the access checker and the identity", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Username />, manager, USERS.alice);

    expect(screen.getByTestId("username").textContent).toBe("alice");
  });

  it("treats a null identity as a guest", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Username />, manager, null);

    expect(screen.getByTestId("username").textContent).toBe("guest");
  });

  it("re-checks everything when the identity changes", async () => {
    const { manager } = await buildBlogRbac();

    const { rerender } = renderWithRbac(<CreatePost />, manager, USERS.bob);
    await waitFor(() => {
      expect(state()).toBe("false");
    });

    rerender(<CreatePost />, USERS.alice);

    expect(state()).toBe("pending");
    await waitFor(() => {
      expect(state()).toBe("true");
    });
  });

  it("accepts a user the application built itself", async () => {
    const { manager } = await buildBlogRbac();
    const user = new RbacUser(manager, USERS.alice);

    render(
      <RbacProvider user={user}>
        <CreatePost />
      </RbacProvider>,
    );

    await waitFor(() => {
      expect(state()).toBe("true");
    });
  });

  /** The authorization data can change under a mounted tree; `refresh` is the way back. */
  it("re-runs the checks and drops the access cache on refresh", async () => {
    const { manager, items } = await buildBlogRbac();

    renderWithRbac(<CreatePost />, manager, USERS.bob);
    await waitFor(() => {
      expect(state()).toBe("false");
    });

    await manager.assign(items.author, "bob");

    // Still the cached answer: nothing told React the data moved.
    expect(state()).toBe("false");

    fireEvent.click(screen.getByTestId("state"));

    await waitFor(() => {
      expect(state()).toBe("true");
    });
  });
});
