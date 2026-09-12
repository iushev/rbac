import { Router } from "express";
import { access } from "@iushev/rbac-express";

import { USERS } from "../users.js";

/**
 * Everything an administrator needs that `rbacController` does not already
 * provide — here, only the list of users to hand roles to.
 *
 * The guard asks for the `admin` role rather than a permission: "this screen is
 * for these roles" is what `access` / `matchRole` is for.
 */
export function adminRoutes(): Router {
  const router = Router();

  router.get("/users", access(["admin"]), (_req, res) => {
    res.json(Object.values(USERS));
  });

  return router;
}
