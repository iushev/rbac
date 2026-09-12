import type { Identity } from "@iushev/rbac";
import type { RbacSessionState } from "@iushev/rbac-tanstack";

/** The identity the server hands out and the UI runs its checks as. */
export interface SessionUser extends Identity {
  displayName: string;
}

/*
 * The same fields, declared for both sides: `rbac-tanstack` types
 * `context.rbacUser.identity` in a server function, `rbac-react` types
 * `useRbacUser().identity` in a component. One user, so one set of fields.
 */
declare module "@iushev/rbac-tanstack" {
  interface RbacIdentity {
    displayName: string;
  }
}

declare module "@iushev/rbac-react" {
  interface RbacIdentity {
    displayName: string;
  }
}

/** What the root route loads: the graph, the identity and its assignments. */
export type SessionState = RbacSessionState;

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
