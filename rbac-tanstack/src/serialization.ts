import { createSerializationAdapter } from "@tanstack/react-router";
import type { RbacSnapshot } from "@iushev/rbac";

import { isRbacHttpError, reviveRbacHttpError, type RbacHttpError } from "./errors.js";

/**
 * What a guard threw, on its way back to the browser.
 *
 * Start serializes an error it does not know about down to a bare `Error` —
 * message only — which would flatten 401 and 403 into "something broke"
 * exactly where the difference matters. With this adapter the status and the
 * item names the guard asked for arrive intact, and `instanceof
 * ForbiddenError` holds on both sides.
 */
export const rbacErrorSerializationAdapter = createSerializationAdapter({
  key: "rbac:RbacHttpError",
  test: isRbacHttpError,
  toSerializable: ({ status, message, required }: RbacHttpError) => ({
    status,
    message,
    required: [...required],
  }),
  fromSerializable: reviveRbacHttpError,
});

function isRbacSnapshot(value: unknown): value is RbacSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { items, children, rules } = value as Partial<RbacSnapshot>;
  return Array.isArray(items) && Array.isArray(children) && Array.isArray(rules);
}

/**
 * The graph on its way to the browser, as the JSON the core already promises
 * it to be.
 *
 * Start type-checks that everything crossing the wire is serializable, and
 * `Rule.data` is `unknown` — JSON by convention, since rules are built to
 * survive `JSON.stringify`, but not something a type can prove. Declaring it
 * once here beats turning the check off at every boundary a snapshot passes.
 */
export const rbacSnapshotSerializationAdapter = createSerializationAdapter({
  key: "rbac:RbacSnapshot",
  test: isRbacSnapshot,
  toSerializable: (snapshot: RbacSnapshot) => JSON.stringify(snapshot),
  fromSerializable: (json: string) => JSON.parse(json) as RbacSnapshot,
});

/**
 * Both adapters, for `createStart`:
 *
 * ```ts
 * export const startInstance = createStart(() => ({
 *   serializationAdapters: [...rbacSerializationAdapters],
 * }));
 * ```
 */
export const rbacSerializationAdapters = [
  rbacErrorSerializationAdapter,
  rbacSnapshotSerializationAdapter,
] as const;
