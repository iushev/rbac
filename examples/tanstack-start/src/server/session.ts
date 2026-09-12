import "@tanstack/react-start/server-only";

import { randomUUID } from "node:crypto";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import type { SessionUser } from "../types.js";
import { findUser } from "./users.js";

const COOKIE = "rbac-demo-session";

/** token -> username; a Map instead of a real session store, for the same reason. */
const sessions = new Map<string, string>();

/**
 * The single point where authentication meets authorization: the guard
 * middleware calls this for every server function and `rbac` never learns
 * anything else about how the user was identified. Swap the body for a real
 * session, a JWT or an OAuth provider and nothing below it changes.
 */
export function getIdentity(): SessionUser | null {
  const token = getCookie(COOKIE);
  if (token === undefined) {
    return null;
  }
  const username = sessions.get(token);
  return username === undefined ? null : findUser(username);
}

export function startSession(username: string): void {
  const token = randomUUID();
  sessions.set(token, username);
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export function endSession(): void {
  const token = getCookie(COOKIE);
  if (token !== undefined) {
    sessions.delete(token);
  }
  deleteCookie(COOKIE, { path: "/" });
}
