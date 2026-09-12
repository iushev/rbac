import { RuleRegistry, type RuleParams } from "@iushev/rbac";

/**
 * Rules are code, not data: the store keeps only a rule's name, so both the
 * server and the browser have to register the implementations themselves. This
 * module is imported by each side, which is what makes the answer to
 * "may I edit this post?" the same in the UI and behind the guard.
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

/** The registry both sides build at startup. */
export function createRuleRegistry(): RuleRegistry {
  return new RuleRegistry({
    isAuthor: ({ username, params }) => isAuthor({ username, params }),
  });
}

/** Items every user holds without an assignment. Guests included, so: none. */
export const DEFAULT_ROLES: string[] = [];
