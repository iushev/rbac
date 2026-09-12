import "@tanstack/react-start/server-only";

import type { SessionUser } from "../types.js";

/**
 * The demo's user table. Authentication is deliberately trivial — a username
 * and no password — because it is not what the example is about: the only
 * thing that matters is which identity the guard middleware ends up with.
 *
 * `isActive` and `isSuperuser` are read by `rbac` itself: a superuser passes
 * every check without the store being touched, an inactive user fails all of them.
 */
export const USERS: Record<string, SessionUser> = {
  alice: { username: "alice", displayName: "Alice (author)", isActive: true, isSuperuser: false },
  bob: { username: "bob", displayName: "Bob (reader)", isActive: true, isSuperuser: false },
  root: { username: "root", displayName: "Root (admin)", isActive: true, isSuperuser: false },
  su: { username: "su", displayName: "Su (superuser)", isActive: true, isSuperuser: true },
  banned: {
    username: "banned",
    displayName: "Banned (author, inactive)",
    isActive: false,
    isSuperuser: false,
  },
};

export function findUser(username: string): SessionUser | null {
  return USERS[username] ?? null;
}
