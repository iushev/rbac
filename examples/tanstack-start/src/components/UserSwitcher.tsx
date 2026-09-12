import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useRbacUser } from "@iushev/rbac-react";

import { login, logout } from "../fn/session.js";

/**
 * The sign-in picker of the demo. A real application would have a password
 * form here; the usernames are the ones seeded in `src/server/users.ts`.
 */
const DEMO_USERS = [
  { username: "bob", label: "Bob", hint: "reader — read-only" },
  { username: "alice", label: "Alice", hint: "author — writes and edits own posts" },
  { username: "root", label: "Root", hint: "admin — can do everything with posts and RBAC" },
  { username: "su", label: "Su", hint: "superuser — passes every check" },
  { username: "banned", label: "Banned", hint: "author, but isActive: false" },
] as const;

export function UserSwitcher() {
  const user = useRbacUser();
  const router = useRouter();
  const signInFn = useServerFn(login);
  const signOutFn = useServerFn(logout);
  const [busy, setBusy] = useState(false);

  /**
   * The session changed, so the graph the browser answers with has to change
   * with it. `refresh()` from `useRbac` would only re-run the checks against
   * the same store; the assignments live in that store, so the whole context
   * is rebuilt instead — which is what invalidating the root route does.
   */
  async function reload(): Promise<void> {
    await router.invalidate();
  }

  async function signIn(username: string): Promise<void> {
    setBusy(true);
    try {
      await signInFn({ data: username });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function signOut(): Promise<void> {
    setBusy(true);
    try {
      await signOutFn({});
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (user.identity !== null) {
    return (
      <div className="session">
        <span>
          {user.identity.displayName}
          {user.isSuperuser ? " · superuser" : ""}
          {user.isActive ? "" : " · inactive"}
        </span>
        {/*
          Deliberately not behind <Access>: being signed in is a state of the
          session, not a permission. `matchRole` denies an inactive user
          everything, "@" included, so a guarded sign-out button would vanish
          for exactly the user who needs it — `banned`.
        */}
        <button type="button" onClick={() => void signOut()} disabled={busy}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="session">
      <span>Guest</span>
      <select
        value=""
        disabled={busy}
        onChange={(event) => void signIn(event.target.value)}
        aria-label="Sign in as"
      >
        <option value="" disabled>
          Sign in as…
        </option>
        {DEMO_USERS.map((demo) => (
          <option key={demo.username} value={demo.username}>
            {demo.label} — {demo.hint}
          </option>
        ))}
      </select>
    </div>
  );
}
