import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Can } from "@iushev/rbac-react";

import { deletePost, updatePost } from "../fn/posts.js";
import type { Post, PostInput } from "../types.js";
import { Denial } from "./Denial.js";
import { PostForm } from "./PostForm.js";

/**
 * One post, with the controls the current user may actually use.
 *
 * `params={{ post }}` is what makes the difference between an author and an
 * admin visible: `updatePost` is reached through `updateOwnPost` for the first
 * — whose `isAuthor` rule compares the post against the username — and held
 * directly by the second. The same question, with the same params, is asked
 * again by the guard behind `updatePost` below.
 */
export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const save_ = useServerFn(updatePost);
  const remove_ = useServerFn(deletePost);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function save(input: PostInput): Promise<void> {
    setError(null);
    try {
      await save_({ data: { id: post.id, ...input } });
      setEditing(false);
      await router.invalidate();
    } catch (cause) {
      setError(cause);
    }
  }

  async function remove(): Promise<void> {
    setError(null);
    try {
      await remove_({ data: post.id });
      await router.invalidate();
    } catch (cause) {
      setError(cause);
    }
  }

  return (
    <article className="post">
      <h3>{post.title}</h3>
      <p className="meta">
        {post.authorId} · {new Date(post.createdAt).toLocaleString("en-US")}
      </p>
      {editing ? (
        <PostForm
          initial={{ title: post.title, body: post.body }}
          submitLabel="Save"
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p>{post.body}</p>
      )}

      <div className="row">
        {/*
          `pending` — not `fallback` — is what the first render shows: the check
          is asynchronous, and "no access" must not flash at a user who turns
          out to have it. On the server render it is all there is, since effects
          do not run there; the buttons appear on hydration.
        */}
        <Can permission="updatePost" params={{ post }} pending={<span className="skeleton" />}>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </Can>
        <Can permission="deletePost" params={{ post }} pending={<span className="skeleton" />}>
          <button type="button" className="danger" onClick={() => void remove()}>
            Delete
          </button>
        </Can>
      </div>

      {error !== null && <Denial error={error} />}
    </article>
  );
}
