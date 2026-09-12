import { toSnapshot } from "@iushev/rbac";
import { describe, expect, it } from "vitest";

import { ForbiddenError, UnauthorizedError } from "./errors.js";
import {
  rbacErrorSerializationAdapter,
  rbacSerializationAdapters,
  rbacSnapshotSerializationAdapter,
} from "./serialization.js";
import { buildBlogRbac } from "./testing/blog.js";

describe("rbacErrorSerializationAdapter", () => {
  it("keeps the status and the required items across the wire", () => {
    const error = new ForbiddenError(["updatePost", "deletePost"], "not allowed");

    const wire = rbacErrorSerializationAdapter.toSerializable(error);
    const revived = rbacErrorSerializationAdapter.fromSerializable(wire);

    expect(revived).toBeInstanceOf(ForbiddenError);
    expect(revived.status).toBe(403);
    expect(revived.message).toBe("not allowed");
    expect(revived.required).toEqual(["updatePost", "deletePost"]);
  });

  it("keeps a guest's refusal a 401", () => {
    const wire = rbacErrorSerializationAdapter.toSerializable(new UnauthorizedError(["viewPost"]));

    expect(rbacErrorSerializationAdapter.fromSerializable(wire)).toBeInstanceOf(UnauthorizedError);
  });

  it("claims its own errors only", () => {
    expect(rbacErrorSerializationAdapter.test(new ForbiddenError())).toBe(true);
    expect(rbacErrorSerializationAdapter.test(new Error("plain"))).toBe(false);
  });
});

describe("rbacSnapshotSerializationAdapter", () => {
  it("round-trips the graph", async () => {
    const { store } = await buildBlogRbac();
    const snapshot = await toSnapshot(store);

    const wire = rbacSnapshotSerializationAdapter.toSerializable(snapshot);
    const revived = rbacSnapshotSerializationAdapter.fromSerializable(wire);

    expect(revived).toEqual(snapshot);
  });

  it("recognises a snapshot by its three arrays, and not other objects", async () => {
    const { store } = await buildBlogRbac();

    expect(rbacSnapshotSerializationAdapter.test(await toSnapshot(store))).toBe(true);
    expect(rbacSnapshotSerializationAdapter.test({ items: [], children: [] })).toBe(false);
    expect(rbacSnapshotSerializationAdapter.test(null)).toBe(false);
    expect(rbacSnapshotSerializationAdapter.test("items")).toBe(false);
  });
});

describe("rbacSerializationAdapters", () => {
  it("is the pair, with keys that will not collide with an application's own", () => {
    expect(rbacSerializationAdapters).toHaveLength(2);
    expect(rbacSerializationAdapters.map((adapter) => adapter.key)).toEqual([
      "rbac:RbacHttpError",
      "rbac:RbacSnapshot",
    ]);
  });
});
