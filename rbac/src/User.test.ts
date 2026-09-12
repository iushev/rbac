import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InMemoryRbacStore } from "./InMemoryRbacStore.js";
import type { RbacManager } from "./RbacManager.js";
import { RbacUser, type Identity } from "./User.js";
import { buildBlogRbac } from "./testing/blog.js";

const identity = (over: Partial<Identity> = {}): Identity => ({
  username: "alice",
  isActive: true,
  isSuperuser: false,
  ...over,
});

describe("RbacUser", () => {
  let manager: RbacManager;
  let store: InMemoryRbacStore;

  beforeEach(async () => {
    ({ manager, store } = await buildBlogRbac());
  });

  it("treats a missing identity as a guest", async () => {
    const user = new RbacUser(manager);

    expect(user.isGuest).toBe(true);
    expect(user.username).toBe("guest");
    await expect(user.can({ permissionName: "viewPost" })).resolves.toBe(false);
  });

  it("checks a real identity against the hierarchy", async () => {
    const user = new RbacUser(manager, identity());

    await expect(user.can({ permissionName: "viewPost" })).resolves.toBe(true);
    await expect(user.can({ permissionName: "nosuch" })).resolves.toBe(false);
  });

  it("denies an inactive user everything without consulting the store", async () => {
    const user = new RbacUser(manager, identity({ isActive: false }));
    const spy = vi.spyOn(store, "getAssignments");

    await expect(user.can({ permissionName: "viewPost" })).resolves.toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("grants a superuser everything without consulting the store", async () => {
    const user = new RbacUser(manager, identity({ username: "su", isSuperuser: true }));
    const spy = vi.spyOn(store, "getAssignments");

    await expect(user.can({ permissionName: "nosuch" })).resolves.toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("memoizes parameterless checks", async () => {
    const user = new RbacUser(manager, identity());
    const spy = vi.spyOn(store, "getAssignments");

    await user.can({ permissionName: "viewPost" });
    await user.can({ permissionName: "viewPost" });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("memoizes a denial too, not just a grant", async () => {
    const user = new RbacUser(manager, identity());
    const spy = vi.spyOn(store, "getAssignments");

    await expect(user.can({ permissionName: "nosuch" })).resolves.toBe(false);
    await expect(user.can({ permissionName: "nosuch" })).resolves.toBe(false);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("never memoizes a parameterized check, since the rule depends on the params", async () => {
    const user = new RbacUser(manager, identity());

    await expect(
      user.can({ permissionName: "updatePost", params: { post: { authorId: "alice" } } }),
    ).resolves.toBe(true);
    await expect(
      user.can({ permissionName: "updatePost", params: { post: { authorId: "bob" } } }),
    ).resolves.toBe(false);
  });

  it("skips the cache when asked", async () => {
    const user = new RbacUser(manager, identity());
    const spy = vi.spyOn(store, "getAssignments");

    await user.can({ permissionName: "viewPost", allowCaching: false });
    await user.can({ permissionName: "viewPost", allowCaching: false });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("drops the cache when the identity changes", async () => {
    const user = new RbacUser(manager, identity());
    await expect(user.can({ permissionName: "createPost" })).resolves.toBe(true);

    user.identity = identity({ username: "bob" });

    await expect(user.can({ permissionName: "createPost" })).resolves.toBe(false);
  });
});
