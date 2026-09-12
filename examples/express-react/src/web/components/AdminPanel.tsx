import { useCallback, useEffect, useState } from "react";
import type { Assignment, Item, Role } from "@iushev/rbac";
import { useRbac } from "@iushev/rbac-react";

import type { SessionUser } from "../../shared/api.js";
import { ApiError, api } from "../api.js";
import { useSession } from "../session.js";

interface Graph {
  users: SessionUser[];
  roles: Role[];
  items: Item[];
  /** item name -> names of its direct children */
  children: Record<string, string[]>;
  /** username -> names of the items assigned directly to them */
  assignments: Record<string, string[]>;
}

async function loadGraph(): Promise<Graph> {
  const [users, roles, items] = await Promise.all([
    api<SessionUser[]>("/admin/users"),
    api<Role[]>("/admin/rbac/roles"),
    api<Item[]>("/admin/rbac/items"),
  ]);

  const childEntries = await Promise.all(
    items.map(
      async (item) =>
        [
          item.name,
          (await api<Item[]>(`/admin/rbac/items/${item.name}/children`)).map((c) => c.name),
        ] as const,
    ),
  );

  const assignmentEntries = await Promise.all(
    users.map(
      async (user) =>
        [
          user.username,
          (await api<Assignment[]>(`/admin/rbac/assignments/${user.username}`)).map(
            (assignment) => assignment.itemName,
          ),
        ] as const,
    ),
  );

  return {
    users,
    roles,
    items,
    children: Object.fromEntries(childEntries),
    assignments: Object.fromEntries(assignmentEntries),
  };
}

/**
 * The admin screen, built entirely on `rbacController` — every request below
 * goes to a route the package mounts, guarded by `access(["admin"])` on the
 * server. `<Access roles={["admin"]}>` in `App` only decides whether it is drawn.
 */
export function AdminPanel() {
  const { user, reload } = useSession();
  const { refresh } = useRbac();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    loadGraph()
      .then(setGraph)
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? `${cause.status} — ${cause.message}` : String(cause));
      });
  }, []);

  useEffect(load, [load]);

  const toggle = (username: string, roleName: string, assigned: boolean) => {
    const request = assigned
      ? api<void>(`/admin/rbac/assignments/${username}/${roleName}`, { method: "DELETE" })
      : api<Assignment>(`/admin/rbac/assignments/${username}`, {
          method: "POST",
          body: JSON.stringify({ name: roleName }),
        });

    request
      .then(async () => {
        load();
        // The assignments of the signed-in user live in the browser's own store,
        // so changing them means rebuilding it; `refresh()` alone would only
        // re-ask the same store the same question.
        if (username === user?.username) {
          await reload();
          refresh();
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? `${cause.status} — ${cause.message}` : String(cause));
      });
  };

  if (error !== null) {
    return <p className="notice notice--error">{error}</p>;
  }

  if (graph === null) {
    return <p className="notice">Loading RBAC data…</p>;
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Administration</h2>

      <h3 className="panel__subtitle">Roles by user</h3>
      <table className="table">
        <thead>
          <tr>
            <th>User</th>
            {graph.roles.map((role) => (
              <th key={role.name}>{role.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {graph.users.map((row) => (
            <tr key={row.username}>
              <td>
                {row.username}
                {row.isSuperuser && <span className="tag">superuser</span>}
                {!row.isActive && <span className="tag tag--muted">inactive</span>}
              </td>
              {graph.roles.map((role) => {
                const assigned = graph.assignments[row.username]?.includes(role.name) ?? false;
                return (
                  <td key={role.name}>
                    <input
                      type="checkbox"
                      checked={assigned}
                      onChange={() => {
                        toggle(row.username, role.name, assigned);
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="panel__text">
        Changing a role of the current user shows up immediately — the session reloads and the UI
        checks run again.
      </p>

      <h3 className="panel__subtitle">Hierarchy</h3>
      <ul className="graph">
        {graph.items.map((item) => (
          <li key={item.name}>
            <span className={`tag tag--${item.type}`}>{item.type}</span>
            <strong>{item.name}</strong>
            {item.ruleName !== null && <span className="muted"> rule: {item.ruleName}</span>}
            {(graph.children[item.name]?.length ?? 0) > 0 && (
              <span className="muted"> → {graph.children[item.name]?.join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
