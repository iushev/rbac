import { useState } from "react";
import { useRbacUser } from "@iushev/rbac-react";

import { useSession } from "../session.js";
import { DEMO_USERS } from "../users.js";

/**
 * Deliberately *not* wrapped in `<Access roles={["?"]}>` / `["@"]}>`.
 *
 * "Am I signed in" is session state, not authorization. An inactive user is
 * denied every check — `"@"` and `"?"` included, since `matchRole` answers false
 * before it ever looks at the names — so a sign-out button behind an access
 * check would vanish for exactly the user who needs it: `banned` would have no
 * way back out.
 *
 * Guard what a user may *do*; leave the controls that carry the session itself
 * to the session.
 */
export function UserSwitcher() {
  const { login, logout } = useSession();
  const identity = useRbacUser().identity;
  const [busy, setBusy] = useState(false);

  const run = (action: () => Promise<void>) => () => {
    setBusy(true);
    void action().finally(() => {
      setBusy(false);
    });
  };

  if (identity === null) {
    return (
      <div className="switcher">
        <span className="switcher__label">Sign in as:</span>
        {DEMO_USERS.map((user) => (
          <button
            key={user.username}
            type="button"
            className="button"
            title={user.hint}
            disabled={busy}
            onClick={run(() => login(user.username))}
          >
            {user.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="switcher">
      <span className="switcher__user">{identity.displayName}</span>
      {!identity.isActive && <span className="tag tag--muted">inactive</span>}
      <button type="button" className="button" disabled={busy} onClick={run(logout)}>
        Sign out
      </button>
    </div>
  );
}
