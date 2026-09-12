#!/usr/bin/env node
// A committed entry point, rather than pointing `bin` straight at dist/cli.js:
// npm skips linking a bin whose target does not exist yet, and dist/ is built
// after install. This file always exists, so the link always gets made.
let main;
try {
  ({ main } = await import("../dist/cli.js"));
} catch (error) {
  const notBuilt =
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND" &&
    "url" in error &&
    typeof error.url === "string" &&
    error.url.endsWith("/dist/cli.js");
  if (!notBuilt) {
    throw error;
  }
  console.error("rbac-db-sequelize is not built. Run `npm run build -w rbac-db-sequelize`.");
  process.exit(1);
}

process.exitCode = await main(process.argv.slice(2), process.env);
