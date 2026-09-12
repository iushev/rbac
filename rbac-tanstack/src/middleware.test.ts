import { describe, expect, it } from "vitest";

import { ForbiddenError } from "./errors.js";
import { can } from "./guards.js";
import { rbacMiddleware } from "./middleware.js";
import { buildBlogRbac } from "./testing/blog.js";
import { rbacUserOf, runMiddleware } from "./testing/middleware.js";
import { USERS } from "./testing/users.js";
import type { RbacIdentity } from "./types.js";

async function mount(identity: RbacIdentity | null, options: { setStatus?: boolean } = {}) {
  const { manager } = await buildBlogRbac();
  return rbacMiddleware({
    accessChecker: manager,
    getIdentity: () => identity,
    // `setResponseStatus` needs a request; nothing outside a running server has one.
    setStatus: options.setStatus ?? false,
  });
}

describe("rbacMiddleware", () => {
  it("puts a user bound to the identity in the context", async () => {
    const context = await runMiddleware(await mount(USERS.alice));

    expect(rbacUserOf(context).username).toBe("alice");
    expect(rbacUserOf(context).isGuest).toBe(false);
  });

  it("gives a guest a user too, so the guards can tell 401 from 403", async () => {
    const context = await runMiddleware(await mount(null));

    expect(rbacUserOf(context).isGuest).toBe(true);
    expect(rbacUserOf(context).username).toBe("guest");
  });

  it("answers questions against the graph it was handed", async () => {
    const context = await runMiddleware(await mount(USERS.alice));

    await expect(rbacUserOf(context).can({ permissionName: "createPost" })).resolves.toBe(true);
    await expect(rbacUserOf(context).can({ permissionName: "nope" })).resolves.toBe(false);
  });

  it("accepts a checker produced on demand", async () => {
    const { manager } = await buildBlogRbac();
    const middleware = rbacMiddleware({
      accessChecker: () => Promise.resolve(manager),
      getIdentity: () => Promise.resolve(USERS.root),
      setStatus: false,
    });

    const context = await runMiddleware(middleware);

    await expect(rbacUserOf(context).can({ permissionName: "updatePost" })).resolves.toBe(true);
  });

  it("grants nothing by itself — a server function without a guard stays open", async () => {
    const context = await runMiddleware(await mount(USERS.bob));

    expect(rbacUserOf(context).isGuest).toBe(false);
    await expect(rbacUserOf(context).can({ permissionName: "createPost" })).resolves.toBe(false);
  });

  it("lets a guard's refusal through untouched", async () => {
    const middleware = await mount(USERS.bob);
    const guard = can("createPost");

    await expect(
      runMiddleware(middleware).then((context) => runMiddleware(guard, { context })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
