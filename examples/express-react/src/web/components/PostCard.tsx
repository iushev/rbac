import { useState } from "react";
import { Can } from "@iushev/rbac-react";

import type { Post } from "../../shared/api.js";
import { ApiError, api } from "../api.js";
import { PostForm } from "./PostForm.js";

interface Props {
  post: Post;
  onChanged: () => void;
}

/**
 * The whole point of the example in one component.
 *
 * `params={{ post }}` reaches the `isAuthor` rule, so the buttons appear for an
 * author only on their own posts, while an admin — who holds `updatePost`
 * directly — sees them everywhere. The same question, with the same rule code,
 * is asked again by the guard on the server when the button is pressed.
 *
 * `pending` is separate from `fallback` on purpose: falling back while the
 * asynchronous check is still running would flash "no access" at users who
 * turn out to have it.
 */
export function PostCard({ post, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setError(null);
    api<void>(`/posts/${post.id}`, { method: "DELETE" })
      .then(onChanged)
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? `${cause.status} — ${cause.message}` : String(cause));
      });
  };

  return (
    <article className="card">
      <header className="card__header">
        <h3 className="card__title">{post.title}</h3>
        <span className="card__meta">by {post.authorId}</span>
      </header>

      {editing ? (
        <PostForm
          post={post}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
      ) : (
        <p className="card__body">{post.body}</p>
      )}

      <footer className="card__actions">
        <Can permission="updatePost" params={{ post }} pending={<span className="muted">…</span>}>
          <button
            type="button"
            className="button"
            onClick={() => {
              setEditing((value) => !value);
            }}
          >
            Edit
          </button>
        </Can>

        <Can permission="deletePost" params={{ post }}>
          <button type="button" className="button button--danger" onClick={remove}>
            Delete
          </button>
        </Can>

        {error !== null && <span className="notice notice--error">{error}</span>}
      </footer>
    </article>
  );
}
