import type { Post } from "../shared/api.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    /**
     * `rbac-express` leaves this interface empty on purpose; the application
     * fills it with the fields of its own user, and `req.rbacUser.identity` is
     * typed with them everywhere.
     */
    interface RbacIdentity {
      displayName: string;
    }

    interface Request {
      /** Set by `loadPost` before the guard that needs the post as a rule param. */
      post?: Post;
    }
  }
}

export {};
