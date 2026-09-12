import { createServerFn } from "@tanstack/react-start";
import { UnauthorizedError, toSessionState } from "@iushev/rbac-tanstack";

import { getRbac } from "../server/graph.js";
import { rbac } from "../server/rbac.js";
import { endSession, startSession } from "../server/session.js";
import { findUser } from "../server/users.js";
import type { SessionUser } from "../types.js";

async function sessionState(user: SessionUser | null) {
  const { store } = await getRbac();
  // The graph without the assignments, plus this user's own: enough for the
  // browser to answer `can()` locally instead of asking once per button.
  return toSessionState(store, user);
}

/**
 * Everything the browser needs to run its own checks. Unguarded on purpose:
 * the graph is not a secret, and a guest has to be able to load the page that
 * tells them they are a guest.
 */
export const getSessionState = createServerFn({ method: "GET" })
  .middleware([rbac])
  .handler(({ context }) => sessionState(context.rbacUser.identity));

export const login = createServerFn({ method: "POST" })
  .validator((username: string) => username)
  .handler(({ data: username }) => {
    const user = findUser(username);
    if (user === null) {
      throw new UnauthorizedError([], `No user "${username}".`);
    }
    // An inactive user is allowed to sign in; `rbac` is what denies them
    // everything afterwards, which is the point of the "banned" demo user.
    startSession(user.username);
    return sessionState(user);
  });

export const logout = createServerFn({ method: "POST" }).handler(() => {
  endSession();
  return sessionState(null);
});
