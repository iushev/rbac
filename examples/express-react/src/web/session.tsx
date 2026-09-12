import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CheckAccess, RbacSnapshot } from "@iushev/rbac";
import { RbacProvider } from "@iushev/rbac-react";

import type { LoginResponse, SessionResponse, SessionUser } from "../shared/api.js";
import { buildAccessChecker } from "./accessChecker.js";
import { api, setToken } from "./api.js";

interface SessionState {
  user: SessionUser | null;
  accessChecker: CheckAccess;
}

interface SessionContextValue {
  user: SessionUser | null;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Re-reads the session and rebuilds the checker. Needed after the
   * authorization data itself changed — a new role assignment is not something
   * `refresh()` from `useRbac` can know about, since it lives in the store.
   */
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession() must be called inside <SessionProvider>.");
  }
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<RbacSnapshot | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    const [graph, session] = await Promise.all([
      api<RbacSnapshot>("/snapshot"),
      api<SessionResponse>("/session"),
    ]);
    setSnapshot(graph);
    setState({ user: session.user, accessChecker: await buildAccessChecker(graph, session) });
  }, []);

  useEffect(() => {
    load().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause : new Error(String(cause)));
    });
  }, [load]);

  const apply = useCallback(
    async (session: SessionResponse) => {
      const graph = snapshot ?? (await api<RbacSnapshot>("/snapshot"));
      setSnapshot(graph);
      setState({ user: session.user, accessChecker: await buildAccessChecker(graph, session) });
    },
    [snapshot],
  );

  const login = useCallback(
    async (username: string) => {
      const session = await api<LoginResponse>("/session", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      setToken(session.token);
      await apply(session);
    },
    [apply],
  );

  const logout = useCallback(async () => {
    await api<void>("/session", { method: "DELETE" });
    setToken(null);
    await apply({ user: null, assignments: [] });
  }, [apply]);

  const reload = useCallback(async () => {
    await apply(await api<SessionResponse>("/session"));
  }, [apply]);

  if (error !== null) {
    return <p className="notice notice--error">The server is not responding: {error.message}</p>;
  }

  if (state === null) {
    return <p className="notice">Loading…</p>;
  }

  return (
    <SessionContext.Provider value={{ user: state.user, login, logout, reload }}>
      {/* A new identity builds a new RbacUser, which leaves the old access cache behind. */}
      <RbacProvider accessChecker={state.accessChecker} identity={state.user}>
        {children}
      </RbacProvider>
    </SessionContext.Provider>
  );
}
