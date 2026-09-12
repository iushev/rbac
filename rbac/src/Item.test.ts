import { describe, expect, it } from "vitest";

import { ItemType, cloneItem, createPermission, createRole, isPermission, isRole } from "./Item.js";

describe("Item", () => {
  it("fills in defaults for omitted fields", () => {
    const role = createRole({ name: "admin" });

    expect(role).toEqual({
      type: ItemType.role,
      name: "admin",
      description: null,
      ruleName: null,
      data: null,
    });
  });

  it("keeps the fields it is given", () => {
    const permission = createPermission({
      name: "updatePost",
      description: "Update a post",
      ruleName: "isAuthor",
      data: "weight=10",
    });

    expect(permission.type).toBe(ItemType.permission);
    expect(permission.description).toBe("Update a post");
    expect(permission.ruleName).toBe("isAuthor");
    expect(permission.data).toBe("weight=10");
  });

  it("discriminates roles from permissions", () => {
    const role = createRole({ name: "admin" });
    const permission = createPermission({ name: "createPost" });

    expect(isRole(role)).toBe(true);
    expect(isPermission(role)).toBe(false);
    expect(isRole(permission)).toBe(false);
    expect(isPermission(permission)).toBe(true);
  });

  it("survives a JSON round trip, so guards work on deserialized items", () => {
    const role = createRole({ name: "admin" });
    const revived = JSON.parse(JSON.stringify(role)) as typeof role;

    expect(revived).toEqual(role);
    expect(isRole(revived)).toBe(true);
  });

  it("clones without aliasing", () => {
    const role = createRole({ name: "admin" });
    const copy = cloneItem(role);

    copy.name = "renamed";

    expect(role.name).toBe("admin");
  });
});
