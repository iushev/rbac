import { existsSync } from "node:fs";
import path from "node:path";

import express from "express";
import { access, rbacController, rbacMiddleware } from "@iushev/rbac-express";

import { identityFromRequest } from "./auth.js";
import { apiNotFound, errorHandler } from "./errorHandler.js";
import { buildRbac } from "./rbac.js";
import { adminRoutes } from "./routes/admin.js";
import { postsRoutes } from "./routes/posts.js";
import { sessionRoutes } from "./routes/session.js";

const PORT = Number(process.env.PORT ?? 3000);

const { store, manager } = await buildRbac();

const app = express();
app.use(express.json());

/**
 * Mounted once, above everything a guard protects. It runs for guests too, so
 * `req.rbacUser` always exists and one request shares one access cache.
 */
app.use(rbacMiddleware({ accessChecker: manager, getIdentity: identityFromRequest }));

app.use("/api", sessionRoutes(manager, store));
app.use("/api", postsRoutes());
app.use("/api/admin", adminRoutes());

/**
 * The controller authorizes nothing by itself — mounted without `guards` it
 * would hand `DELETE /api/admin/rbac` (drop all authorization data) to anyone.
 */
app.use("/api/admin/rbac", rbacController({ manager, guards: [access(["admin"])] }));

app.use("/api", apiNotFound);

// In production the same server hands out the built UI; in dev that is Vite's job.
const webDir = path.resolve(process.cwd(), "dist/web");
if (existsSync(webDir)) {
  app.use(express.static(webDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}/api`);
  if (existsSync(webDir)) {
    console.log(`UI:  http://localhost:${PORT}`);
  }
});
