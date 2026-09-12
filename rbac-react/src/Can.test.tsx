import { screen, waitFor } from "@testing-library/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { InMemoryRbacStore, RbacManager, RuleRegistry, createPermission } from "@iushev/rbac";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Can } from "./Can.js";
import { buildBlogRbac, type Post } from "./testing/blog.js";
import { renderWithRbac } from "./testing/render.js";
import { USERS } from "./testing/users.js";

const ownPost: Post = { id: 1, authorId: "alice" };
const otherPost: Post = { id: 2, authorId: "bob" };

describe("Can", () => {
  it("renders the children once the permission is granted", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(
      <Can permission="createPost">
        <span>new post</span>
      </Can>,
      manager,
      USERS.alice,
    );

    expect(await screen.findByText("new post")).toBeTruthy();
  });

  it("renders nothing at all when no fallback is given", async () => {
    const { manager } = await buildBlogRbac();

    const { container } = renderWithRbac(
      <Can permission="createPost">
        <span>new post</span>
      </Can>,
      manager,
      USERS.bob,
    );

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("renders the fallback for a user without the permission", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(
      <Can permission="createPost" fallback={<span>no access</span>}>
        <span>new post</span>
      </Can>,
      manager,
      USERS.bob,
    );

    expect(await screen.findByText("no access")).toBeTruthy();
    expect(screen.queryByText("new post")).toBeNull();
  });

  it("shows the pending node, not the fallback, while the check runs", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(
      <Can permission="createPost" fallback={<span>no access</span>} pending={<span>…</span>}>
        <span>new post</span>
      </Can>,
      manager,
      USERS.alice,
    );

    expect(screen.getByText("…")).toBeTruthy();
    expect(screen.queryByText("no access")).toBeNull();

    expect(await screen.findByText("new post")).toBeTruthy();
  });

  it("passes params to the rule", async () => {
    const { manager } = await buildBlogRbac();

    const { rerender } = renderWithRbac(
      <Can permission="updatePost" params={{ post: ownPost }} fallback={<span>denied</span>}>
        <span>edit</span>
      </Can>,
      manager,
      USERS.alice,
    );

    expect(await screen.findByText("edit")).toBeTruthy();

    rerender(
      <Can permission="updatePost" params={{ post: otherPost }} fallback={<span>denied</span>}>
        <span>edit</span>
      </Can>,
    );

    expect(await screen.findByText("denied")).toBeTruthy();
  });

  it("does not show the previous answer while a new one is being checked", async () => {
    const { manager } = await buildBlogRbac();

    const { rerender } = renderWithRbac(
      <Can permission="createPost">
        <span>allowed</span>
      </Can>,
      manager,
      USERS.alice,
    );

    expect(await screen.findByText("allowed")).toBeTruthy();

    rerender(
      <Can permission="admin">
        <span>allowed</span>
      </Can>,
    );

    expect(screen.queryByText("allowed")).toBeNull();
  });
});

interface BoundaryProps {
  children: ReactNode;
}

class Boundary extends Component<BoundaryProps, { message: string | null }> {
  public override state = { message: null as string | null };

  public static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  public override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Swallowed: the test asserts on what the boundary rendered.
  }

  public override render(): ReactNode {
    return this.state.message === null ? this.props.children : <span>{this.state.message}</span>;
  }
}

describe("Can with a broken rule", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  afterEach(() => {
    consoleError.mockClear();
  });

  /** A rejected check is a configuration defect, so it must not read as a denial. */
  it("throws to the error boundary instead of rendering the fallback", async () => {
    const store = new InMemoryRbacStore();
    const manager = new RbacManager({ store, rules: new RuleRegistry() });
    const secret = createPermission({ name: "secret", ruleName: "missing" });
    await manager.add(secret);
    await manager.assign(secret, "alice");

    renderWithRbac(
      <Boundary>
        <Can permission="secret" fallback={<span>denied</span>}>
          <span>secret</span>
        </Can>
      </Boundary>,
      manager,
      USERS.alice,
    );

    expect(await screen.findByText('Rule "missing" is not registered.')).toBeTruthy();
    expect(screen.queryByText("denied")).toBeNull();
  });
});
