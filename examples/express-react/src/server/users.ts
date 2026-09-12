import { randomUUID } from "node:crypto";

import type { SessionUser } from "../shared/api.js";

/**
 * The demo's user table. Authentication is deliberately trivial — a username
 * and no password — because it is not what the example is about: the only thing
 * that matters is that `getIdentity` in the middleware ends up with one of these.
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

/** token -> username; a Map instead of a real session store, for the same reason. */
const sessions = new Map<string, string>();

export function createSession(username: string): string {
  const token = randomUUID();
  sessions.set(token, username);
  return token;
}

export function userByToken(token: string | null): SessionUser | null {
  if (token === null) {
    return null;
  }
  const username = sessions.get(token);
  return username === undefined ? null : findUser(username);
}

export function destroySession(token: string | null): void {
  if (token !== null) {
    sessions.delete(token);
  }
}
