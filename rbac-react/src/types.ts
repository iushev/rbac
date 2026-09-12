import type { Identity, Logger, RuleParams } from "@iushev/rbac";

/**
 * The identity the provider carries. Augment it in the application to get the
 * extra fields of your own user typed:
 *
 * ```ts
 * declare module "@iushev/rbac-react" {
 *   interface RbacIdentity {
 *     id: number;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RbacIdentity extends Identity {}

/**
 * The outcome of an access check, in the three states a component has to render.
 *
 * A check is always asynchronous, so the first render of every hook reports
 * `isLoading`. `allowed` is meaningful only once it is false.
 */
export interface AccessState {
  allowed: boolean;
  isLoading: boolean;
  /** What the check rejected with, e.g. `UnknownRuleError`. */
  error: Error | null;
}

/** Options shared by both hooks and both components. */
export interface CheckOptions {
  /**
   * Rule params. Compared shallowly against the previous render, so an object
   * literal written inline in JSX does not restart the check on every render —
   * as long as its values keep their identity.
   */
  params?: RuleParams;
  /** Read fresh on every check; changing it alone does not re-run one. */
  logging?: Logger;
}
