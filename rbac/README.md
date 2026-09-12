# rbac

Role-based access control following the [NIST model](https://csrc.nist.gov/CSRC/media/Publications/conference-paper/2000/07/26/the-nist-model-for-role-based-access-control-towards-a-unified-/documents/sandhu-ferraiolo-kuhn-00.pdf) — Core + Hierarchical RBAC with rules.

The package has no runtime dependencies and works the same on the server and on the client
(web, React Native). The store is only an interface — implementations live in a separate
project.

## Install

```bash
npm install @iushev/rbac
```

## The two halves

**Building the data** (server) — `RbacManager` over `RbacManagerStore`:

```ts
import { RbacManager, createRole, createPermission } from "@iushev/rbac";

const manager = new RbacManager({ store });

const viewPost = createPermission({ name: "viewPost" });
const updatePost = createPermission({ name: "updatePost", ruleName: "isAuthor" });
const reader = createRole({ name: "reader" });
const author = createRole({ name: "author" });

for (const item of [viewPost, updatePost, reader, author]) {
  await manager.add(item);
}

await manager.addChild(reader, viewPost); // a role contains a permission
await manager.addChild(author, reader); // a role contains a role
await manager.addChild(author, updatePost);

await manager.assign(author, "alice");
```

The hierarchy is a partial order: `addChild` rejects a cycle and a role under a permission.

**Checking access** (server or client) — `CheckAccess`:

```ts
await manager.checkAccess({ username: "alice", itemName: "viewPost" }); // true, via reader
```

## Rules

A rule is code, not data. The store holds only its name and a text payload; the
implementations are registered at startup, the same way on both sides:

```ts
import { RuleRegistry } from "@iushev/rbac";

const rules = new RuleRegistry({
  isAuthor: ({ username, params }) => (params.post as Post).authorId === username,
});

const manager = new RbacManager({ store, rules });

await manager.checkAccess({
  username: "alice",
  itemName: "updatePost",
  params: { post },
}); // true only if alice is the author
```

If an item points to an unregistered rule, the check throws `UnknownRuleError`.

## Client side

The server serializes the graph with `toSnapshot`, the client loads it into
`InMemoryRbacStore` and checks access locally, without the network:

```ts
// server
const payload = {
  rbac: await toSnapshot(store),
  assignments: [...(await store.getAssignments(username)).values()],
};

// client (web / React Native)
const store = new InMemoryRbacStore(payload.rbac);
const checker = new CheckAccess({ store, rules });
```

`RbacUser` ties an identity to the checker and caches results of checks without params:

```ts
const user = new RbacUser(checker, identity);
await user.can({ permissionName: "viewPost" });
```

`matchRole` covers the common "this screen is for these roles" case, with `"?"` for a guest
and `"@"` for a logged-in user.

## Store

Two interfaces, defined here and implemented elsewhere:

- `RbacStore` — read-only (8 methods). That is all an access check needs, and all a client
  has to implement.
- `RbacManagerStore extends RbacStore` — adds the mutations for building the data; server
  only.

`InMemoryRbacStore` is a full implementation of `RbacManagerStore` — for the client and for
tests. Logic that doesn't depend on the backend (cycle detection, the ban on a role under a
permission) is in `RbacManager`, so it isn't repeated in every implementation.

## Migrating from `@iushev/rbac`

The vocabulary is the same; three differences:

| `@iushev/rbac`                  | here                              |
| ------------------------------- | --------------------------------- |
| `new Role({ name })`            | `createRole({ name })`            |
| `class extends BaseManager`     | `implements RbacManagerStore`     |
| `Rule` subclass + `Rule.init()` | `RuleRegistry.register(name, fn)` |

`Role` and `Permission` are now interfaces, not classes: an item that came over the network
is a plain object and `instanceof` on it is always `false`. Distinguish by `item.type`
(`isRole` / `isPermission`).

The Express middleware is not part of this package — it belongs to a server adapter on top
of it.

## Development

```bash
npm run build      # compiles src/ -> dist/
npm run dev        # tsc --watch
npm run typecheck  # type check without emit
npm test           # vitest
npm run lint       # eslint (typed rules)
npm run format     # prettier --write
```

The package has no runtime dependencies — everything external is in `devDependencies`.
