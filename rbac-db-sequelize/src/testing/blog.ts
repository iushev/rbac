import { createPermission, createRole, RbacManager, RuleRegistry, type RuleFn } from "@iushev/rbac";
import type { Sequelize } from "sequelize";

import type { SequelizeRbacStore } from "../SequelizeRbacStore.js";
import { createStore } from "./db.js";

/**
 * The blog example from the `rbac` guide, built on PostgreSQL instead of memory.
 *
 * Deliberately a copy of `rbac/src/testing/blog.ts` rather than an import: that
 * directory is excluded from the `rbac` build and is not exported from its
 * `index.ts`, so it is not reachable from a dependent package.
 *
 *   admin  -> author
 *          -> updatePost                        (any post, no rule)
 *   author -> createPost
 *          -> updateOwnPost (rule: isAuthor) -> updatePost
 *          -> reader        -> viewPost
 *
 * `updatePost` itself carries no rule: an author reaches it only through
 * `updateOwnPost`, whose rule restricts it to their own posts, while an admin
 * reaches it directly and so may update any post.
 */
export async function buildBlogRbac(
  sequelize: Sequelize,
  options?: { rules?: Record<string, RuleFn> },
) {
  const store: SequelizeRbacStore = createStore(sequelize);
  const rules = new RuleRegistry({
    isAuthor: ({ username, params }) =>
      typeof params.post === "object" &&
      params.post !== null &&
      (params.post as { authorId?: unknown }).authorId === username,
    ...options?.rules,
  });
  const manager = new RbacManager({ store, rules });

  const viewPost = createPermission({ name: "viewPost" });
  const createPost = createPermission({ name: "createPost" });
  const updatePost = createPermission({ name: "updatePost" });
  const updateOwnPost = createPermission({ name: "updateOwnPost", ruleName: "isAuthor" });
  const reader = createRole({ name: "reader" });
  const author = createRole({ name: "author" });
  const admin = createRole({ name: "admin" });

  for (const item of [viewPost, createPost, updatePost, updateOwnPost, reader, author, admin]) {
    await manager.add(item);
  }

  await manager.addChild(reader, viewPost);
  await manager.addChild(author, reader);
  await manager.addChild(author, createPost);
  await manager.addChild(updateOwnPost, updatePost);
  await manager.addChild(author, updateOwnPost);
  await manager.addChild(admin, author);
  await manager.addChild(admin, updatePost);

  await manager.assign(reader, "bob");
  await manager.assign(author, "alice");
  await manager.assign(admin, "root");

  return {
    store,
    manager,
    rules,
    items: { viewPost, createPost, updatePost, updateOwnPost, reader, author, admin },
  };
}
