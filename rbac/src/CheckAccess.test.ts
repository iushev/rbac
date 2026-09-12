import { beforeEach, describe, expect, it, vi } from "vitest";

import { CheckAccess } from "./CheckAccess.js";
import { InMemoryRbacStore } from "./InMemoryRbacStore.js";
import { createPermission, createRole } from "./Item.js";
import type { RbacManager } from "./RbacManager.js";
import { RuleRegistry, UnknownRuleError } from "./Rule.js";
import { buildBlogRbac } from "./testing/blog.js";

describe("CheckAccess", () => {
  let manager: RbacManager;
  let store: InMemoryRbacStore;

  beforeEach(async () => {
    ({ manager, store } = await buildBlogRbac());
  });

  it("grants an item assigned directly", async () => {
    await expect(manager.checkAccess({ username: "bob", itemName: "reader" })).resolves.toBe(true);
  });

  it("grants a permission one level below the assigned role", async () => {
    await expect(manager.checkAccess({ username: "bob", itemName: "viewPost" })).resolves.toBe(
      true,
    );
  });

  it("grants a permission several levels below the assigned role", async () => {
    // root -> admin -> author -> reader -> viewPost
    await expect(manager.checkAccess({ username: "root", itemName: "viewPost" })).resolves.toBe(
      true,
    );
  });

  it("denies a permission the user's role does not reach", async () => {
    await expect(manager.checkAccess({ username: "bob", itemName: "createPost" })).resolves.toBe(
      false,
    );
  });

  it("denies a user with no assignments at all", async () => {
    await expect(manager.checkAccess({ username: "nobody", itemName: "viewPost" })).resolves.toBe(
      false,
    );
  });

  it("denies an unknown item", async () => {
    await expect(manager.checkAccess({ username: "root", itemName: "nosuch" })).resolves.toBe(
      false,
    );
  });

  it("grants a default role without an assignment", async () => {
    const guestChecker = new CheckAccess({ store, defaultRoles: ["reader"] });

    await expect(
      guestChecker.checkAccess({ username: "nobody", itemName: "viewPost" }),
    ).resolves.toBe(true);
  });

  describe("rules", () => {
    it("grants the rule-guarded permission when the rule passes", async () => {
      await expect(
        manager.checkAccess({
          username: "alice",
          itemName: "updateOwnPost",
          params: { post: { authorId: "alice" } },
        }),
      ).resolves.toBe(true);
    });

    it("reaches the unruled permission through the rule-guarded parent", async () => {
      // alice is an author: updatePost -> updateOwnPost (isAuthor) -> author.
      await expect(
        manager.checkAccess({
          username: "alice",
          itemName: "updatePost",
          params: { post: { authorId: "alice" } },
        }),
      ).resolves.toBe(true);
    });

    it("denies when the rule fails, even though the hierarchy allows it", async () => {
      await expect(
        manager.checkAccess({
          username: "alice",
          itemName: "updatePost",
          params: { post: { authorId: "bob" } },
        }),
      ).resolves.toBe(false);
    });

    it("grants an admin the unruled permission for someone else's post", async () => {
      // admin holds updatePost directly, so the isAuthor branch never decides it.
      await expect(
        manager.checkAccess({
          username: "root",
          itemName: "updatePost",
          params: { post: { authorId: "alice" } },
        }),
      ).resolves.toBe(true);
    });

    it("still applies the rule to an admin asking for the guarded permission itself", async () => {
      await expect(
        manager.checkAccess({
          username: "root",
          itemName: "updateOwnPost",
          params: { post: { authorId: "alice" } },
        }),
      ).resolves.toBe(false);
    });

    it("denies a reader the permission on any post", async () => {
      await expect(
        manager.checkAccess({
          username: "bob",
          itemName: "updatePost",
          params: { post: { authorId: "bob" } },
        }),
      ).resolves.toBe(false);
    });

    it("passes the stored rule data to the implementation", async () => {
      const isAuthor = vi.fn(() => true);
      const local = await buildBlogRbac({ rules: { isAuthor } });
      await local.manager.update("isAuthor", { name: "isAuthor", data: "strict" });

      await local.manager.checkAccess({ username: "alice", itemName: "updateOwnPost" });

      expect(isAuthor).toHaveBeenCalledWith(expect.objectContaining({ username: "alice", data: "strict" }));
    });

    it("throws when an item on the path names a rule that is not registered", async () => {
      const checker = new CheckAccess({ store, rules: new RuleRegistry() });

      await expect(
        checker.checkAccess({ username: "alice", itemName: "updatePost" }),
      ).rejects.toBeInstanceOf(UnknownRuleError);
    });
  });

  describe("traversal", () => {
    it("terminates on a cyclic hierarchy instead of recursing forever", async () => {
      // Build the cycle behind the manager's back: addChild would reject it.
      const cyclic = new InMemoryRbacStore();
      const a = createRole({ name: "a" });
      const b = createRole({ name: "b" });
      const leaf = createPermission({ name: "leaf" });
      for (const item of [a, b, leaf]) {
        await cyclic.addItem(item);
      }
      await cyclic.addChild(a, b);
      await cyclic.addChild(b, a);
      await cyclic.addChild(b, leaf);

      const checker = new CheckAccess({ store: cyclic });

      await expect(checker.checkAccess({ username: "nobody", itemName: "leaf" })).resolves.toBe(
        false,
      );
    });

    it("looks assignments up once per check, not once per hierarchy level", async () => {
      const spy = vi.spyOn(store, "getAssignments");

      await manager.checkAccess({ username: "root", itemName: "viewPost" });

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("uses pre-fetched assignments when they are supplied", async () => {
      const assignments = await store.getAssignments("root");
      const spy = vi.spyOn(store, "getAssignments");

      await expect(
        manager.checkAccess({ username: "root", itemName: "viewPost", assignments }),
      ).resolves.toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
