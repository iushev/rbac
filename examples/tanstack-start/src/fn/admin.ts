import { createServerFn } from "@tanstack/react-start";
import type { Role } from "@iushev/rbac";
import { access, can } from "@iushev/rbac-tanstack";

import { getRbac } from "../server/graph.js";
import { rbac } from "../server/rbac.js";
import { USERS } from "../server/users.js";
import type { SessionUser } from "../types.js";

/**
 * The admin half of the demo: reading the graph and handing out roles.
 *
 * `rbac-express` ships a whole router for this (`rbacController`); a server
 * function is not a route, so the calls the panel needs are written out here.
 * The mutations go through `RbacManager` — the validation that does not depend
 * on the store lives in it, and is not repeated here.
 */

async function requireRoleItem(name: string): Promise<Role> {
  const { manager } = await getRbac();
  const role = await manager.getRole(name);
  if (role === null) {
    throw new Error(`No role "${name}".`);
  }
  return role;
}

/** "This screen is for these roles" is what `access` is for. */
export const listRbacUsers = createServerFn({ method: "GET" })
  .middleware([rbac, access(["admin"])])
  .handler((): SessionUser[] => Object.values(USERS));

export const listRoles = createServerFn({ method: "GET" })
  .middleware([rbac, can("manageRbac")])
  .handler(async () => {
    const { manager } = await getRbac();
    const roles = [...(await manager.getRoles()).values()];

    return Promise.all(
      roles.map(async (role) => ({
        name: role.name,
        description: role.description,
        members: await manager.getUsernamesByRole(role.name),
      })),
    );
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([rbac, can("manageRbac")])
  .validator((value: { role: string; username: string }) => value)
  .handler(async ({ data }) => {
    const { manager } = await getRbac();
    await manager.assign(await requireRoleItem(data.role), data.username);
    return { ok: true as const };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([rbac, can("manageRbac")])
  .validator((value: { role: string; username: string }) => value)
  .handler(async ({ data }) => {
    const { manager } = await getRbac();
    await manager.revoke(await requireRoleItem(data.role), data.username);
    return { ok: true as const };
  });
