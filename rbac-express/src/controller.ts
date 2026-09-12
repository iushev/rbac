import express, { type Request, type RequestHandler, type Response, type Router } from "express";
import {
  ItemType,
  createPermission,
  createRole,
  createRule,
  type Item,
  type CreateItem,
  type Permission,
  type RbacManager,
  type Role,
  type Rule,
} from "@iushev/rbac";

import { BadRequestError, ConflictError, NotFoundError } from "./errors.js";

export interface RbacControllerOptions {
  /** The manager whose authorization data the endpoints read and write. */
  manager: RbacManager;
  /**
   * Handlers run before every route — normally the guard that protects the
   * whole API, e.g. `[access(["admin"])]`. The router does no authorization of
   * its own, so mounting it unguarded exposes the RBAC data to everyone.
   */
  guards?: RequestHandler[];
  /**
   * Whether to parse JSON bodies. Leave it on unless the application already
   * mounts a body parser that is not `express.json()`; body-parser skips a
   * request another body-parser instance has already read.
   */
  parseJson?: boolean;
}

/** Wraps an async handler the way Express 5 needs: rejections must reach `next`. */
function route(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

/**
 * The routes are mounted from composed path strings, so Express cannot infer the
 * param names and types them as possibly absent. A route always matches its own
 * params; this only narrows the type.
 */
function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new BadRequestError(`Missing "${name}" in the request path.`);
  }
  return value;
}

function readBody(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestError("A JSON object is expected as the request body.");
  }
  return body as Record<string, unknown>;
}

function readName(body: Record<string, unknown>, field = "name"): string {
  const value = body[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestError(`"${field}" is required and must be a non-empty string.`);
  }
  return value;
}

/** Reads an optional `string | null` field, telling "absent" from "set to null". */
function readNullableString(
  body: Record<string, unknown>,
  field: string,
): string | null | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    throw new BadRequestError(`"${field}" must be a string or null.`);
  }
  return value;
}

function readItemInput(req: Request, fallbackName?: string): CreateItem {
  const body = readBody(req);
  const name =
    fallbackName !== undefined && body.name === undefined ? fallbackName : readName(body);
  return {
    name,
    description: readNullableString(body, "description"),
    ruleName: readNullableString(body, "ruleName"),
    data: readNullableString(body, "data"),
  };
}

/** Items share one namespace, so a name is looked up without knowing its type. */
async function findItem(manager: RbacManager, name: string): Promise<Item | null> {
  return (await manager.getRole(name)) ?? (await manager.getPermission(name));
}

async function requireItem(manager: RbacManager, name: string): Promise<Item> {
  const item = await findItem(manager, name);
  if (!item) {
    throw new NotFoundError(`No role or permission named "${name}".`);
  }
  return item;
}

async function requireNameFree(manager: RbacManager, name: string): Promise<void> {
  if (await findItem(manager, name)) {
    throw new ConflictError(`Item "${name}" already exists.`);
  }
}

async function requireRule(manager: RbacManager, name: string): Promise<Rule> {
  const rule = await manager.getRule(name);
  if (!rule) {
    throw new NotFoundError(`No rule named "${name}".`);
  }
  return rule;
}

/**
 * `/roles` and `/permissions` differ only in the item type, so both are mounted
 * from one description.
 */
interface ItemRoutes {
  path: string;
  create: (item: CreateItem) => Role | Permission;
  getOne: (name: string) => Promise<Role | Permission | null>;
  getAll: () => Promise<Map<string, Role | Permission>>;
  removeAll: () => Promise<void>;
}

function itemRoutes(manager: RbacManager, type: ItemType): ItemRoutes {
  return type === ItemType.role
    ? {
        path: "/roles",
        create: createRole,
        getOne: (name) => manager.getRole(name),
        getAll: () => manager.getRoles(),
        removeAll: () => manager.removeAllRoles(),
      }
    : {
        path: "/permissions",
        create: createPermission,
        getOne: (name) => manager.getPermission(name),
        getAll: () => manager.getPermissions(),
        removeAll: () => manager.removeAllPermissions(),
      };
}

function mountItemRoutes(router: Router, manager: RbacManager, type: ItemType): void {
  const { path, create, getOne, getAll, removeAll } = itemRoutes(manager, type);

  router.get(
    path,
    route(async (_req, res) => {
      res.json([...(await getAll()).values()]);
    }),
  );

  router.post(
    path,
    route(async (req, res) => {
      const input = readItemInput(req);
      await requireNameFree(manager, input.name);
      const item = create(input);
      await manager.add(item);
      res.status(201).json(item);
    }),
  );

  router.delete(
    path,
    route(async (_req, res) => {
      await removeAll();
      res.status(204).end();
    }),
  );

  router.get(
    `${path}/:name`,
    route(async (req, res) => {
      const item = await getOne(param(req, "name"));
      if (!item) {
        throw new NotFoundError(`No ${type} named "${param(req, "name")}".`);
      }
      res.json(item);
    }),
  );

  router.put(
    `${path}/:name`,
    route(async (req, res) => {
      const name = param(req, "name");
      const current = await getOne(name);
      if (!current) {
        throw new NotFoundError(`No ${type} named "${name}".`);
      }

      const input = readItemInput(req, name);
      if (input.name !== name) {
        await requireNameFree(manager, input.name);
      }

      const item = create(input);
      await manager.update(name, item);
      res.json(item);
    }),
  );

  router.delete(
    `${path}/:name`,
    route(async (req, res) => {
      const item = await getOne(param(req, "name"));
      if (!item) {
        throw new NotFoundError(`No ${type} named "${param(req, "name")}".`);
      }
      await manager.remove(item);
      res.status(204).end();
    }),
  );
}

function mountRuleRoutes(router: Router, manager: RbacManager): void {
  router.get(
    "/rules",
    route(async (_req, res) => {
      res.json([...(await manager.getRules()).values()]);
    }),
  );

  router.post(
    "/rules",
    route(async (req, res) => {
      const body = readBody(req);
      const name = readName(body);
      if (await manager.getRule(name)) {
        throw new ConflictError(`Rule "${name}" already exists.`);
      }
      const rule = createRule(name, readNullableString(body, "data"));
      await manager.add(rule);
      res.status(201).json(rule);
    }),
  );

  router.delete(
    "/rules",
    route(async (_req, res) => {
      await manager.removeAllRules();
      res.status(204).end();
    }),
  );

  router.get(
    "/rules/:name",
    route(async (req, res) => {
      res.json(await requireRule(manager, param(req, "name")));
    }),
  );

  router.put(
    "/rules/:name",
    route(async (req, res) => {
      const name = param(req, "name");
      await requireRule(manager, name);

      const body = readBody(req);
      const newName = body.name === undefined ? name : readName(body);
      if (newName !== name && (await manager.getRule(newName))) {
        throw new ConflictError(`Rule "${newName}" already exists.`);
      }

      const rule = createRule(newName, readNullableString(body, "data"));
      await manager.update(name, rule);
      res.json(rule);
    }),
  );

  router.delete(
    "/rules/:name",
    route(async (req, res) => {
      await manager.remove(await requireRule(manager, param(req, "name")));
      res.status(204).end();
    }),
  );
}

function mountHierarchyRoutes(router: Router, manager: RbacManager): void {
  router.get(
    "/items",
    route(async (_req, res) => {
      const roles = await manager.getRoles();
      const permissions = await manager.getPermissions();
      res.json([...roles.values(), ...permissions.values()]);
    }),
  );

  router.get(
    "/items/:name",
    route(async (req, res) => {
      res.json(await requireItem(manager, param(req, "name")));
    }),
  );

  router.get(
    "/items/:name/children",
    route(async (req, res) => {
      const parent = await requireItem(manager, param(req, "name"));
      res.json([...(await manager.getChildren(parent.name)).values()]);
    }),
  );

  router.post(
    "/items/:name/children",
    route(async (req, res) => {
      const parent = await requireItem(manager, param(req, "name"));
      const child = await requireItem(manager, readName(readBody(req)));

      if (await manager.hasChild(parent, child)) {
        throw new ConflictError(`"${child.name}" is already a child of "${parent.name}".`);
      }
      // The edge is validated before it is added, so a loop or a role under a
      // permission comes back as 400 rather than as a thrown 500.
      if (!(await manager.canAddChild(parent, child))) {
        throw new BadRequestError(
          `"${child.name}" cannot be added as a child of "${parent.name}".`,
        );
      }

      await manager.addChild(parent, child);
      res.status(204).end();
    }),
  );

  router.delete(
    "/items/:name/children",
    route(async (req, res) => {
      await manager.removeChildren(await requireItem(manager, param(req, "name")));
      res.status(204).end();
    }),
  );

  router.delete(
    "/items/:name/children/:child",
    route(async (req, res) => {
      const parent = await requireItem(manager, param(req, "name"));
      const child = await requireItem(manager, param(req, "child"));
      await manager.removeChild(parent, child);
      res.status(204).end();
    }),
  );
}

function mountAssignmentRoutes(router: Router, manager: RbacManager): void {
  router.get(
    "/assignments/:username",
    route(async (req, res) => {
      res.json([...(await manager.getAssignments(param(req, "username"))).values()]);
    }),
  );

  router.post(
    "/assignments/:username",
    route(async (req, res) => {
      const item = await requireItem(manager, readName(readBody(req)));
      const assignment = await manager.assign(item, param(req, "username"));
      res.status(201).json(assignment);
    }),
  );

  router.delete(
    "/assignments",
    route(async (_req, res) => {
      await manager.removeAllAssignments();
      res.status(204).end();
    }),
  );

  router.delete(
    "/assignments/:username",
    route(async (req, res) => {
      await manager.revokeAll(param(req, "username"));
      res.status(204).end();
    }),
  );

  router.delete(
    "/assignments/:username/:itemName",
    route(async (req, res) => {
      const item = await requireItem(manager, param(req, "itemName"));
      await manager.revoke(item, param(req, "username"));
      res.status(204).end();
    }),
  );

  router.get(
    "/roles/:name/users",
    route(async (req, res) => {
      const role = await manager.getRole(param(req, "name"));
      if (!role) {
        throw new NotFoundError(`No role named "${param(req, "name")}".`);
      }
      res.json(await manager.getUsernamesByRole(role.name));
    }),
  );
}

/**
 * A router with CRUD endpoints over the authorization data of a
 * {@link RbacManager} — roles, permissions, rules, the hierarchy and the
 * assignments.
 *
 * It is a translation layer only: every request ends in a manager call, so loop
 * detection, the role-under-permission rule and the placeholder rules stay in
 * the core. Nothing here authorizes the caller — mount it behind a guard:
 *
 * ```ts
 * app.use("/rbac", access(["admin"]), rbacController({ manager }));
 * ```
 *
 * Failures are the same `RbacHttpError` shape the guards use, handed to
 * `next()`: 400 for a body the API cannot act on or an edge the hierarchy
 * rejects, 404 for an unknown name, 409 for a name that is taken.
 */
export function rbacController({
  manager,
  guards,
  parseJson = true,
}: RbacControllerOptions): Router {
  const router = express.Router();

  if (parseJson) {
    router.use(express.json());
  }
  if (guards?.length) {
    router.use(...guards);
  }

  // Before /roles/:name, so the more specific route wins.
  mountAssignmentRoutes(router, manager);
  mountItemRoutes(router, manager, ItemType.role);
  mountItemRoutes(router, manager, ItemType.permission);
  mountRuleRoutes(router, manager);
  mountHierarchyRoutes(router, manager);

  router.delete(
    "/",
    route(async (_req, res) => {
      await manager.removeAll();
      res.status(204).end();
    }),
  );

  return router;
}
