import { act, render, type RenderResult } from "@testing-library/react";
import { Suspense, type ReactNode } from "react";

export interface SuspendedRenderResult extends RenderResult {
  /** What was on screen before the suspended tree was let through. */
  textBeforeSettled: string;
}

/**
 * Renders `ui` under a `<Suspense>` and waits for it to settle.
 *
 * `<RbacSession>` renders with `use`, so its first render suspends — and React
 * insists that the `act` scope around a suspending render be awaited. A render
 * started outside one never comes back.
 */
export async function renderSuspended(
  ui: ReactNode,
  fallback: ReactNode = <span>pending</span>,
): Promise<SuspendedRenderResult> {
  let result!: RenderResult;
  let textBeforeSettled = "";

  await act(async () => {
    result = render(<Suspense fallback={fallback}>{ui}</Suspense>);
    textBeforeSettled = result.container.textContent ?? "";
    // A macrotask, not a microtask: building the checker awaits the store a
    // handful of times, and every one of those has to run before the tree can.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return Object.assign(result, { textBeforeSettled });
}
