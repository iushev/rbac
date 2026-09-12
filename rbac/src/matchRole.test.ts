import { beforeEach, describe, expect, it } from "vitest";

import type { RbacManager } from "./RbacManager.js";
import { RbacUser, type Identity } from "./User.js";
import { matchRole } from "./matchRole.js";
import { buildBlogRbac } from "./testing/blog.js";

const identity = (over: Partial<Identity> = {}): Identity => ({
  username: "alice",
  isActive: true,
  isSuperuser: false,
  ...over,
});

describe("matchRole", () => {
  let manager: RbacManager;

  beforeEach(async () => {
    ({ manager } = await buildBlogRbac());
  });

  it("matches everyone when no roles are listed", async () => {
    const user = new RbacUser(manager);

    await expect(matchRole({ user, roles: [] })).resolves.toBe(true);
  });

  it("matches '?' for a guest only", async () => {
    await expect(matchRole({ user: new RbacUser(manager), roles: ["?"] })).resolves.toBe(true);
    await expect(
      matchRole({ user: new RbacUser(manager, identity()), roles: ["?"] }),
    ).resolves.toBe(false);
  });

  it("matches '@' for an authenticated user only", async () => {
    await expect(
      matchRole({ user: new RbacUser(manager, identity()), roles: ["@"] }),
    ).resolves.toBe(true);
    await expect(matchRole({ user: new RbacUser(manager), roles: ["@"] })).resolves.toBe(false);
  });

  it("matches a named permission through the hierarchy", async () => {
    const user = new RbacUser(manager, identity({ username: "bob" }));

    await expect(matchRole({ user, roles: ["viewPost"] })).resolves.toBe(true);
    await expect(matchRole({ user, roles: ["createPost"] })).resolves.toBe(false);
  });

  it("matches when any one of several roles matches", async () => {
    const user = new RbacUser(manager, identity({ username: "bob" }));

    await expect(matchRole({ user, roles: ["admin", "author", "reader"] })).resolves.toBe(true);
  });

  it("inverts the outcome for a deny list", async () => {
    const bob = new RbacUser(manager, identity({ username: "bob" }));

    // bob is a reader: he matches the deny list, so he is denied.
    await expect(matchRole({ user: bob, roles: ["reader"], allow: false })).resolves.toBe(false);
    // he is not an admin, so an admin-only deny list lets him through.
    await expect(matchRole({ user: bob, roles: ["admin"], allow: false })).resolves.toBe(true);
  });

  it("denies an inactive user regardless of the list", async () => {
    const user = new RbacUser(manager, identity({ isActive: false }));

    await expect(matchRole({ user, roles: [] })).resolves.toBe(false);
    await expect(matchRole({ user, roles: ["@"] })).resolves.toBe(false);
  });
});
