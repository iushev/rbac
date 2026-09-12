import { useState, type FormEvent } from "react";

import type { Post, PostInput } from "../../shared/api.js";
import { ApiError, api } from "../api.js";

interface Props {
  /** The post being edited, or nothing when the form creates a new one. */
  post?: Post;
  onDone: () => void;
  onCancel?: () => void;
}

export function PostForm({ post, onDone, onCancel }: Props) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const input: PostInput = { title, body };
    const request =
      post === undefined
        ? api<Post>("/posts", { method: "POST", body: JSON.stringify(input) })
        : api<Post>(`/posts/${post.id}`, { method: "PUT", body: JSON.stringify(input) });

    request
      .then(() => {
        setTitle(post?.title ?? "");
        setBody(post?.body ?? "");
        onDone();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof ApiError ? `${cause.status} — ${cause.message}` : String(cause));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <form className="form" onSubmit={submit}>
      <input
        className="form__input"
        value={title}
        placeholder="Title"
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <textarea
        className="form__input"
        value={body}
        placeholder="Text"
        rows={3}
        onChange={(event) => {
          setBody(event.target.value);
        }}
      />
      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={busy}>
          {post === undefined ? "Publish" : "Save"}
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        {error !== null && <span className="notice notice--error">{error}</span>}
      </div>
    </form>
  );
}
