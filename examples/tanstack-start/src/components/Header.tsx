import { Link } from "@tanstack/react-router";
import { Access } from "@iushev/rbac-react";

import { UserSwitcher } from "./UserSwitcher.js";

export function Header() {
  return (
    <header>
      <nav>
        <Link to="/" activeProps={{ className: "active" }}>
          Posts
        </Link>
        <Link to="/guards" activeProps={{ className: "active" }}>
          Guards
        </Link>
        {/*
          The link is hidden for everyone but an admin — and hiding it protects
          nothing. `/admin` redirects a non-admin away and the server functions
          behind it refuse them; this only keeps the nav honest.
        */}
        <Access roles={["admin"]}>
          <Link to="/admin" activeProps={{ className: "active" }}>
            Admin
          </Link>
        </Access>
      </nav>
      <UserSwitcher />
    </header>
  );
}
