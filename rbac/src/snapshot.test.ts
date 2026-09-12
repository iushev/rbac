import { describe, expect, it } from "vitest";

import { CheckAccess } from "./CheckAccess.js";
import { InMemoryRbacStore } from "./InMemoryRbacStore.js";
import { RuleRegistry } from "./Rule.js";
import { toSnapshot, type RbacSnapshot } from "./snapshot.js";
import { buildBlogRbac } from "./testing/blog.js";

describe("snapshot", () => {
  it("round-trips the graph through JSON", async () => {
    const { store } = await buildBlogRbac();

    const snapshot = await toSnapshot(store);
    const wire = JSON.parse(JSON.stringify(snapshot)) as RbacSnapshot;
    const client = new InMemoryRbacStore(wire);

    await expect(client.getItems()).resolves.toEqual(await store.getItems());
    await expect(client.getRules()).resolves.toEqual(await store.getRules());
    for (const name of (await store.getItems()).keys()) {
      await expect(client.getChildren(name)).resolves.toEqual(await store.getChildren(name));
      await expect(client.getParents(name)).resolves.toEqual(await store.getParents(name));
    }
  });

  it("does not carry assignments, which are per user", async () => {
    const { store } = await buildBlogRbac();

    const snapshot = await toSnapshot(store);

    expect(Object.keys(snapshot)).toEqual(["items", "children", "rules"]);
  });

  it("supports the client flow: snapshot plus the current user's assignments", async () => {
    const { store } = await buildBlogRbac();

    // Server side: serialize the graph and the user's own assignments.
    const wire = JSON.stringify({
      rbac: await toSnapshot(store),
      assignments: [...(await store.getAssignments("alice")).values()],
    });

    // Client side: rebuild and check access with no network access of its own.
    const payload = JSON.parse(wire) as {
      rbac: RbacSnapshot;
      assignments: { username: string; itemName: string }[];
    };
    const client = new InMemoryRbacStore(payload.rbac);
    for (const assignment of payload.assignments) {
      const item = await client.getItem(assignment.itemName);
      await client.assign(item as never, assignment.username);
    }

    const checker = new CheckAccess({
      store: client,
      rules: new RuleRegistry({ isAuthor: ({ username }) => username === "alice" }),
    });

    await expect(checker.checkAccess({ username: "alice", itemName: "createPost" })).resolves.toBe(
      true,
    );
    await expect(checker.checkAccess({ username: "alice", itemName: "viewPost" })).resolves.toBe(
      true,
    );
  });
});
