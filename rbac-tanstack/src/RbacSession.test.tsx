import { screen } from "@testing-library/react";
import { Can, useRbacUser } from "@iushev/rbac-react";
import { describe, expect, it } from "vitest";

import { RbacSession } from "./RbacSession.js";
import { toSessionState } from "./session.js";
import { buildBlogRbac, type Post } from "./testing/blog.js";
import { renderSuspended } from "./testing/render.js";
import { USERS } from "./testing/users.js";

const OWN_POST: Post = { id: 1, authorId: "alice" };
const OTHER_POST: Post = { id: 2, authorId: "bob" };

function Who() {
  const user = useRbacUser();
  return <span>{user.isGuest ? "guest" : user.username}</span>;
}

async function mount(username: keyof typeof USERS | null) {
  const { store, rules } = await buildBlogRbac();
  const session = await toSessionState(store, username && USERS[username]);

  return renderSuspended(
    <RbacSession session={session} rules={rules}>
      <Who />
      <Can permission="createPost">
        <span>write</span>
      </Can>
      <Can permission="updatePost" params={{ post: OWN_POST }}>
        <span>own post</span>
      </Can>
      <Can permission="updatePost" params={{ post: OTHER_POST }}>
        <span>other post</span>
      </Can>
    </RbacSession>,
  );
}

describe("RbacSession", () => {
  it("mounts a provider the hooks below it can read", async () => {
    await mount("alice");

    expect(await screen.findByText("alice")).toBeDefined();
  });

  it("answers the checks with the session's own assignments", async () => {
    await mount("alice");

    expect(await screen.findByText("write")).toBeDefined();
    expect(await screen.findByText("own post")).toBeDefined();
    expect(screen.queryByText("other post")).toBeNull();
  });

  it("shows a guest as a guest and hides everything", async () => {
    await mount(null);

    expect(await screen.findByText("guest")).toBeDefined();
    expect(screen.queryByText("write")).toBeNull();
  });

  it("renders nothing until the checker is ready, rather than a denial", async () => {
    const view = await mount("root");

    // A check that has not run yet must not read as "no", and an identity that
    // has not arrived must not read as "guest" — so the tree waits instead.
    expect(view.textBeforeSettled).toBe("");
    expect(await screen.findByText("root")).toBeDefined();
  });

  it("lets an admin past a rule the author is narrowed by", async () => {
    await mount("root");

    expect(await screen.findByText("other post")).toBeDefined();
  });
});
