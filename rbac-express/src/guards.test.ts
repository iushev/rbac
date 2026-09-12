import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { access, can } from "./guards.js";
import { ForbiddenError } from "./errors.js";
import type { OnDenied } from "./types.js";
import { buildBlogRbac, type Post } from "./testing/blog.js";
import { buildApp } from "./testing/app.js";

interface ErrorBody {
  error: string;
  required?: string[];
}

/** supertest types `res.body` as `any`; every error response here has this shape. */
function errorBody(res: { body: unknown }): ErrorBody {
  return res.body as ErrorBody;
}

const ALICE_POST: Post = { id: 1, authorId: "alice" };
const BOB_POST: Post = { id: 2, authorId: "bob" };

describe("can", () => {
  it("lets a user through a permission held via the role hierarchy", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [can("viewPost")] });

    const res = await request(app).get("/resource").set("x-user", "bob");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, username: "bob" });
  });

  it("answers 403 when the user lacks the permission", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [can("createPost")] });

    const res = await request(app).get("/resource").set("x-user", "bob");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Access denied.", required: ["createPost"] });
  });

  it("answers 401 for a guest, since an identity may well change the outcome", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [can("viewPost")] });

    const res = await request(app).get("/resource");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Authentication required.", required: ["viewPost"] });
  });

  it("grants a superuser without consulting the store", async () => {
    const { manager } = await buildBlogRbac();
    const spy = vi.spyOn(manager, "checkAccess");
    const app = buildApp({ accessChecker: manager, guards: [can("createPost")] });

    const res = await request(app).get("/resource").set("x-user", "su");

    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });

  it("denies an inactive user everything they would otherwise hold", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [can("createPost")] });

    const res = await request(app).get("/resource").set("x-user", "banned");

    expect(res.status).toBe(403);
  });

  it("reaches the rule with params derived from the request", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [can("updatePost", { params: () => ({ post: ALICE_POST }) })],
    });

    const res = await request(app).get("/resource").set("x-user", "alice");

    expect(res.status).toBe(200);
  });

  it("lets the rule refuse a resource the user does not own", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [can("updatePost", { params: { post: BOB_POST } })],
    });

    const res = await request(app).get("/resource").set("x-user", "alice");

    expect(res.status).toBe(403);
  });

  it("lets an admin through the unruled permission for another user's post", async () => {
    // root holds updatePost directly, so isAuthor never decides the request.
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [can("updatePost", { params: { post: ALICE_POST } })],
    });

    const res = await request(app).get("/resource").set("x-user", "root");

    expect(res.status).toBe(200);
  });

  it("applies the rule when the guard names the guarded permission itself", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [can("updateOwnPost", { params: { post: ALICE_POST } })],
    });

    await expect(
      request(app)
        .get("/resource")
        .set("x-user", "alice")
        .then((r) => r.status),
    ).resolves.toBe(200);
    // Even an admin has to own the post to hold updateOwnPost.
    await expect(
      request(app)
        .get("/resource")
        .set("x-user", "root")
        .then((r) => r.status),
    ).resolves.toBe(403);
  });

  it("awaits an async params resolver", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [can("updatePost", { params: () => Promise.resolve({ post: ALICE_POST }) })],
    });

    const res = await request(app).get("/resource").set("x-user", "alice");

    expect(res.status).toBe(200);
  });

  it("forwards a rejected params resolver to the error handler", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [
        can("updatePost", {
          params: () => Promise.reject(new Error("post lookup failed")),
        }),
      ],
    });

    const res = await request(app).get("/resource").set("x-user", "alice");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "post lookup failed" });
  });

  it("forwards an unknown rule to the error handler rather than denying", async () => {
    const { manager } = await buildBlogRbac();
    manager.rules.unregister("isAuthor");
    const app = buildApp({
      accessChecker: manager,
      guards: [can("updatePost", { params: { post: ALICE_POST } })],
    });

    const res = await request(app).get("/resource").set("x-user", "alice");

    expect(res.status).toBe(500);
    expect(errorBody(res).error).toContain("isAuthor");
  });

  it("explains itself when rbacMiddleware was never mounted", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [can("viewPost")],
      withoutMiddleware: true,
    });

    const res = await request(app).get("/resource").set("x-user", "bob");

    expect(res.status).toBe(500);
    expect(errorBody(res).error).toContain("rbacMiddleware");
  });
});

describe("access", () => {
  it("matches a role held through the hierarchy", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [access(["reader"])] });

    const res = await request(app).get("/resource").set("x-user", "root");

    expect(res.status).toBe(200);
  });

  it("passes when any one of several names matches", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [access(["admin", "author"])] });

    const res = await request(app).get("/resource").set("x-user", "alice");

    expect(res.status).toBe(200);
  });

  it("reports every required name on refusal", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [access(["admin", "author"])] });

    const res = await request(app).get("/resource").set("x-user", "bob");

    expect(res.status).toBe(403);
    expect(errorBody(res).required).toEqual(["admin", "author"]);
  });

  it("matches a guest on '?' and refuses an authenticated user", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [access(["?"])] });

    await expect(
      request(app)
        .get("/resource")
        .then((r) => r.status),
    ).resolves.toBe(200);
    await expect(
      request(app)
        .get("/resource")
        .set("x-user", "bob")
        .then((r) => r.status),
    ).resolves.toBe(403);
  });

  it("matches any authenticated user on '@'", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [access(["@"])] });

    await expect(
      request(app)
        .get("/resource")
        .set("x-user", "bob")
        .then((r) => r.status),
    ).resolves.toBe(200);
    await expect(
      request(app)
        .get("/resource")
        .then((r) => r.status),
    ).resolves.toBe(401);
  });

  it("matches everyone when the list is empty", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({ accessChecker: manager, guards: [access([])] });

    const res = await request(app).get("/resource");

    expect(res.status).toBe(200);
  });

  it("turns the list into a deny list with allow: false", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [access(["reader"], { allow: false })],
    });

    await expect(
      request(app)
        .get("/resource")
        .set("x-user", "bob")
        .then((r) => r.status),
    ).resolves.toBe(403);
    await expect(
      request(app)
        .get("/resource")
        .then((r) => r.status),
    ).resolves.toBe(200);
  });

  it("refuses a superuser on a deny list, since a superuser holds every item", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [access(["reader"], { allow: false })],
    });

    const res = await request(app).get("/resource").set("x-user", "su");

    expect(res.status).toBe(403);
  });

  it("is unaffected by a later mutation of the caller's array", async () => {
    const { manager } = await buildBlogRbac();
    const roles = ["admin"];
    const app = buildApp({ accessChecker: manager, guards: [access(roles)] });
    roles.push("reader");

    const res = await request(app).get("/resource").set("x-user", "bob");

    expect(res.status).toBe(403);
  });
});

describe("guard chaining", () => {
  it("requires every guard in the chain to pass", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildApp({
      accessChecker: manager,
      guards: [access(["@"]), can("createPost")],
    });

    await expect(
      request(app)
        .get("/resource")
        .set("x-user", "alice")
        .then((r) => r.status),
    ).resolves.toBe(200);
    await expect(
      request(app)
        .get("/resource")
        .set("x-user", "bob")
        .then((r) => r.status),
    ).resolves.toBe(403);
  });
});

describe("onDenied", () => {
  it("replaces the default response", async () => {
    const { manager } = await buildBlogRbac();
    const onDenied: OnDenied = (context, res) => {
      res.status(302).location(`/login?next=${context.req.path}`).end();
    };
    const app = buildApp({ accessChecker: manager, guards: [can("createPost", { onDenied })] });

    const res = await request(app).get("/resource").set("x-user", "bob");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login?next=/resource");
  });

  it("receives the user, the required names, the params and the default error", async () => {
    const { manager } = await buildBlogRbac();
    const onDenied = vi.fn<OnDenied>((_context, res) => {
      res.status(418).end();
    });
    const app = buildApp({
      accessChecker: manager,
      guards: [can("updatePost", { params: { post: BOB_POST }, onDenied })],
    });

    await request(app).get("/resource").set("x-user", "alice");

    expect(onDenied).toHaveBeenCalledOnce();
    const context = onDenied.mock.calls[0]![0];
    expect(context.user.username).toBe("alice");
    expect(context.required).toEqual(["updatePost"]);
    expect(context.params).toEqual({ post: BOB_POST });
    expect(context.error).toBeInstanceOf(ForbiddenError);
  });

  it("forwards its own rejection to the error handler", async () => {
    const { manager } = await buildBlogRbac();
    const onDenied: OnDenied = () => Promise.reject(new Error("denial handler failed"));
    const app = buildApp({ accessChecker: manager, guards: [can("createPost", { onDenied })] });

    const res = await request(app).get("/resource").set("x-user", "bob");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "denial handler failed" });
  });

  it("is not called when the guard passes", async () => {
    const { manager } = await buildBlogRbac();
    const onDenied = vi.fn<OnDenied>();
    const app = buildApp({ accessChecker: manager, guards: [can("viewPost", { onDenied })] });

    await request(app).get("/resource").set("x-user", "bob");

    expect(onDenied).not.toHaveBeenCalled();
  });
});
