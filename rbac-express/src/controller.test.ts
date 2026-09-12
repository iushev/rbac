import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Assignment, Item, Rule } from "@iushev/rbac";

import { access } from "./guards.js";
import { buildBlogRbac } from "./testing/blog.js";
import { buildControllerApp } from "./testing/app.js";

/** supertest types `res.body` as `any`; each test knows the shape it asked for. */
function body<T>(res: { body: unknown }): T {
  return res.body as T;
}

function names(res: { body: unknown }): string[] {
  return body<Item[]>(res).map((item) => item.name);
}

async function buildBlogApp() {
  const rbac = await buildBlogRbac();
  return { ...rbac, app: buildControllerApp({ manager: rbac.manager }) };
}

describe("roles and permissions", () => {
  it("lists the two item types separately", async () => {
    const { app } = await buildBlogApp();

    expect(names(await request(app).get("/rbac/roles"))).toEqual(["reader", "author", "admin"]);
    expect(names(await request(app).get("/rbac/permissions"))).toEqual([
      "viewPost",
      "createPost",
      "updatePost",
      "updateOwnPost",
    ]);
  });

  it("creates a role and hands it back", async () => {
    const { app, manager } = await buildBlogApp();

    const res = await request(app)
      .post("/rbac/roles")
      .send({ name: "editor", description: "Edits posts", data: "rank=2" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      type: "role",
      name: "editor",
      description: "Edits posts",
      ruleName: null,
      data: "rank=2",
    });
    expect(await manager.getRole("editor")).not.toBeNull();
  });

  it("answers 409 for a name already taken by an item of the other type", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app).post("/rbac/permissions").send({ name: "author" });

    expect(res.status).toBe(409);
    expect(body<{ error: string }>(res).error).toBe('Item "author" already exists.');
  });

  it("answers 400 for a body without a name", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app).post("/rbac/roles").send({ description: "no name" });

    expect(res.status).toBe(400);
  });

  it("answers 400 for an item payload that is not a string", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app)
      .post("/rbac/roles")
      .send({ name: "editor", data: { rank: 2 } });

    expect(res.status).toBe(400);
    expect(body<{ error: string }>(res).error).toBe('"data" must be a string or null.');
  });

  it("looks an item up only under its own type", async () => {
    const { app } = await buildBlogApp();

    expect((await request(app).get("/rbac/roles/reader")).status).toBe(200);
    expect((await request(app).get("/rbac/permissions/reader")).status).toBe(404);
  });

  it("renames through PUT, and the assignments follow", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app).put("/rbac/roles/reader").send({ name: "subscriber" });

    expect(res.status).toBe(200);
    expect((await request(app).get("/rbac/roles/reader")).status).toBe(404);
    expect(body<Assignment[]>(await request(app).get("/rbac/assignments/bob"))[0]?.itemName).toBe(
      "subscriber",
    );
  });

  it("keeps the stored name when PUT omits it", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app).put("/rbac/roles/reader").send({ description: "Reads posts" });

    expect(res.status).toBe(200);
    expect(body<Item>(res)).toMatchObject({ name: "reader", description: "Reads posts" });
  });

  it("removes an item", async () => {
    const { app } = await buildBlogApp();

    expect((await request(app).delete("/rbac/roles/admin")).status).toBe(204);
    expect((await request(app).get("/rbac/roles/admin")).status).toBe(404);
  });

  it("empties one type at a time", async () => {
    const { app } = await buildBlogApp();

    expect((await request(app).delete("/rbac/roles")).status).toBe(204);
    expect(names(await request(app).get("/rbac/roles"))).toEqual([]);
    expect(names(await request(app).get("/rbac/permissions"))).toHaveLength(4);
  });
});

describe("rules", () => {
  it("lists the rules, the placeholder of the fixture included", async () => {
    const { app } = await buildBlogApp();

    expect(body<Rule[]>(await request(app).get("/rbac/rules"))).toEqual([
      { name: "isAuthor", data: null },
    ]);
  });

  it("creates, updates and removes a rule", async () => {
    const { app } = await buildBlogApp();

    const created = await request(app).post("/rbac/rules").send({ name: "isOwner", data: "v=1" });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ name: "isOwner", data: "v=1" });

    const updated = await request(app).put("/rbac/rules/isOwner").send({ data: "v=2" });
    expect(updated.body).toEqual({ name: "isOwner", data: "v=2" });

    expect((await request(app).delete("/rbac/rules/isOwner")).status).toBe(204);
    expect((await request(app).get("/rbac/rules/isOwner")).status).toBe(404);
  });

  it("answers 400 for a rule payload that is not a string", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app)
      .post("/rbac/rules")
      .send({ name: "isOwner", data: { v: 1 } });

    expect(res.status).toBe(400);
    expect(body<{ error: string }>(res).error).toBe('"data" must be a string or null.');
  });

  it("auto-creates the placeholder rule an item names, as the core does", async () => {
    const { app } = await buildBlogApp();

    await request(app).post("/rbac/permissions").send({ name: "deletePost", ruleName: "isOwner" });

    expect(body<Rule[]>(await request(app).get("/rbac/rules")).map((rule) => rule.name)).toEqual([
      "isAuthor",
      "isOwner",
    ]);
  });
});

describe("hierarchy", () => {
  it("lists and adds children", async () => {
    const { app } = await buildBlogApp();

    expect(names(await request(app).get("/rbac/items/reader/children"))).toEqual(["viewPost"]);

    const res = await request(app).post("/rbac/items/reader/children").send({ name: "createPost" });

    expect(res.status).toBe(204);
    expect(names(await request(app).get("/rbac/items/reader/children"))).toEqual([
      "viewPost",
      "createPost",
    ]);
  });

  it("answers 400 for an edge the core refuses instead of throwing a 500", async () => {
    const { app } = await buildBlogApp();

    const loop = await request(app).post("/rbac/items/viewPost/children").send({ name: "admin" });
    expect(loop.status).toBe(400);

    const self = await request(app).post("/rbac/items/author/children").send({ name: "author" });
    expect(self.status).toBe(400);
  });

  it("answers 409 for an edge that is already there", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app).post("/rbac/items/reader/children").send({ name: "viewPost" });

    expect(res.status).toBe(409);
  });

  it("answers 404 for an unknown item on either side", async () => {
    const { app } = await buildBlogApp();

    expect((await request(app).get("/rbac/items/ghost/children")).status).toBe(404);
    expect(
      (await request(app).post("/rbac/items/reader/children").send({ name: "ghost" })).status,
    ).toBe(404);
  });

  it("removes one edge and all of them", async () => {
    const { app } = await buildBlogApp();

    expect((await request(app).delete("/rbac/items/reader/children/viewPost")).status).toBe(204);
    expect(names(await request(app).get("/rbac/items/reader/children"))).toEqual([]);

    expect((await request(app).delete("/rbac/items/author/children")).status).toBe(204);
    expect(names(await request(app).get("/rbac/items/author/children"))).toEqual([]);
  });
});

describe("assignments", () => {
  it("assigns a role, and the access check sees it right away", async () => {
    const { app, manager } = await buildBlogApp();

    expect(await manager.checkAccess({ username: "bob", itemName: "createPost" })).toBe(false);

    const res = await request(app).post("/rbac/assignments/bob").send({ name: "author" });

    expect(res.status).toBe(201);
    expect(body<Assignment>(res)).toMatchObject({ username: "bob", itemName: "author" });
    expect(await manager.checkAccess({ username: "bob", itemName: "createPost" })).toBe(true);
  });

  it("lists, revokes one and revokes all", async () => {
    const { app } = await buildBlogApp();
    await request(app).post("/rbac/assignments/alice").send({ name: "admin" });

    expect(
      body<Assignment[]>(await request(app).get("/rbac/assignments/alice")).map((a) => a.itemName),
    ).toEqual(["author", "admin"]);

    expect((await request(app).delete("/rbac/assignments/alice/admin")).status).toBe(204);
    expect(body<Assignment[]>(await request(app).get("/rbac/assignments/alice"))).toHaveLength(1);

    expect((await request(app).delete("/rbac/assignments/alice")).status).toBe(204);
    expect(body<Assignment[]>(await request(app).get("/rbac/assignments/alice"))).toEqual([]);
  });

  it("answers 404 when the assigned item does not exist", async () => {
    const { app } = await buildBlogApp();

    expect((await request(app).post("/rbac/assignments/bob").send({ name: "ghost" })).status).toBe(
      404,
    );
  });

  it("lists the users of a role", async () => {
    const { app } = await buildBlogApp();

    const res = await request(app).get("/rbac/roles/author/users");

    expect(res.status).toBe(200);
    expect(body<string[]>(res)).toEqual(["alice", "banned"]);
  });
});

describe("bulk", () => {
  it("wipes every kind of authorization data", async () => {
    const { app } = await buildBlogApp();

    expect((await request(app).delete("/rbac")).status).toBe(204);

    expect(names(await request(app).get("/rbac/items"))).toEqual([]);
    expect(body<Rule[]>(await request(app).get("/rbac/rules"))).toEqual([]);
    expect(body<Assignment[]>(await request(app).get("/rbac/assignments/alice"))).toEqual([]);
  });
});

describe("guards", () => {
  it("protects every route with the handlers it is given", async () => {
    const { manager } = await buildBlogRbac();
    const app = buildControllerApp({ manager, guards: [access(["admin"])] });

    expect((await request(app).get("/rbac/roles")).status).toBe(401);
    expect((await request(app).get("/rbac/roles").set("x-user", "bob")).status).toBe(403);
    expect((await request(app).get("/rbac/roles").set("x-user", "root")).status).toBe(200);
    expect(
      (await request(app).post("/rbac/roles").set("x-user", "bob").send({ name: "editor" })).status,
    ).toBe(403);
  });
});
