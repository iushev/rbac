import { RbacUser } from "@iushev/rbac";
import { describe, expect, it } from "vitest";

import { ForbiddenError, UnauthorizedError } from "./errors.js";
import { access, can, requireCan, requireRole } from "./guards.js";
import { buildBlogRbac, type Post } from "./testing/blog.js";
import { runMiddleware } from "./testing/middleware.js";
import { USERS } from "./testing/users.js";
import type { RbacIdentity } from "./types.js";

const OWN_POST: Post = { id: 1, authorId: "alice" };
const OTHER_POST: Post = { id: 2, authorId: "bob" };

async function userFor(identity: RbacIdentity | null) {
  const { manager } = await buildBlogRbac();
  return new RbacUser<RbacIdentity>(manager, identity);
}

describe("requireCan", () => {
  it("lets a holder through", async () => {
    const user = await userFor(USERS.alice);

    await expect(requireCan(user, "createPost")).resolves.toBeUndefined();
  });

  it("refuses a guest with 401, not 403", async () => {
    const user = await userFor(null);

    await expect(requireCan(user, "createPost")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("refuses an authenticated user with 403", async () => {
    const user = await userFor(USERS.bob);

    await expect(requireCan(user, "createPost")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("names what it asked for", async () => {
    const user = await userFor(USERS.bob);

    await expect(requireCan(user, "createPost")).rejects.toMatchObject({
      status: 403,
      required: ["createPost"],
    });
  });

  it("hands the params to the rule, so an author reaches only their own post", async () => {
    const user = await userFor(USERS.alice);

    await expect(requireCan(user, "updatePost", { post: OWN_POST })).resolves.toBeUndefined();
    await expect(requireCan(user, "updatePost", { post: OTHER_POST })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("lets an admin past the rule, since they hold the permission directly", async () => {
    const user = await userFor(USERS.root);

    await expect(requireCan(user, "updatePost", { post: OTHER_POST })).resolves.toBeUndefined();
  });

  it("refuses an inactive user everything, superusers nothing", async () => {
    await expect(requireCan(await userFor(USERS.banned), "createPost")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(requireCan(await userFor(USERS.su), "createPost")).resolves.toBeUndefined();
  });
});

describe("requireRole", () => {
  it("matches any one of the roles", async () => {
    const user = await userFor(USERS.alice);

    await expect(requireRole(user, ["admin", "author"])).resolves.toBeUndefined();
  });

  it("understands the guest and authenticated wildcards", async () => {
    await expect(requireRole(await userFor(null), ["?"])).resolves.toBeUndefined();
    await expect(requireRole(await userFor(USERS.bob), ["@"])).resolves.toBeUndefined();
    await expect(requireRole(await userFor(USERS.bob), ["?"])).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("inverts into a deny list with allow: false", async () => {
    const user = await userFor(USERS.bob);

    await expect(requireRole(user, ["admin"], { allow: false })).resolves.toBeUndefined();
    await expect(
      requireRole(await userFor(USERS.root), ["admin"], { allow: false }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("names every role it asked for", async () => {
    await expect(requireRole(await userFor(USERS.bob), ["admin", "author"])).rejects.toMatchObject({
      required: ["admin", "author"],
    });
  });
});

describe("can()", () => {
  it("passes the call on when the user holds the permission", async () => {
    const rbacUser = await userFor(USERS.alice);

    await expect(
      runMiddleware(can("createPost"), { context: { rbacUser } }),
    ).resolves.toBeDefined();
  });

  it("throws the guard's error when they do not", async () => {
    const rbacUser = await userFor(USERS.bob);

    await expect(
      runMiddleware(can("createPost"), { context: { rbacUser } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("derives rule params from the call's data", async () => {
    const rbacUser = await userFor(USERS.alice);
    const guard = can("updatePost", {
      params: ({ data }) => ({ post: (data as { post: Post }).post }),
    });

    await expect(
      runMiddleware(guard, { context: { rbacUser }, data: { post: OWN_POST } }),
    ).resolves.toBeDefined();
    await expect(
      runMiddleware(guard, { context: { rbacUser }, data: { post: OTHER_POST } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("takes a fixed params object too", async () => {
    const rbacUser = await userFor(USERS.alice);

    await expect(
      runMiddleware(can("updatePost", { params: { post: OWN_POST } }), { context: { rbacUser } }),
    ).resolves.toBeDefined();
  });

  it("says so when rbacMiddleware is missing, instead of refusing everyone", async () => {
    await expect(runMiddleware(can("createPost"))).rejects.toThrow(/rbacMiddleware/);
  });
});

describe("access()", () => {
  it("lets a matching role through and refuses the rest", async () => {
    await expect(
      runMiddleware(access(["admin"]), { context: { rbacUser: await userFor(USERS.root) } }),
    ).resolves.toBeDefined();
    await expect(
      runMiddleware(access(["admin"]), { context: { rbacUser: await userFor(USERS.alice) } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses a guest with 401", async () => {
    await expect(
      runMiddleware(access(["admin"]), { context: { rbacUser: await userFor(null) } }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
