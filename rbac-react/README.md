# rbac-react

React bindings over [`rbac`](../rbac) — components and hooks that show part of the
interface only to a user who has access to it.

## Install

```bash
npm install @iushev/rbac-react
```

`react` (18 or 19) and `@iushev/rbac` are peer dependencies:

```bash
npm install react @iushev/rbac
```

## Usage

A single provider at the top holds the `RbacUser`, after which `<Can>` and `<Access>` are
placed around whatever shouldn't be visible to everyone:

```tsx
import { CheckAccess } from "@iushev/rbac";
import { RbacProvider, Can, Access } from "@iushev/rbac-react";

const checkAccess = new CheckAccess({ store, rules });

function App({ session }) {
  return (
    <RbacProvider accessChecker={checkAccess} identity={session.user ?? null}>
      <Toolbar />
    </RbacProvider>
  );
}

function Toolbar() {
  return (
    <>
      <Can permission="createPost">
        <NewPostButton />
      </Can>

      <Access roles={["admin"]} fallback={<p>Administrators only.</p>}>
        <AdminPanel />
      </Access>
    </>
  );
}
```

`identity` is `{ username, isActive, isSuperuser }`, or `null` for a guest. This is where
the application's authentication hooks in — session, JWT, whatever you use; the package
doesn't authenticate.

### `<Can permission={...}>`

Renders its children if the user holds the permission — directly or through the role
hierarchy. Otherwise it renders `fallback`, and by default `fallback` is `null`, i.e.
**nothing**.

```tsx
<Can permission="updatePost" params={{ post }} fallback={<p>No access.</p>}>
  <EditPostForm post={post} />
</Can>
```

| Prop           | Default | What it does                                              |
| -------------- | ------- | --------------------------------------------------------- |
| `permission`   | —       | the name of the permission or role                        |
| `children`     | —       | what is rendered when access is granted                   |
| `fallback`     | `null`  | what is rendered when access is denied                    |
| `pending`      | `null`  | what is rendered while the check is running               |
| `params`       | `{}`    | the parameters passed on to the rule                      |
| `allowCaching` | `true`  | passed to `RbacUser.can`; irrelevant when `params` is set |
| `logging`      | —       | a logger for the check                                    |

### `<Access roles={[...]}>`

The same, but against a list of roles — it passes on a match with **any** of them. Two
names are special: `"?"` matches a guest, `"@"` any authenticated user, and an empty list
matches everyone.

```tsx
<Access roles={["?"]}>
  <LoginLink />
</Access>

<Access roles={["banned"]} allow={false}>
  <CommentBox />
</Access>
```

`allow={false}` turns the list into a deny list.

### The check is asynchronous

That's why the first render of every check is `pending`, not a denial. `pending` is a
separate prop on purpose: a "no access" message must not flash in front of a user who does
end up having access. The empty default means that without `pending` nothing is rendered
until the answer arrives.

### Hooks

When the decision isn't "render or not" — say, a disabled button or choosing a route —
the hooks give the same answer directly:

```tsx
const { allowed, isLoading, error } = useCan("updatePost", { params: { post } });
const { allowed } = useAccess(["admin", "author"]);

<button disabled={!allowed || isLoading}>Publish</button>;
```

`params` and `roles` are compared shallowly against the previous render, so an object or
array written inline in JSX doesn't restart the check on every render.

### `useRbacUser()` and `refresh()`

```tsx
const user = useRbacUser(); // the RbacUser itself — user.identity is your user
const { refresh } = useRbac();
```

`refresh()` drops the access cache and reruns every mounted check. Call it after the
authorization data has changed (for example, after the admin panel has granted a new
role) — otherwise the tree keeps showing the old answer.

Changing the `identity` prop creates a new `RbacUser` and by itself already recomputes
everything; `refresh()` is for the case where the data itself has changed.

### Your own `RbacUser`

If the application already holds an `RbacUser` (for example, one shared with server code),
pass it in directly:

```tsx
<RbacProvider user={rbacUser}>
  <App />
</RbacProvider>
```

In that case React doesn't see an `identity` change on the object — after such a change,
call `refresh()`.

### The user type

`identity` is `RbacIdentity` — an interface the application extends on its side:

```ts
declare module "@iushev/rbac-react" {
  interface RbacIdentity {
    id: number;
    email: string;
  }
}
```

After that, `useRbacUser().identity` is typed with your fields.

## Errors

Denied access and broken configuration are not the same thing. If the check fails — for
example because an item points to an unregistered rule and `checkAccess` throws
`UnknownRuleError` — `<Can>` and `<Access>` **throw** the error upward instead of
rendering `fallback`. It belongs in an error boundary, not in the "you don't have access"
UI.

The hooks don't throw: they return it in `error` for you to handle yourself.

## This is not protection

The check runs in the browser, on data the browser can see. A hidden button is a
convenience for the user, not a security measure — the real check is on the server, at the
endpoint. See [`rbac-express`](../rbac-express).

## Tests

```bash
npm test
npm run typecheck
npm run lint
```
