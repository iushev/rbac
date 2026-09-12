import { Router } from "express";
import { toSnapshot, type RbacManager, type RbacStore } from "@iushev/rbac";
import { BadRequestError, UnauthorizedError } from "@iushev/rbac-express";

import type { SessionResponse, SessionUser } from "../../shared/api.js";
import { route } from "../route.js";
import { tokenFromRequest } from "../auth.js";
import { createSession, destroySession, findUser } from "../users.js";

async function sessionResponse(
  manager: RbacManager,
  user: SessionUser | null,
): Promise<SessionResponse> {
  if (user === null) {
    return { user: null, assignments: [] };
  }
  const assignments = await manager.getAssignments(user.username);
  return { user, assignments: [...assignments.keys()] };
}

function readUsername(body: unknown): string {
  const username = (body as { username?: unknown } | null)?.username;
  if (typeof username !== "string" || username.length === 0) {
    throw new BadRequestError('A "username" string is expected in the request body.');
  }
  return username;
}

export function sessionRoutes(manager: RbacManager, store: RbacStore): Router {
  const router = Router();

  /**
   * The authorization graph as the wire format the core defines. The browser
   * rebuilds a store from it and answers `can()` locally, without a round trip
   * per button.
   */
  router.get(
    "/snapshot",
    route(async (_req, res) => {
      res.json(await toSnapshot(store));
    }),
  );

  /**
   * Assignments are not part of a snapshot — a client only ever needs those of
   * the current user, and this is where it gets them.
   */
  router.get(
    "/session",
    route(async (req, res) => {
      res.json(await sessionResponse(manager, req.rbacUser.identity));
    }),
  );

  router.post(
    "/session",
    route(async (req, res) => {
      const username = readUsername(req.body);
      const user = findUser(username);
      if (user === null) {
        throw new UnauthorizedError([], `Unknown user "${username}".`);
      }
      // An inactive user is allowed to sign in; `rbac` is what denies them
      // everything afterwards, which is the point of the "banned" demo user.
      const token = createSession(user.username);
      res.status(201).json({ token, ...(await sessionResponse(manager, user)) });
    }),
  );

  router.delete("/session", (req, res) => {
    destroySession(tokenFromRequest(req));
    res.status(204).end();
  });

  return router;
}
