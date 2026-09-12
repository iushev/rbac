import { isRbacHttpError } from "@iushev/rbac-tanstack";

/**
 * How a refusal from a server function reads on screen.
 *
 * The two statuses say different things and are worth keeping apart: 401 means
 * the call would have worked with an identity, 403 that it would not. Anything
 * that is not a refusal is a defect and is shown as one — an `UnknownRuleError`
 * must not read as "no access".
 */
export function Denial({ error }: { error: unknown }) {
  if (!isRbacHttpError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return <p className="notice notice--error">Error: {message}</p>;
  }

  return (
    <p className="notice notice--denied">
      <strong>{error.status}</strong>{" "}
      {error.status === 401 ? "You need to sign in." : "You do not have access to this action."}
      {error.required.length > 0 && (
        <>
          {" "}
          The guard required: <code>{error.required.join(", ")}</code>.
        </>
      )}
    </p>
  );
}
