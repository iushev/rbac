import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { matchRole } from "@iushev/rbac";
import { rbacUserFor } from "@iushev/rbac-tanstack";
import { useState } from "react";

import { Denial } from "../components/Denial.js";
import { assignRole, listRbacUsers, listRoles, revokeRole } from "../fn/admin.js";
import { DEFAULT_ROLES, rules } from "../rbac/rules.js";

export const Route = createFileRoute("/admin")({
  /**
   * A navigation-level guard, run before the route loads — on the server for
   * the first render and in the browser for every navigation after it. It uses
   * the same checker the components use, so no round trip is needed.
   *
   * It protects nothing. The loader below calls two guarded server functions,
   * and those are what actually refuse a non-admin; this only keeps a user out
   * of a screen that would be empty for them.
   */
  beforeLoad: async ({ context }) => {
    // The same user the components below get: `rbacUserFor` caches per
    // session, so the guard and the UI share one access cache.
    const user = await rbacUserFor(context.session, { rules, defaultRoles: DEFAULT_ROLES });
    if (!(await matchRole({ user, roles: ["admin"] }))) {
      throw redirect({ to: "/" });
    }
  },
  loader: async () => ({
    roles: await listRoles(),
    users: await listRbacUsers(),
  }),
  component: AdminRoute,
  errorComponent: ({ error }) => <Denial error={error} />,
});

function AdminRoute() {
  const { roles, users } = Route.useLoaderData();
  const router = useRouter();
  const assign = useServerFn(assignRole);
  const revoke = useServerFn(revokeRole);
  const [error, setError] = useState<unknown>(null);

  async function toggle(role: string, username: string, isMember: boolean): Promise<void> {
    setError(null);
    try {
      const change = isMember ? revoke : assign;
      await change({ data: { role, username } });
      // The graph changed, so both the assignments the browser replays and the
      // answers cached in the current RbacUser are stale. Invalidating the root
      // route rebuilds the checker from a fresh snapshot.
      await router.invalidate();
    } catch (cause) {
      setError(cause);
    }
  }

  return (
    <>
      <h2>Roles and assignments</h2>
      <p>
        Mutations go through <code>RbacManager</code>: the validations that do not depend on the
        store — cycles, a role under a permission — live there and are not repeated here.
      </p>
      {error !== null && <Denial error={error} />}

      <table>
        <thead>
          <tr>
            <th>User</th>
            {roles.map((role) => (
              <th key={role.name} title={role.description ?? undefined}>
                {role.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.username}>
              <td>
                {user.displayName}
                <br />
                <span className="meta">{user.username}</span>
              </td>
              {roles.map((role) => {
                const isMember = role.members.includes(user.username);
                return (
                  <td key={role.name}>
                    <button
                      type="button"
                      className={isMember ? "" : "ghost"}
                      onClick={() => void toggle(role.name, user.username, isMember)}
                    >
                      {isMember ? "revoke" : "grant"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="meta">
        Assignments are kept in server memory — a restart brings back the sample data.
      </p>
    </>
  );
}
