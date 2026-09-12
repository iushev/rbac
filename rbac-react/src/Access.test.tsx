import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Access } from "./Access.js";
import { buildBlogRbac } from "./testing/blog.js";
import { renderWithRbac } from "./testing/render.js";
import { USERS } from "./testing/users.js";

describe("Access", () => {
  it("renders the children when one of the roles matches", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(
      <Access roles={["admin", "author"]}>
        <span>panel</span>
      </Access>,
      manager,
      USERS.alice,
    );

    expect(await screen.findByText("panel")).toBeTruthy();
  });

  it("renders the fallback when none matches", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(
      <Access roles={["admin"]} fallback={<span>admins only</span>}>
        <span>panel</span>
      </Access>,
      manager,
      USERS.alice,
    );

    expect(await screen.findByText("admins only")).toBeTruthy();
    expect(screen.queryByText("panel")).toBeNull();
  });

  it('renders for a guest under "?"', async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(
      <Access roles={["?"]}>
        <span>login</span>
      </Access>,
      manager,
      null,
    );

    expect(await screen.findByText("login")).toBeTruthy();
  });

  it("hides the children from a matched role with allow={false}", async () => {
    const { manager } = await buildBlogRbac();

    const { container } = renderWithRbac(
      <Access roles={["admin"]} allow={false}>
        <span>public</span>
      </Access>,
      manager,
      USERS.root,
    );

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("shows the pending node while the check runs", async () => {
    const { manager } = await buildBlogRbac();

    renderWithRbac(
      <Access roles={["author"]} pending={<span>…</span>} fallback={<span>denied</span>}>
        <span>panel</span>
      </Access>,
      manager,
      USERS.alice,
    );

    expect(screen.getByText("…")).toBeTruthy();
    expect(await screen.findByText("panel")).toBeTruthy();
  });
});
