import {
  createPermission,
  createRole,
  createRule,
  ItemType,
  type Item,
} from "@iushev/rbac";
import { QueryTypes, type Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SequelizeRbacStore } from "./SequelizeRbacStore.js";
import { createStore, hasTestDatabase, resetDatabase, setupDatabase } from "./testing/db.js";

const viewPost = createPermission({ name: "viewPost" });
const createPost = createPermission({ name: "createPost" });
const reader = createRole({ name: "reader" });
const author = createRole({ name: "author" });

describe.skipIf(!hasTestDatabase)("SequelizeRbacStore", () => {
  let sequelize: Sequelize;
  let store: SequelizeRbacStore;

  beforeAll(async () => {
    sequelize = await setupDatabase();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await resetDatabase(sequelize);
    store = createStore(sequelize);
  });

  /** reader -> viewPost, author -> reader, author -> createPost */
  async function seedHierarchy(): Promise<void> {
    for (const item of [viewPost, createPost, reader, author]) {
      await store.addItem(item);
    }
    await store.addChild(reader, viewPost);
    await store.addChild(author, reader);
    await store.addChild(author, createPost);
  }

  describe("items", () => {
    it("round-trips every field", async () => {
      const item = createPermission({
        name: "updatePost",
        description: "Update a post",
        data: "weight=10",
      });
      await store.addItem(item);

      await expect(store.getItem("updatePost")).resolves.toEqual(item);
    });

    it("stores the payload unchanged, and a missing one as NULL", async () => {
      await store.addItem(createPermission({ name: "updatePost", data: '{"weight":10}' }));
      await store.addItem(createPermission({ name: "viewPost", data: "post" }));
      await store.addItem(reader);

      const rows = await sequelize.query<{ name: string; data: string | null }>(
        `SELECT "name", "data" FROM "rbac_items" ORDER BY "name"`,
        { type: QueryTypes.SELECT },
      );
      expect(rows).toEqual([
        { name: "reader", data: null },
        { name: "updatePost", data: '{"weight":10}' },
        { name: "viewPost", data: "post" },
      ]);
    });

    it("carries the payload on the hand-written queries too", async () => {
      const updatePost = createPermission({ name: "updatePost", data: "weight=10" });
      await store.addItem(updatePost);
      await store.addItem(author);
      await store.addChild(author, updatePost);
      await store.assign(author, "alice");

      const expected = new Map([["updatePost", updatePost]]);
      await expect(store.getChildren("author")).resolves.toEqual(expected);
      await expect(store.getPermissionsByRole("author")).resolves.toEqual(expected);
      await expect(store.getPermissionsByUser("alice")).resolves.toEqual(expected);
    });

    it("defaults description, ruleName and data to null", async () => {
      await store.addItem(viewPost);

      await expect(store.getItem("viewPost")).resolves.toEqual({
        type: ItemType.permission,
        name: "viewPost",
        description: null,
        ruleName: null,
        data: null,
      });
    });

    it("returns null for an unknown item", async () => {
      await expect(store.getItem("nope")).resolves.toBeNull();
    });

    it("throws on a duplicate name", async () => {
      await store.addItem(viewPost);

      await expect(store.addItem(viewPost)).rejects.toThrow(/already exists/);
    });

    it("narrows getItems by type", async () => {
      await seedHierarchy();

      await expect(store.getItems()).resolves.toHaveProperty("size", 4);
      const roles = await store.getItems(ItemType.role);
      expect([...roles.keys()].sort()).toEqual(["author", "reader"]);
    });

    it("returns false when updating an item that does not exist", async () => {
      await expect(store.updateItem("nope", viewPost)).resolves.toBe(false);
    });

    it("throws when a rename collides with an existing item", async () => {
      await store.addItem(viewPost);
      await store.addItem(createPost);

      await expect(
        store.updateItem("viewPost", { ...createPost, name: "createPost" }),
      ).rejects.toThrow(/already exists/);
    });

    it("carries a rename across hierarchy edges and assignments", async () => {
      await seedHierarchy();
      await store.assign(reader, "bob");

      await expect(
        store.updateItem("reader", { ...reader, name: "subscriber", description: "renamed" }),
      ).resolves.toBe(true);

      await expect(store.getItem("reader")).resolves.toBeNull();
      await expect(store.getItem("subscriber")).resolves.toMatchObject({
        name: "subscriber",
        description: "renamed",
      });
      // ON UPDATE CASCADE moved both edges and the assignment.
      expect([...(await store.getChildren("subscriber")).keys()]).toEqual(["viewPost"]);
      expect([...(await store.getParents("subscriber")).keys()]).toEqual(["author"]);
      expect([...(await store.getAssignments("bob")).keys()]).toEqual(["subscriber"]);
    });

    it("removes hierarchy edges and assignments with the item", async () => {
      await seedHierarchy();
      await store.assign(reader, "bob");

      await expect(store.removeItem(reader)).resolves.toBe(true);

      await expect(store.getItem("reader")).resolves.toBeNull();
      await expect(store.getParents("viewPost")).resolves.toHaveProperty("size", 0);
      await expect(store.getChildren("author")).resolves.toHaveProperty("size", 1);
      await expect(store.getAssignments("bob")).resolves.toHaveProperty("size", 0);
    });

    it("returns false when removing an item that does not exist", async () => {
      await expect(store.removeItem(reader)).resolves.toBe(false);
    });
  });

  describe("rules", () => {
    it("round-trips a rule and its payload", async () => {
      await store.addRule(createRule("isAuthor", "field=authorId"));

      await expect(store.getRule("isAuthor")).resolves.toEqual({
        name: "isAuthor",
        data: "field=authorId",
      });
    });

    it("stores the payload unchanged, and a missing one as NULL", async () => {
      await store.addRule(createRule("isAuthor", '{"field":"authorId"}'));
      await store.addRule(createRule("hasTag", "post"));
      await store.addRule(createRule("isOwner"));

      const rows = await sequelize.query<{ name: string; data: string | null }>(
        `SELECT "name", "data" FROM "rbac_rules" ORDER BY "name"`,
        { type: QueryTypes.SELECT },
      );
      expect(rows).toEqual([
        { name: "hasTag", data: "post" },
        { name: "isAuthor", data: '{"field":"authorId"}' },
        { name: "isOwner", data: null },
      ]);
      const rules = await store.getRules();
      expect([...rules.values()].map((rule) => rule.data)).toEqual(
        expect.arrayContaining(["post", '{"field":"authorId"}', null]),
      );
    });

    it("throws on a duplicate rule name", async () => {
      await store.addRule(createRule("isAuthor"));

      await expect(store.addRule(createRule("isAuthor"))).rejects.toThrow(/already exists/);
    });

    it("returns false when updating a rule that does not exist", async () => {
      await expect(store.updateRule("nope", createRule("nope"))).resolves.toBe(false);
    });

    it("carries a rule rename onto referencing items", async () => {
      await store.addRule(createRule("isAuthor"));
      await store.addItem(createPermission({ name: "updatePost", ruleName: "isAuthor" }));

      await expect(store.updateRule("isAuthor", createRule("isOwner"))).resolves.toBe(true);

      await expect(store.getItem("updatePost")).resolves.toMatchObject({ ruleName: "isOwner" });
    });

    it("clears ruleName on referencing items when the rule is removed", async () => {
      const rule = createRule("isAuthor");
      await store.addRule(rule);
      await store.addItem(createPermission({ name: "updatePost", ruleName: "isAuthor" }));

      await expect(store.removeRule(rule)).resolves.toBe(true);

      await expect(store.getItem("updatePost")).resolves.toMatchObject({ ruleName: null });
    });

    it("returns false when removing a rule that does not exist", async () => {
      await expect(store.removeRule(createRule("nope"))).resolves.toBe(false);
    });
  });

  describe("hierarchy", () => {
    it("reports children and parents", async () => {
      await seedHierarchy();

      expect([...(await store.getChildren("author")).keys()].sort()).toEqual([
        "createPost",
        "reader",
      ]);
      expect([...(await store.getParents("viewPost")).keys()]).toEqual(["reader"]);
      expect(await store.getChildren("viewPost")).toHaveProperty("size", 0);
    });

    it("returns whole items, not just names", async () => {
      await seedHierarchy();

      const children = await store.getChildren("reader");
      expect(children.get("viewPost")).toEqual(viewPost);
    });

    it("throws when either end of a new edge is missing", async () => {
      await store.addItem(reader);

      await expect(store.addChild(reader, viewPost)).rejects.toThrow(/must exist/);
      await expect(store.addChild(viewPost, reader)).rejects.toThrow(/must exist/);
    });

    it("returns false when the edge already exists", async () => {
      await seedHierarchy();

      await expect(store.addChild(reader, viewPost)).resolves.toBe(false);
    });

    it("removes a single edge and keeps the items", async () => {
      await seedHierarchy();

      await expect(store.removeChild(author, reader)).resolves.toBe(true);
      await expect(store.removeChild(author, reader)).resolves.toBe(false);
      await expect(store.getItem("reader")).resolves.toEqual(reader);
      expect([...(await store.getChildren("author")).keys()]).toEqual(["createPost"]);
    });

    it("removes every edge of a parent, and reports when there were none", async () => {
      await seedHierarchy();

      await expect(store.removeChildren(author)).resolves.toBe(true);
      await expect(store.getChildren("author")).resolves.toHaveProperty("size", 0);
      await expect(store.removeChildren(author)).resolves.toBe(false);
      await expect(store.getItem("createPost")).resolves.toEqual(createPost);
    });

    it("answers hasChild", async () => {
      await seedHierarchy();

      await expect(store.hasChild(reader, viewPost)).resolves.toBe(true);
      await expect(store.hasChild(author, viewPost)).resolves.toBe(false);
    });
  });

  describe("assignments", () => {
    it("assigns and reads back", async () => {
      await store.addItem(reader);

      const assignment = await store.assign(reader, "bob");
      expect(assignment).toEqual({ username: "bob", itemName: "reader" });

      await expect(store.getAssignment("reader", "bob")).resolves.toEqual(assignment);
    });

    it("is idempotent", async () => {
      await store.addItem(reader);

      const first = await store.assign(reader, "bob");
      const second = await store.assign(reader, "bob");

      expect(second).toEqual(first);
      await expect(store.getAssignments("bob")).resolves.toHaveProperty("size", 1);
    });

    it("returns null for an assignment that does not exist", async () => {
      await expect(store.getAssignment("reader", "bob")).resolves.toBeNull();
    });

    it("revokes one assignment", async () => {
      await seedHierarchy();
      await store.assign(reader, "bob");
      await store.assign(author, "bob");

      await expect(store.revoke(reader, "bob")).resolves.toBe(true);
      await expect(store.revoke(reader, "bob")).resolves.toBe(false);
      expect([...(await store.getAssignments("bob")).keys()]).toEqual(["author"]);
    });

    it("revokes every assignment of a user", async () => {
      await seedHierarchy();
      await store.assign(reader, "bob");
      await store.assign(author, "bob");
      await store.assign(reader, "alice");

      await expect(store.revokeAll("bob")).resolves.toBe(true);
      await expect(store.revokeAll("bob")).resolves.toBe(false);
      await expect(store.getAssignments("bob")).resolves.toHaveProperty("size", 0);
      await expect(store.getAssignments("alice")).resolves.toHaveProperty("size", 1);
    });

    it("lists usernames by role", async () => {
      await seedHierarchy();
      await store.assign(reader, "bob");
      await store.assign(reader, "alice");
      await store.assign(author, "root");

      expect((await store.getUsernamesByRole("reader")).sort()).toEqual(["alice", "bob"]);
      await expect(store.getUsernamesByRole("author")).resolves.toEqual(["root"]);
      await expect(store.getUsernamesByRole("nobody")).resolves.toEqual([]);
    });
  });

  describe("transitive queries", () => {
    beforeEach(seedHierarchy);

    it("returns only directly assigned roles", async () => {
      await store.assign(author, "alice");

      expect([...(await store.getRolesByUser("alice")).keys()]).toEqual(["author"]);
    });

    it("ignores directly assigned permissions in getRolesByUser", async () => {
      await store.assign(createPost, "alice");

      await expect(store.getRolesByUser("alice")).resolves.toHaveProperty("size", 0);
    });

    it("includes the role itself in getChildRoles", async () => {
      expect([...(await store.getChildRoles("author")).keys()].sort()).toEqual([
        "author",
        "reader",
      ]);
      expect([...(await store.getChildRoles("reader")).keys()]).toEqual(["reader"]);
    });

    it("throws for a role that does not exist or is a permission", async () => {
      await expect(store.getChildRoles("nope")).rejects.toThrow(/not found/);
      await expect(store.getChildRoles("viewPost")).rejects.toThrow(/not found/);
    });

    it("collects permissions at any depth below a role", async () => {
      expect([...(await store.getPermissionsByRole("author")).keys()].sort()).toEqual([
        "createPost",
        "viewPost",
      ]);
      expect([...(await store.getPermissionsByRole("reader")).keys()]).toEqual(["viewPost"]);
    });

    it("returns an empty map for a role with no permissions below it", async () => {
      await store.addItem(createRole({ name: "guest" }));

      await expect(store.getPermissionsByRole("guest")).resolves.toHaveProperty("size", 0);
    });

    it("collects permissions of a user through roles and directly", async () => {
      await store.addItem(createPermission({ name: "deletePost" }));
      await store.assign(author, "alice");
      await store.assign(createPermission({ name: "deletePost" }), "alice");

      expect([...(await store.getPermissionsByUser("alice")).keys()].sort()).toEqual([
        "createPost",
        "deletePost",
        "viewPost",
      ]);
    });

    it("terminates on a cycle in the hierarchy", async () => {
      // The store persists what it is told; loop rejection lives in RbacManager,
      // so a cycle can exist and the recursive queries must survive it.
      await store.addChild(reader, author);

      expect([...(await store.getChildRoles("author")).keys()].sort()).toEqual([
        "author",
        "reader",
      ]);
      expect([...(await store.getPermissionsByRole("reader")).keys()].sort()).toEqual([
        "createPost",
        "viewPost",
      ]);
    });
  });

  describe("bulk removal", () => {
    beforeEach(async () => {
      await store.addRule(createRule("isAuthor"));
      await seedHierarchy();
      await store.updateItem("createPost", { ...createPost, ruleName: "isAuthor" });
      await store.assign(reader, "bob");
    });

    it("removeAll empties everything", async () => {
      await store.removeAll();

      await expect(store.getItems()).resolves.toHaveProperty("size", 0);
      await expect(store.getRules()).resolves.toHaveProperty("size", 0);
      await expect(store.getAssignments("bob")).resolves.toHaveProperty("size", 0);
      await expect(store.getChildren("author")).resolves.toHaveProperty("size", 0);
    });

    it("removeAllRoles keeps permissions and drops the roles' edges", async () => {
      await store.removeAllRoles();

      expect([...(await store.getItems()).keys()].sort()).toEqual(["createPost", "viewPost"]);
      await expect(store.getParents("viewPost")).resolves.toHaveProperty("size", 0);
      await expect(store.getAssignments("bob")).resolves.toHaveProperty("size", 0);
    });

    it("removeAllPermissions keeps roles", async () => {
      await store.removeAllPermissions();

      expect([...(await store.getItems()).keys()].sort()).toEqual(["author", "reader"]);
      expect([...(await store.getChildren("author")).keys()]).toEqual(["reader"]);
    });

    it("removeAllRules clears ruleName on every item", async () => {
      await store.removeAllRules();

      await expect(store.getRules()).resolves.toHaveProperty("size", 0);
      await expect(store.getItem("createPost")).resolves.toMatchObject({ ruleName: null });
    });

    it("removeAllAssignments keeps items", async () => {
      await store.removeAllAssignments();

      await expect(store.getAssignments("bob")).resolves.toHaveProperty("size", 0);
      await expect(store.getItems()).resolves.toHaveProperty("size", 4);
    });
  });

  describe("transactions", () => {
    it("rolls the whole sequence back on error", async () => {
      await expect(
        store.withTransaction(async (tx) => {
          await tx.addItem(reader);
          await tx.addItem(viewPost);
          await tx.addChild(reader, viewPost);
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      await expect(store.getItems()).resolves.toHaveProperty("size", 0);
    });

    it("commits on success", async () => {
      const item: Item = await store.withTransaction(async (tx) => {
        await tx.addItem(reader);
        await tx.assign(reader, "bob");
        return reader;
      });

      await expect(store.getItem(item.name)).resolves.toEqual(reader);
      await expect(store.getAssignments("bob")).resolves.toHaveProperty("size", 1);
    });
  });
});
