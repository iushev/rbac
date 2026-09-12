/**
 * The sign-in picker of the demo. A real application would have a password
 * form here; the usernames are the ones seeded in `src/server/users.ts`.
 */
export const DEMO_USERS = [
  { username: "bob", label: "Bob", hint: "reader — read-only" },
  { username: "alice", label: "Alice", hint: "author — writes and edits own posts" },
  { username: "root", label: "Root", hint: "admin — can do everything with posts and RBAC" },
  { username: "su", label: "Su", hint: "superuser — passes every check" },
  { username: "banned", label: "Banned", hint: "author, but isActive: false" },
] as const;
