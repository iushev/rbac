import { useState } from "react";
import { Access } from "@iushev/rbac-react";

import type { Post } from "../../shared/api.js";
import { ApiError, api } from "../api.js";
import { useSession } from "../session.js";

/**
 * Sends the request the UI does not offer a button for.
 *
 * Hiding a control is not protection: `rbac-react` decides what is drawn,
 * `rbac-express` decides what happens. This panel proves the second half is
 * there by editing a post the current user does not own — 403 for an author,
 * 200 for an admin or a superuser.
 */
export function GuardDemo({ posts, onChanged }: { posts: Post[]; onChanged: () => void }) {
  const { user } = useSession();
  const [result, setResult] = useState<string | null>(null);

  const target = posts.find((post) => post.authorId !== user?.username);

  const send = () => {
    if (target === undefined) {
      return;
    }
    setResult(null);
    api<Post>(`/posts/${target.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: `${target.title} (touched)`, body: target.body }),
    })
      .then(() => {
        setResult(`200 — the server allowed the change to "${target.title}".`);
        onChanged();
      })
      .catch((cause: unknown) => {
        setResult(
          cause instanceof ApiError
            ? `${cause.status} — ${cause.message}${
                cause.required.length > 0 ? ` (requires: ${cause.required.join(", ")})` : ""
              }`
            : String(cause),
        );
      });
  };

  return (
    <Access roles={["@"]}>
      <section className="panel">
        <h2 className="panel__title">A hidden button is not protection</h2>
        <p className="panel__text">
          The request below goes out even though the UI offers no button for it — just as curl
          would. The answer comes from the guard on the server, not from the check in the UI.
        </p>
        <button type="button" className="button" disabled={target === undefined} onClick={send}>
          PUT /api/posts/{target?.id ?? "—"} (a post by another user)
        </button>
        {result !== null && <p className="notice">{result}</p>}
      </section>
    </Access>
  );
}
