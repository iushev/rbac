import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import type { CheckAccess, RbacManager } from "@iushev/rbac";

import { rbacController } from "../controller.js";
import { RbacHttpError } from "../errors.js";
import { rbacMiddleware } from "../middleware.js";

export const USERS: Record<string, Express.RbacIdentity> = {
  alice: { username: "alice", isActive: true, isSuperuser: false },
  bob: { username: "bob", isActive: true, isSuperuser: false },
  root: { username: "root", isActive: true, isSuperuser: false },
  su: { username: "su", isActive: true, isSuperuser: true },
  banned: { username: "banned", isActive: false, isSuperuser: false },
};

/** Reports the error as JSON so tests can assert on status and payload. */
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof RbacHttpError) {
    res.status(err.status).json({ error: err.message, required: err.required });
    return;
  }
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
};

export interface TestAppOptions {
  accessChecker: CheckAccess;
  /** Guards to mount on `GET /resource`. */
  guards: RequestHandler[];
  /** Skips `rbacMiddleware`, to assert the guards' own precondition. */
  withoutMiddleware?: boolean;
}

/**
 * A single-route app. The identity comes from an `x-user` header so a test
 * picks who it is by setting one header.
 */
export function buildApp({ accessChecker, guards, withoutMiddleware }: TestAppOptions): Express {
  const app = express();

  if (!withoutMiddleware) {
    app.use(
      rbacMiddleware({
        accessChecker,
        getIdentity: (req) => {
          const name = req.get("x-user");
          return name ? (USERS[name] ?? null) : null;
        },
      }),
    );
  }

  app.get("/resource", ...guards, (req, res) => {
    res.json({ ok: true, username: req.rbacUser.username });
  });

  app.use(errorHandler);

  return app;
}

export interface ControllerAppOptions {
  manager: RbacManager;
  /** Guards handed to the controller, to assert that it can be protected. */
  guards?: RequestHandler[];
}

/** The controller mounted at `/rbac`, with the same `x-user` identity as {@link buildApp}. */
export function buildControllerApp({ manager, guards }: ControllerAppOptions): Express {
  const app = express();

  app.use(
    rbacMiddleware({
      accessChecker: manager,
      getIdentity: (req) => {
        const name = req.get("x-user");
        return name ? (USERS[name] ?? null) : null;
      },
    }),
  );

  app.use("/rbac", rbacController({ manager, guards }));

  app.use(errorHandler);

  return app;
}
