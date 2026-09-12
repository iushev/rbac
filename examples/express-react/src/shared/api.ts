import type { Identity } from "@iushev/rbac";

/** The identity the server hands out and the UI runs its checks as. */
export interface SessionUser extends Identity {
  displayName: string;
}

export interface Post {
  id: number;
  title: string;
  body: string;
  /** The username of the author — what the `isAuthor` rule compares against. */
  authorId: string;
  createdAt: string;
}

export interface PostInput {
  title: string;
  body: string;
}

/** `GET /api/session` — who the caller is and what is assigned to them. */
export interface SessionResponse {
  user: SessionUser | null;
  /** Direct assignments of this user; the UI replays them into its own store. */
  assignments: string[];
}

/** `POST /api/session` — the demo signs in with a username and no password. */
export interface LoginRequest {
  username: string;
}

export interface LoginResponse extends SessionResponse {
  token: string;
}

/** The JSON shape of every failed request, including the guards' 401 / 403. */
export interface ApiErrorBody {
  status: number;
  error: string;
  /** The item names a guard asked for, when the failure came from one. */
  required?: string[];
}
