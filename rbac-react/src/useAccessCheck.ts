import { useEffect, useState } from "react";

import type { AccessState } from "./types.js";

const PENDING: AccessState = { allowed: false, isLoading: true, error: null };

interface StampedResult {
  /** The check the state belongs to; anything else makes it stale. */
  check: unknown;
  state: AccessState;
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Runs `check` and reports its outcome.
 *
 * `check` doubles as the identity of the question being asked: pass a
 * `useCallback`-ed closure over everything the answer depends on. A result is
 * then shown only while it still belongs to the current closure, so a changed
 * permission, user or params reads as pending instead of briefly showing the
 * answer to the previous question.
 */
export function useAccessCheck(check: () => Promise<boolean>): AccessState {
  const [result, setResult] = useState<StampedResult>({ check: null, state: PENDING });

  useEffect(() => {
    let active = true;

    check().then(
      (allowed) => {
        if (active) {
          setResult({ check, state: { allowed, isLoading: false, error: null } });
        }
      },
      (cause: unknown) => {
        if (active) {
          setResult({ check, state: { allowed: false, isLoading: false, error: asError(cause) } });
        }
      },
    );

    // A superseded check keeps running, but its answer is dropped rather than
    // raced into the state after the newer one.
    return () => {
      active = false;
    };
  }, [check]);

  return result.check === check ? result.state : PENDING;
}
