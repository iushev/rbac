import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Denial } from "../components/Denial.js";
import { assignRole } from "../fn/admin.js";
import { createPost, deletePost } from "../fn/posts.js";

export const Route = createFileRoute("/guards")({
  component: GuardsRoute,
});

interface Probe {
  label: string;
  description: string;
  run: () => Promise<unknown>;
}

/**
 * The panel that sends the requests the UI has no button for.
 *
 * Everything here is a plain call to a server function — the same call the
 * browser console can make. It is the answer to "why do I need a guard if the button
 * is hidden": `rbac-react` decides what is drawn, the guard decides what
 * happens, and the second does not follow from the first.
 */
function GuardsRoute() {
  const write = useServerFn(createPost);
  const remove = useServerFn(deletePost);
  const assign = useServerFn(assignRole);
  const [results, setResults] = useState<Record<string, unknown>>({});

  const probes: Probe[] = [
    {
      label: "createPost",
      description: "Creates a post. Requires the createPost permission.",
      run: () => write({ data: { title: "From the guard demo", body: "Did it get through?" } }),
    },
    /*
     * The two below are a pair, and the point is the difference between them.
     * They ask for the same permission and differ only in the post, which is
     * what `deleteOwnPost` narrows: an author reaches `deletePost` only through
     * it, and its `isAuthor` rule compares the post with the caller. An admin
     * holds `deletePost` directly and so passes for both.
     */
    {
      label: "deletePost(1) — Alice's",
      description:
        "Alice's post. Alice passes here: deleteOwnPost leads to deletePost, and the isAuthor rule recognizes the post as Alice's.",
      run: () => remove({ data: 1 }),
    },
    {
      label: "deletePost(3) — Bob's",
      description:
        "Bob's post. Same permission, different post: for Alice the rule refuses, Root passes by holding deletePost directly.",
      run: () => remove({ data: 3 }),
    },
    {
      label: "assignRole(admin → bob)",
      description: "Gives Bob the admin role. Requires manageRbac.",
      run: () => assign({ data: { role: "admin", username: "bob" } }),
    },
  ];

  async function probe(item: Probe): Promise<void> {
    try {
      const value = await item.run();
      setResults((current) => ({ ...current, [item.label]: value }));
    } catch (error) {
      setResults((current) => ({ ...current, [item.label]: error }));
    }
  }

  return (
    <>
      <h2>What the guard says</h2>
      <p>
        The buttons here are not hidden: each one calls a server function that the current user most
        likely has no right to call. The answer comes from the guard, not from the UI.
      </p>
      <p className="meta">
        Requests that get through really do their work — a deleted post is gone. From then on the
        same button answers “no such post”, which is an error, not a denial. Restarting the server
        brings back the sample posts.
      </p>

      {probes.map((item) => {
        const result = results[item.label];
        return (
          <section key={item.label} className="probe">
            <div className="row">
              <button type="button" onClick={() => void probe(item)}>
                {item.label}
              </button>
              <span className="meta">{item.description}</span>
            </div>
            {result !== undefined &&
              (result instanceof Error ? (
                <Denial error={result} />
              ) : (
                <p className="notice notice--ok">Passed: {JSON.stringify(result)}</p>
              ))}
          </section>
        );
      })}
    </>
  );
}
