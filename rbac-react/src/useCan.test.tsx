import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCan, type UseCanOptions } from "./useCan.js";
import { buildBlogRbac, type Post } from "./testing/blog.js";
import { renderWithRbac } from "./testing/render.js";
import { USERS } from "./testing/users.js";

const ownPost: Post = { id: 1, authorId: "alice" };
const otherPost: Post = { id: 2, authorId: "bob" };

/** Prints the three states as one word, so a test can assert on the transition. */
function Probe({ permission, ...options }: UseCanOptions & { permission: string }) {
  const { allowed, isLoading, error } = useCan(permission, options);
  const state = error ? `error: ${error.message}` : isLoading ? "pending" : String(allowed);
  return <span data-testid="state">{state}</span>;
}

function state(): string {
  return screen.getByTestId("state").textContent ?? "";
}

describe("useCan", () => {
  it("starts pending and resolves to true for a held permission", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe permission="createPost" />, manager, USERS.alice);

    expect(state()).toBe("pending");
    await waitFor(() => {
      expect(state()).toBe("true");
    });
  });

  it("resolves to false for a permission the user does not hold", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe permission="createPost" />, manager, USERS.bob);

    await waitFor(() => {
      expect(state()).toBe("false");
    });
  });

  it("grants a permission reached through the hierarchy", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe permission="viewPost" />, manager, USERS.alice);

    await waitFor(() => {
      expect(state()).toBe("true");
    });
  });

  it("hands params to the rule", async () => {
    const { manager } = await buildBlogRbac();

    const { rerender } = renderWithRbac(
      <Probe permission="updatePost" params={{ post: ownPost }} />,
      manager,
      USERS.alice,
    );

    await waitFor(() => {
      expect(state()).toBe("true");
    });

    rerender(<Probe permission="updatePost" params={{ post: otherPost }} />);

    await waitFor(() => {
      expect(state()).toBe("false");
    });
  });

  it("grants a superuser without consulting the store", async () => {
    const { manager } = await buildBlogRbac();
    const checkAccess = vi.spyOn(manager, "checkAccess");

    renderWithRbac(<Probe permission="createPost" />, manager, USERS.su);

    await waitFor(() => {
      expect(state()).toBe("true");
    });
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it("denies an inactive user everything", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe permission="createPost" />, manager, USERS.banned);

    await waitFor(() => {
      expect(state()).toBe("false");
    });
  });

  it("denies a guest", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(<Probe permission="viewPost" />, manager, null);

    await waitFor(() => {
      expect(state()).toBe("false");
    });
  });

  it("reports what the check rejected with instead of denying", async () => {
    const { manager, rules } = await buildBlogRbac();
    rules.unregister("isAuthor");

    renderWithRbac(
      <Probe permission="updatePost" params={{ post: ownPost }} />,
      manager,
      USERS.alice,
    );

    await waitFor(() => {
      expect(state()).toBe('error: Rule "isAuthor" is not registered.');
    });
  });

  it("does not re-run the check for an equal params object written inline", async () => {
    const { manager } = await buildBlogRbac();
    const checkAccess = vi.spyOn(manager, "checkAccess");

    const { rerender } = renderWithRbac(
      <Probe permission="updatePost" params={{ post: ownPost }} />,
      manager,
      USERS.alice,
    );

    await waitFor(() => {
      expect(state()).toBe("true");
    });
    expect(checkAccess).toHaveBeenCalledTimes(1);

    rerender(<Probe permission="updatePost" params={{ post: ownPost }} />);
    rerender(<Probe permission="updatePost" params={{ post: ownPost }} />);

    expect(checkAccess).toHaveBeenCalledTimes(1);
    expect(state()).toBe("true");
  });

  it("goes back to pending rather than showing the previous answer", async () => {
    const { manager } = await buildBlogRbac();

    const { rerender } = renderWithRbac(<Probe permission="createPost" />, manager, USERS.alice);

    await waitFor(() => {
      expect(state()).toBe("true");
    });

    rerender(<Probe permission="admin" />);

    expect(state()).toBe("pending");
    await waitFor(() => {
      expect(state()).toBe("false");
    });
  });

  it("caches a parameterless check but not one with params", async () => {
    const { manager } = await buildBlogRbac();
    const checkAccess = vi.spyOn(manager, "checkAccess");

    const { rerender } = renderWithRbac(<Probe permission="viewPost" />, manager, USERS.bob);

    await waitFor(() => {
      expect(state()).toBe("true");
    });

    rerender(<Probe permission="createPost" />);
    await waitFor(() => {
      expect(state()).toBe("false");
    });

    rerender(<Probe permission="viewPost" />);
    await waitFor(() => {
      expect(state()).toBe("true");
    });

    // viewPost, createPost — the second viewPost came out of the user's cache.
    expect(checkAccess).toHaveBeenCalledTimes(2);
  });
});
