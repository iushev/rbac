import "@tanstack/react-start/server-only";

import type { Post, PostInput } from "../types.js";

let nextId = 1;

const posts: Post[] = [];

function seed(authorId: string, title: string, body: string): void {
  posts.push({
    id: nextId++,
    title,
    body,
    authorId,
    createdAt: new Date().toISOString(),
  });
}

seed("alice", "Hierarchy in NIST RBAC", "Roles inherit the permissions of their children.");
seed("alice", "Rules are code", "The store holds only the name of a rule, not its logic.");
seed("bob", "First impressions", "I have been reading the blog since yesterday.");
seed("root", "Community rules", "Be kind to one another.");

export function listPosts(): Post[] {
  return [...posts].sort((a, b) => b.id - a.id);
}

export function findPost(id: number): Post | null {
  return posts.find((post) => post.id === id) ?? null;
}

export function createPost(authorId: string, input: PostInput): Post {
  const post: Post = {
    id: nextId++,
    title: input.title,
    body: input.body,
    authorId,
    createdAt: new Date().toISOString(),
  };
  posts.push(post);
  return post;
}

export function updatePost(post: Post, input: PostInput): Post {
  post.title = input.title;
  post.body = input.body;
  return post;
}

export function deletePost(post: Post): void {
  const index = posts.indexOf(post);
  if (index >= 0) {
    posts.splice(index, 1);
  }
}
