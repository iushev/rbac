import type { RbacIdentity } from "../types.js";

/** The same cast the `rbac-express` tests use, so the two read alike. */
export const USERS = {
  alice: { username: "alice", isActive: true, isSuperuser: false },
  bob: { username: "bob", isActive: true, isSuperuser: false },
  root: { username: "root", isActive: true, isSuperuser: false },
  su: { username: "su", isActive: true, isSuperuser: true },
  banned: { username: "banned", isActive: false, isSuperuser: false },
} satisfies Record<string, RbacIdentity>;
