import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Access, Can } from "@iushev/rbac-react";

import { Denial } from "../components/Denial.js";
import { PostCard } from "../components/PostCard.js";
import { PostForm } from "../components/PostForm.js";
import { createPost, listPosts } from "../fn/posts.js";
import type { PostInput } from "../types.js";

export const Route = createFileRoute("/")({
  /**
   * The list is behind `viewPost`, so the loader itself can be refused. A
   * guest holds nothing at all in this graph and gets a 401 here — which is
   * why the page has an `errorComponent` and not just an empty list.
   */
  loader: () => listPosts(),
  component: PostsRoute,
  errorComponent: ({ error }) => (
    <>
      <Denial error={error} />
      <Access roles={["?"]}>
        <p>Sign in as one of the demo users in the top right.</p>
      </Access>
    </>
  ),
});

function PostsRoute() {
  const posts = Route.useLoaderData();
  const router = useRouter();
  const add_ = useServerFn(createPost);
  const [error, setError] = useState<unknown>(null);

  async function add(input: PostInput): Promise<void> {
    setError(null);
    try {
      await add_({ data: input });
      await router.invalidate();
    } catch (cause) {
      setError(cause);
    }
  }

  return (
    <>
      <h2>Posts</h2>

      <Can
        permission="createPost"
        fallback={<p className="notice">You do not have permission to write posts.</p>}
        pending={<p className="notice">Checking…</p>}
      >
        <PostForm submitLabel="Publish" onSubmit={add} />
      </Can>
      {error !== null && <Denial error={error} />}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </>
  );
}
