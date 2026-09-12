import { createServerFn } from "@tanstack/react-start";
import { can, requireCan } from "@iushev/rbac-tanstack";

import * as posts from "../server/posts.js";
import { rbac } from "../server/rbac.js";
import type { Post, PostInput } from "../types.js";

/**
 * The security boundary of the example. Every mutation below is reachable by
 * anyone who can open the browser console — the UI hiding a button is what
 * makes the app pleasant, the guard is what makes it safe.
 */

function readInput(value: unknown): PostInput {
  const { title, body } = (value ?? {}) as { title?: unknown; body?: unknown };
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error('The "title" field is required.');
  }
  if (typeof body !== "string") {
    throw new Error('The "body" field is required.');
  }
  return { title: title.trim(), body };
}

/** Loads the post the guard is about, so its rule has something to judge. */
function loadPost(id: number): Post {
  const post = posts.findPost(id);
  if (post === null) {
    throw new Error(`No post with id ${id}.`);
  }
  return post;
}

export const listPosts = createServerFn({ method: "GET" })
  .middleware([rbac, can("viewPost")])
  .handler(() => posts.listPosts());

export const createPost = createServerFn({ method: "POST" })
  .middleware([rbac, can("createPost")])
  .validator(readInput)
  .handler(({ context, data }) => posts.createPost(context.rbacUser.username, data));

/**
 * The check lives in the handler, not in the middleware array, because the
 * post has to be loaded before it: an author reaches `updatePost` only through
 * `updateOwnPost`, whose `isAuthor` rule compares `params.post.authorId` with
 * the username. An admin holds `updatePost` directly and so passes for any post.
 */
export const updatePost = createServerFn({ method: "POST" })
  .middleware([rbac])
  .validator((value: { id: number } & PostInput) => value)
  .handler(async ({ context, data }) => {
    const post = loadPost(data.id);
    await requireCan(context.rbacUser, "updatePost", { post });
    return posts.updatePost(post, readInput(data));
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([rbac])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const post = loadPost(id);
    await requireCan(context.rbacUser, "deletePost", { post });
    posts.deletePost(post);
    return { id };
  });
