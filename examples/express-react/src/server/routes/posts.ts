import { Router, type Request, type RequestHandler } from "express";
import { BadRequestError, NotFoundError, can } from "@iushev/rbac-express";

import type { Post, PostInput } from "../../shared/api.js";
import { createPost, deletePost, findPost, listPosts, updatePost } from "../posts.js";

const loadPost: RequestHandler = (req, _res, next) => {
  const id = Number(req.params.id);
  const post = Number.isInteger(id) ? findPost(id) : null;
  if (post === null) {
    next(new NotFoundError(`No post with id ${req.params.id ?? ""}.`));
    return;
  }
  req.post = post;
  next();
};

/** Narrows the optional `req.post` after `loadPost` has run. */
function requirePost(req: Request): Post {
  if (!req.post) {
    throw new Error("req.post is missing. Mount loadPost before this handler.");
  }
  return req.post;
}

function readInput(body: unknown): PostInput {
  const { title, body: text } = (body ?? {}) as { title?: unknown; body?: unknown };
  if (typeof title !== "string" || title.trim() === "") {
    throw new BadRequestError('A non-empty "title" is required.');
  }
  if (typeof text !== "string") {
    throw new BadRequestError('A "body" string is required.');
  }
  return { title: title.trim(), body: text };
}

/** The post the guard is about, handed to its rule as a param. */
function postParams(req: Request) {
  return { post: requirePost(req) };
}

export function postsRoutes(): Router {
  const router = Router();

  router.get("/posts", can("viewPost"), (_req, res) => {
    res.json(listPosts());
  });

  router.post("/posts", can("createPost"), (req, res) => {
    res.status(201).json(createPost(req.rbacUser.username, readInput(req.body)));
  });

  /**
   * `loadPost` runs before the guard so the rule has something to judge: an
   * author reaches `updatePost` only through `updateOwnPost`, whose `isAuthor`
   * rule compares `params.post.authorId` with the username. An admin holds
   * `updatePost` directly and so passes for any post.
   */
  router.put("/posts/:id", loadPost, can("updatePost", { params: postParams }), (req, res) => {
    res.json(updatePost(requirePost(req), readInput(req.body)));
  });

  router.delete("/posts/:id", loadPost, can("deletePost", { params: postParams }), (req, res) => {
    deletePost(requirePost(req));
    res.status(204).end();
  });

  return router;
}
