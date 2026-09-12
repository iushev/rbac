import { describe, expect, it } from "vitest";

import { accessCheckerFor, buildAccessChecker, rbacUserFor } from "./accessChecker.js";
import { toSessionState } from "./session.js";
import { buildBlogRbac, type Post } from "./testing/blog.js";
import { USERS } from "./testing/users.js";
import type { RbacSessionState } from "./types.js";

const OWN_POST: Post = { id: 1, authorId: "alice" };
const OTHER_POST: Post = { id: 2, authorId: "bob" };

async function sessionFor(username: keyof typeof USERS | null): Promise<{
  session: RbacSessionState;
  rules: Awaited<ReturnType<typeof buildBlogRbac>>["rules"];
}> {
  const { store, rules } = await buildBlogRbac();
  return { session: await toSessionState(store, username && USERS[username]), rules };
}

describe("buildAccessChecker", () => {
  it("answers like the server, from a snapshot plus the user's assignments", async () => {
    const { session, rules } = await sessionFor("alice");

    const checker = await buildAccessChecker(session, { rules });

    await expect(checker.checkAccess({ username: "alice", itemName: "createPost" })).resolves.toBe(
      true,
    );
    await expect(checker.checkAccess({ username: "alice", itemName: "viewPost" })).resolves.toBe(
      true,
    );
  });

  it("runs the rules, which is why the registry has to be the same one", async () => {
    const { session, rules } = await sessionFor("alice");

    const checker = await buildAccessChecker(session, { rules });

    await expect(
      checker.checkAccess({
        username: "alice",
        itemName: "updatePost",
        params: { post: OWN_POST },
      }),
    ).resolves.toBe(true);
    await expect(
      checker.checkAccess({
        username: "alice",
        itemName: "updatePost",
        params: { post: OTHER_POST },
      }),
    ).resolves.toBe(false);
  });

  it("knows nothing about users the session did not name", async () => {
    const { session, rules } = await sessionFor("alice");

    const checker = await buildAccessChecker(session, { rules });

    await expect(checker.checkAccess({ username: "root", itemName: "updatePost" })).resolves.toBe(
      false,
    );
  });

  it("gives a guest a checker that answers no", async () => {
    const { session, rules } = await sessionFor(null);

    const checker = await buildAccessChecker(session, { rules });

    await expect(checker.checkAccess({ username: "guest", itemName: "viewPost" })).resolves.toBe(
      false,
    );
  });
});

describe("accessCheckerFor", () => {
  it("builds one checker per session object", async () => {
    const { session, rules } = await sessionFor("alice");

    expect(accessCheckerFor(session, { rules })).toBe(accessCheckerFor(session, { rules }));
  });

  it("builds a new one for a new session, which is how a changed assignment lands", async () => {
    const { session: first, rules } = await sessionFor("bob");
    const { session: second } = await sessionFor("root");

    expect(await accessCheckerFor(first, { rules })).not.toBe(
      await accessCheckerFor(second, { rules }),
    );
    await expect(
      (await accessCheckerFor(second, { rules })).checkAccess({
        username: "root",
        itemName: "updatePost",
      }),
    ).resolves.toBe(true);
  });
});

describe("rbacUserFor", () => {
  it("binds the session's identity to its checker", async () => {
    const { session, rules } = await sessionFor("alice");

    const user = await rbacUserFor(session, { rules });

    expect(user.username).toBe("alice");
    await expect(user.can({ permissionName: "createPost" })).resolves.toBe(true);
    await expect(
      user.can({ permissionName: "updatePost", params: { post: OTHER_POST } }),
    ).resolves.toBe(false);
  });

  it("is a guest when the session has no user", async () => {
    const { session, rules } = await sessionFor(null);

    const user = await rbacUserFor(session, { rules });

    expect(user.isGuest).toBe(true);
    await expect(user.can({ permissionName: "viewPost" })).resolves.toBe(false);
  });

  it("is the same user for the same session, so the access cache is shared", async () => {
    const { session, rules } = await sessionFor("root");

    expect(await rbacUserFor(session, { rules })).toBe(await rbacUserFor(session, { rules }));
  });
});
