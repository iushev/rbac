import { access, constants, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { CliError, parseArgs, runCommand, type Command } from "./cli.js";
import { createRbacMigrator } from "./migrator.js";
import { connect, hasTestDatabase, type TestConnection } from "./testing/db.js";
import { tableRef } from "./tableNames.js";

describe("parseArgs", () => {
  const env = { RBAC_DB_URL: "postgres://env/db" };

  it("defaults everything but the command and the url", () => {
    expect(parseArgs(["status"], env)).toEqual({
      command: "status",
      url: "postgres://env/db",
      tablePrefix: "rbac_",
      schema: undefined,
      metaTableName: undefined,
      quiet: false,
    });
  });

  it("prefers flags over the environment", () => {
    const options = parseArgs(
      ["migrate", "--url", "postgres://flag/db", "--table-prefix", "app_", "--schema", "auth"],
      { ...env, RBAC_DB_TABLE_PREFIX: "env_", RBAC_DB_SCHEMA: "envschema" },
    );
    expect(options).toMatchObject({
      url: "postgres://flag/db",
      tablePrefix: "app_",
      schema: "auth",
    });
  });

  it("falls back to DATABASE_URL", () => {
    expect(parseArgs(["status"], { DATABASE_URL: "postgres://fallback/db" })?.url).toBe(
      "postgres://fallback/db",
    );
  });

  it("reads --quiet and --meta-table", () => {
    expect(parseArgs(["status", "--quiet", "--meta-table", "my_meta"], env)).toMatchObject({
      quiet: true,
      metaTableName: "my_meta",
    });
  });

  it("treats help and an empty argv as a usage request", () => {
    expect(parseArgs([], env)).toBeUndefined();
    expect(parseArgs(["--help"], env)).toBeUndefined();
    expect(parseArgs(["-h"], env)).toBeUndefined();
  });

  it.each([
    [["oops"], /Unknown command: oops/],
    [["status", "extra"], /Unexpected argument: extra/],
    [["status", "--nope"], /Unknown option: --nope/],
    [["status", "--url"], /--url needs a value/],
    [["status", "--url", "--quiet"], /--url needs a value/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseArgs(argv, env)).toThrow(CliError);
    expect(() => parseArgs(argv, env)).toThrow(message);
  });

  it("requires a connection string", () => {
    expect(() => parseArgs(["status"], {})).toThrow(/No connection string/);
  });
});

describe("the bin entry point", () => {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

  // npm silently skips linking a bin whose target is missing, so `bin` has to
  // point at a committed file rather than at anything under dist/.
  it("points at a committed file that exists", async () => {
    const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
      bin: Record<string, string>;
    };
    const target = manifest.bin["rbac-db-drizzle-migrate"];

    expect(target).toBeDefined();
    expect(target).not.toMatch(/(^|\/)dist\//);
    await expect(
      access(resolve(packageRoot, target as string), constants.F_OK),
    ).resolves.toBeUndefined();
  });
});

/** Own prefix, so the suite never touches the tables the other suites use. */
const tablePrefix = "clitest_";
const migration = "20260908183000-create-rbac-tables";

describe.skipIf(!hasTestDatabase)("runCommand", () => {
  const connection: TestConnection = hasTestDatabase ? connect() : (undefined as never);

  async function run(command: Command): Promise<string[]> {
    const lines: string[] = [];
    await runCommand(createRbacMigrator({ db: connection.db, tablePrefix }), command, (line) =>
      lines.push(line),
    );
    return lines;
  }

  const status = async (): Promise<{
    current: string | null;
    executed: string[];
    pending: string[];
  }> => JSON.parse((await run("status"))[0] as string) as never;

  beforeEach(async () => {
    for (const name of ["rules", "items", "item_children", "assignments", "migrations"]) {
      await connection.db.execute(
        sql`DROP TABLE IF EXISTS ${tableRef(`${tablePrefix}${name}`)} CASCADE`,
      );
    }
  });

  afterAll(async () => {
    await connection.close();
  });

  it("reports the initial status", async () => {
    expect(await status()).toEqual({ current: null, executed: [], pending: [migration] });
  });

  it("migrate applies everything and is a no-op afterwards", async () => {
    expect(await run("migrate")).toEqual([`Applied: ${migration}`]);
    expect(await status()).toEqual({ current: migration, executed: [migration], pending: [] });
    expect(await run("migrate")).toEqual(["Nothing to apply."]);
  });

  it("migrate-next applies one at a time", async () => {
    expect(await run("migrate-next")).toEqual([`Applied: ${migration}`]);
    expect(await run("migrate-next")).toEqual(["Nothing to apply."]);
  });

  it("migrate-prev reverts the last one", async () => {
    await run("migrate");
    expect(await run("migrate-prev")).toEqual([`Reverted: ${migration}`]);
    expect(await run("migrate-prev")).toEqual(["Already at the initial state."]);
    expect((await status()).pending).toEqual([migration]);
  });

  it("migrate-down reverts everything", async () => {
    await run("migrate");
    expect(await run("migrate-down")).toEqual([`Reverted: ${migration}`]);
    expect(await status()).toEqual({ current: null, executed: [], pending: [migration] });
  });
});
