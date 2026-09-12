import { fromSnapshot } from "@iushev/rbac";
import { describe, expect, it } from "vitest";

import { toSessionState } from "./session.js";
import { buildBlogRbac } from "./testing/blog.js";
import { USERS } from "./testing/users.js";

describe("toSessionState", () => {
  it("carries the graph and the user's own assignments", async () => {
    const { store } = await buildBlogRbac();

    const state = await toSessionState(store, USERS.alice);

    expect(state.user).toBe(USERS.alice);
    expect(state.assignments).toEqual(["author"]);
    expect(fromSnapshot(state.snapshot).items.has("updateOwnPost")).toBe(true);
  });

  it("gives a guest the graph and no assignments", async () => {
    const { store } = await buildBlogRbac();

    const state = await toSessionState(store, null);

    expect(state.user).toBeNull();
    expect(state.assignments).toEqual([]);
    expect(state.snapshot.items.length).toBeGreaterThan(0);
  });

  it("never carries anyone else's assignments", async () => {
    const { store } = await buildBlogRbac();

    const state = await toSessionState(store, USERS.bob);

    expect(state.assignments).toEqual(["reader"]);
    expect(JSON.stringify(state.snapshot)).not.toContain("alice");
  });
});
