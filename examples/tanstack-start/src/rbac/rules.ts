import { RuleRegistry, type RuleParams } from "@iushev/rbac";

/**
 * Rules are code, not data: the store keeps only a rule's name, so every side
 * that runs a check has to register the implementations itself. In this app
 * both sides are the same bundle, but not the same environment — the server
 * functions run in Node and the components run in the browser — which is why
 * this module is imported by both and owned by neither.
 */

/** What the `isAuthor` rule needs from the resource it is asked about. */
export interface AuthoredResource {
  authorId: string;
}

function readPost(params: RuleParams): AuthoredResource | null {
  const post: unknown = params.post;
  if (typeof post !== "object" || post === null) {
    return null;
  }
  const authorId: unknown = (post as { authorId?: unknown }).authorId;
  return typeof authorId === "string" ? { authorId } : null;
}

/**
 * The rule behind `updateOwnPost` / `deleteOwnPost`.
 *
 * Without a `post` param there is nothing to compare against, so the answer is
 * "no" — a parameterless check must not accidentally grant every post.
 */
export function isAuthor({ username, params }: { username: string; params: RuleParams }): boolean {
  const post = readPost(params);
  return post !== null && post.authorId === username;
}

/**
 * The one registry of the application.
 *
 * A module-level constant on purpose: `<RbacSession>` reads it when it first
 * builds the checker for a session, and a registry rebuilt on every render
 * would be a new object each time for no gain.
 */
export const rules = new RuleRegistry({
  isAuthor: ({ username, params }) => isAuthor({ username, params }),
});

/** Items every user holds without an assignment. Guests included, so: none. */
export const DEFAULT_ROLES: string[] = [];
