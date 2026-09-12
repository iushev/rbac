import "@tanstack/react-start/server-only";

import { InMemoryRbacStore, RbacManager, createPermission, createRole } from "@iushev/rbac";

import { DEFAULT_ROLES, rules } from "../rbac/rules.js";

/**
 * The authorization graph of the demo blog:
 *
 *   admin  -> author
 *          -> updatePost, deletePost          (any post, no rule)
 *          -> manageRbac
 *   author -> reader -> viewPost
 *          -> createPost
 *          -> updateOwnPost (rule: isAuthor) -> updatePost
 *          -> deleteOwnPost (rule: isAuthor) -> deletePost
 *
 * `updatePost` carries no rule of its own: an author reaches it only through
 * `updateOwnPost`, whose rule narrows it to their own posts, while an admin
 * reaches it directly and so may edit anything.
 *
 * A real application would keep this in Postgres through `@iushev/rbac-db-sequelize`
 * or `@iushev/rbac-db-drizzle`; the store is the only thing that changes.
 */
async function buildRbac() {
  const store = new InMemoryRbacStore();
  // The same registry the browser checks with, which is what makes the two
  // answers about a rule-bearing permission the same answer.
  const manager = new RbacManager({ store, rules, defaultRoles: DEFAULT_ROLES });

  const viewPost = createPermission({ name: "viewPost", description: "Read posts" });
  const createPost = createPermission({
    name: "createPost",
    description: "Create a post",
  });
  const updatePost = createPermission({
    name: "updatePost",
    description: "Edit any post",
  });
  const deletePost = createPermission({
    name: "deletePost",
    description: "Delete any post",
  });
  const updateOwnPost = createPermission({
    name: "updateOwnPost",
    description: "Edit own post",
    ruleName: "isAuthor",
  });
  const deleteOwnPost = createPermission({
    name: "deleteOwnPost",
    description: "Delete own post",
    ruleName: "isAuthor",
  });
  const manageRbac = createPermission({
    name: "manageRbac",
    description: "Manage RBAC data",
  });

  const reader = createRole({ name: "reader", description: "Reader" });
  const author = createRole({ name: "author", description: "Author" });
  const admin = createRole({ name: "admin", description: "Administrator" });

  for (const item of [
    viewPost,
    createPost,
    updatePost,
    deletePost,
    updateOwnPost,
    deleteOwnPost,
    manageRbac,
    reader,
    author,
    admin,
  ]) {
    await manager.add(item);
  }

  await manager.addChild(reader, viewPost);
  await manager.addChild(updateOwnPost, updatePost);
  await manager.addChild(deleteOwnPost, deletePost);
  await manager.addChild(author, reader);
  await manager.addChild(author, createPost);
  await manager.addChild(author, updateOwnPost);
  await manager.addChild(author, deleteOwnPost);
  await manager.addChild(admin, author);
  await manager.addChild(admin, updatePost);
  await manager.addChild(admin, deletePost);
  await manager.addChild(admin, manageRbac);

  await manager.assign(reader, "bob");
  await manager.assign(author, "alice");
  await manager.assign(author, "banned");
  await manager.assign(admin, "root");

  return { store, manager };
}

/**
 * Built once per process, not once per request: the graph is application data,
 * not session data. Everything request-scoped — who is asking — is bound to it
 * later, by the `RbacUser` the guard middleware creates.
 */
let pending: ReturnType<typeof buildRbac> | null = null;

export function getRbac(): ReturnType<typeof buildRbac> {
  pending ??= buildRbac();
  return pending;
}
