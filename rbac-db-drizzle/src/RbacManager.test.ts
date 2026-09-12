import { createPermission, createRole, type RbacManager } from "@iushev/rbac";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { DrizzleRbacStore } from "./DrizzleRbacStore.js";
import { buildBlogRbac } from "./testing/blog.js";
import {
  hasTestDatabase,
  resetDatabase,
  setupDatabase,
  type TestConnection,
} from "./testing/db.js";

/**
 * The `RbacManager` suite from the `rbac` package, run against PostgreSQL.
 *
 * The assertions are deliberately unchanged: passing them is the evidence that
 * `DrizzleRbacStore` and `InMemoryRbacStore` are interchangeable.
 */
describe.skipIf(!hasTestDatabase)("RbacManager over DrizzleRbacStore", () => {
  let connection: TestConnection;
  let manager: RbacManager;
  let store: DrizzleRbacStore;

  beforeAll(async () => {
    connection = await setupDatabase();
  });

  afterAll(async () => {
    await connection.close();
  });

  beforeEach(async () => {
    await resetDatabase(connection);
    ({ manager, store } = await buildBlogRbac(connection));
  });

  describe("hierarchy validation", () => {
    it("rejects a role under a permission", async () => {
      const createPost = await manager.getPermission("createPost");
      const reader = await manager.getRole("reader");

      await expect(manager.canAddChild(createPost!, reader!)).resolves.toBe(false);
      await expect(manager.addChild(createPost!, reader!)).rejects.toThrow(/Cannot add role/);
    });

    it("allows a permission under a permission", async () => {
      const createPost = await manager.getPermission("createPost");
      const viewPost = await manager.getPermission("viewPost");

      await expect(manager.canAddChild(createPost!, viewPost!)).resolves.toBe(true);
    });

    it("rejects an item under itself", async () => {
      const admin = await manager.getRole("admin");

      await expect(manager.canAddChild(admin!, admin!)).resolves.toBe(false);
      await expect(manager.addChild(admin!, admin!)).rejects.toThrow(/child of itself/);
    });

    it("rejects an edge that would close a loop", async () => {
      const reader = await manager.getRole("reader");
      const admin = await manager.getRole("admin");

      await expect(manager.canAddChild(reader!, admin!)).resolves.toBe(false);
      await expect(manager.addChild(reader!, admin!)).rejects.toThrow(/loop has been detected/);
    });

    it("removes a single edge without deleting the items", async () => {
      const author = await manager.getRole("author");
      const createPost = await manager.getPermission("createPost");

      await expect(manager.removeChild(author!, createPost!)).resolves.toBe(true);

      await expect(manager.hasChild(author!, createPost!)).resolves.toBe(false);
      await expect(manager.getPermission("createPost")).resolves.not.toBeNull();
      await expect(
        manager.checkAccess({ username: "alice", itemName: "createPost" }),
      ).resolves.toBe(false);
    });
  });

  describe("add / update / remove", () => {
    it("dispatches on the item discriminant, not instanceof", async () => {
      const revived = JSON.parse(JSON.stringify(createRole({ name: "editor" }))) as ReturnType<
        typeof createRole
      >;

      await expect(manager.add(revived)).resolves.toBe(true);
      await expect(manager.getRole("editor")).resolves.not.toBeNull();
    });

    it("creates a placeholder rule for an item naming an unknown rule", async () => {
      await manager.add(createPermission({ name: "deletePost", ruleName: "isOwner" }));

      await expect(manager.getRule("isOwner")).resolves.toEqual({ name: "isOwner", data: null });
    });

    it("removes an item along with its edges and assignments", async () => {
      const reader = await manager.getRole("reader");

      await expect(manager.remove(reader!)).resolves.toBe(true);

      await expect(manager.getRole("reader")).resolves.toBeNull();
      await expect(store.getParents("viewPost")).resolves.toEqual(new Map());
      await expect(manager.getAssignment("reader", "bob")).resolves.toBeNull();
    });

    it("carries assignments and edges through a rename", async () => {
      const reader = await manager.getRole("reader");
      await manager.update("reader", { ...reader!, name: "viewer" });

      await expect(manager.getAssignment("viewer", "bob")).resolves.not.toBeNull();
      await expect(manager.checkAccess({ username: "bob", itemName: "viewPost" })).resolves.toBe(
        true,
      );
      await expect(manager.checkAccess({ username: "root", itemName: "viewPost" })).resolves.toBe(
        true,
      );
    });
  });

  describe("queries", () => {
    it("returns only directly assigned roles", async () => {
      await expect(manager.getRolesByUser("root")).resolves.toEqual(
        new Map([["admin", await manager.getRole("admin")]]),
      );
    });

    it("returns child roles including the role itself", async () => {
      const names = [...(await manager.getChildRoles("admin")).keys()].sort();

      expect(names).toEqual(["admin", "author", "reader"]);
    });

    it("returns every permission a role reaches", async () => {
      const names = [...(await manager.getPermissionsByRole("author")).keys()].sort();

      expect(names).toEqual(["createPost", "updateOwnPost", "updatePost", "viewPost"]);
    });

    it("returns every permission a user reaches", async () => {
      const names = [...(await manager.getPermissionsByUser("bob")).keys()].sort();

      expect(names).toEqual(["viewPost"]);
    });

    it("lists the users of a role", async () => {
      await expect(manager.getUsernamesByRole("author")).resolves.toEqual(["alice"]);
    });
  });

  describe("checkAccess", () => {
    it("grants a permission reached through the role hierarchy", async () => {
      await expect(manager.checkAccess({ username: "root", itemName: "viewPost" })).resolves.toBe(
        true,
      );
    });

    it("denies a permission the user does not reach", async () => {
      await expect(manager.checkAccess({ username: "bob", itemName: "createPost" })).resolves.toBe(
        false,
      );
    });

    it("runs the rule attached to a permission", async () => {
      const post = { authorId: "alice" };

      await expect(
        manager.checkAccess({ username: "alice", itemName: "updateOwnPost", params: { post } }),
      ).resolves.toBe(true);
      await expect(
        manager.checkAccess({ username: "root", itemName: "updateOwnPost", params: { post } }),
      ).resolves.toBe(false);
    });

    it("reaches the unruled permission through the rule-guarded parent", async () => {
      const post = { authorId: "alice" };

      await expect(
        manager.checkAccess({ username: "alice", itemName: "updatePost", params: { post } }),
      ).resolves.toBe(true);
      await expect(
        manager.checkAccess({
          username: "alice",
          itemName: "updatePost",
          params: { post: { authorId: "bob" } },
        }),
      ).resolves.toBe(false);
    });

    it("grants an admin the unruled permission for someone else's post", async () => {
      await expect(
        manager.checkAccess({
          username: "root",
          itemName: "updatePost",
          params: { post: { authorId: "alice" } },
        }),
      ).resolves.toBe(true);
    });
  });

  describe("getRbac", () => {
    it("returns the whole graph", async () => {
      const rbac = await manager.getRbac();

      expect([...rbac.items.keys()].sort()).toEqual([
        "admin",
        "author",
        "createPost",
        "reader",
        "updateOwnPost",
        "updatePost",
        "viewPost",
      ]);
      expect([...(rbac.parents.get("viewPost") ?? []).keys()]).toEqual(["reader"]);
      expect([...rbac.rules.keys()]).toEqual(["isAuthor"]);
    });

    it("returns a copy that does not alias store state", async () => {
      const rbac = await manager.getRbac();

      rbac.items.get("admin")!.description = "mutated";
      rbac.items.delete("author");

      const fresh = await manager.getRbac();
      expect(fresh.items.get("admin")?.description).toBeNull();
      expect(fresh.items.has("author")).toBe(true);
    });
  });

  describe("bulk removal", () => {
    it("removes all roles and the edges that used them", async () => {
      await manager.removeAllRoles();

      expect([...(await manager.getRoles()).keys()]).toEqual([]);
      expect([...(await manager.getPermissions()).keys()].sort()).toEqual([
        "createPost",
        "updateOwnPost",
        "updatePost",
        "viewPost",
      ]);
      await expect(store.getParents("viewPost")).resolves.toEqual(new Map());
    });

    it("clears rule references when all rules are removed", async () => {
      await manager.removeAllRules();

      expect((await manager.getPermission("updateOwnPost"))?.ruleName).toBeNull();
      await expect(
        manager.checkAccess({ username: "alice", itemName: "updateOwnPost" }),
      ).resolves.toBe(true);
    });
  });
});
