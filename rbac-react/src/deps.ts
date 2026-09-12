import { useEffect, useRef } from "react";
import type { RuleParams } from "@iushev/rbac";

/**
 * Keeps the previous value for as long as a new one is shallowly equal to it.
 *
 * Access checks are keyed by their inputs, and props written inline in JSX are
 * a fresh object on every render. Without this, `params={{ post }}` would
 * restart the check forever.
 */
function useShallowStable<T>(value: T, isEqual: (a: T, b: T) => boolean): T {
  const previous = useRef(value);
  const stable = isEqual(previous.current, value) ? previous.current : value;

  useEffect(() => {
    previous.current = stable;
  }, [stable]);

  return stable;
}

/**
 * Holds the latest value without making it a dependency, for inputs that should
 * be read by the next check but must not trigger one.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

const EMPTY_PARAMS: RuleParams = {};

function paramsEqual(a: RuleParams, b: RuleParams): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  return keys.every((key) => Object.is(a[key], b[key]));
}

function rolesEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((role, index) => role === b[index]);
}

export function useStableParams(params: RuleParams | undefined): RuleParams {
  return useShallowStable(params ?? EMPTY_PARAMS, paramsEqual);
}

export function useStableRoles(roles: readonly string[]): readonly string[] {
  return useShallowStable(roles, rolesEqual);
}
