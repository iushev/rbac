import { render, type RenderResult } from "@testing-library/react";
import type { CheckAccess } from "@iushev/rbac";
import type { ReactNode } from "react";

import { RbacProvider } from "../RbacProvider.js";
import type { RbacIdentity } from "../types.js";

export interface RbacRenderResult extends Omit<RenderResult, "rerender"> {
  /** Re-renders the tree, provider included, optionally as a different identity. */
  rerender: (ui: ReactNode, identity?: RbacIdentity | null) => void;
}

/**
 * Mounts `ui` under a provider built from an access checker and an identity.
 *
 * The own `rerender` exists because RTL's replaces the whole tree, which would
 * drop the provider along with it.
 */
export function renderWithRbac(
  ui: ReactNode,
  accessChecker: CheckAccess,
  identity: RbacIdentity | null = null,
): RbacRenderResult {
  const wrap = (node: ReactNode, as: RbacIdentity | null) => (
    <RbacProvider accessChecker={accessChecker} identity={as}>
      {node}
    </RbacProvider>
  );

  const result = render(wrap(ui, identity));

  return {
    ...result,
    rerender: (node, as = identity) => {
      result.rerender(wrap(node, as));
    },
  };
}
