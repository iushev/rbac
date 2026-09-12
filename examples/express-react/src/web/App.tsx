import { Access, Can } from "@iushev/rbac-react";

import { AdminPanel } from "./components/AdminPanel.js";
import { GuardDemo } from "./components/GuardDemo.js";
import { PostCard } from "./components/PostCard.js";
import { PostForm } from "./components/PostForm.js";
import { UserSwitcher } from "./components/UserSwitcher.js";
import { useSession } from "./session.js";
import { usePosts } from "./usePosts.js";

function Blog() {
  const { user } = useSession();
  const { posts, error, isLoading, reload } = usePosts();

  return (
    <section className="blog">
      {/* No params: a parameterless check is cached per user for the whole session. */}
      <Can permission="createPost">
        <PostForm
          onDone={() => {
            void reload();
          }}
        />
      </Can>

      {error?.isUnauthorized && (
        <p className="notice">
          You are a guest. The list is behind <code>can(&quot;viewPost&quot;)</code>, and the guard
          answers a guest with 401 — not 403, because the request would pass with an identity.
        </p>
      )}
      {error?.isForbidden &&
        (user !== null && !user.isActive ? (
          <p className="notice notice--error">
            403 — the user is <code>isActive: false</code>. An inactive user is denied on every
            check, without the store even being asked. Sign-out in the top right works — it is
            session state, not a permission.
          </p>
        ) : (
          <p className="notice notice--error">
            403 — you are signed in, but you do not have <code>viewPost</code>.
          </p>
        ))}

      {isLoading && <p className="notice">Loading…</p>}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onChanged={() => {
            void reload();
          }}
        />
      ))}

      <GuardDemo
        posts={posts}
        onChanged={() => {
          void reload();
        }}
      />
    </section>
  );
}

export function App() {
  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="header__title">Blog with RBAC</h1>
          <p className="header__subtitle">
            One graph, two sides: <code>@iushev/rbac-express</code> protects the routes,{" "}
            <code>@iushev/rbac-react</code> shapes the UI.
          </p>
        </div>
        <UserSwitcher />
      </header>

      <main className="main">
        <Blog />

        <Access roles={["admin"]}>
          <AdminPanel />
        </Access>
      </main>
    </div>
  );
}
