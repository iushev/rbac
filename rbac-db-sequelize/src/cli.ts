import { Sequelize } from "sequelize";

import { DEFAULT_TABLE_PREFIX } from "./tableNames.js";
import type { RbacMigrator, RbacMigratorOptions } from "./umzug.js";

export const COMMANDS = [
  "status",
  "migrate",
  "migrate-next",
  "migrate-down",
  "migrate-prev",
] as const;

export type Command = (typeof COMMANDS)[number];

export interface CliOptions {
  command: Command;
  url: string;
  tablePrefix: string;
  schema?: string;
  metaTableName?: string;
  quiet: boolean;
}

const USAGE = `rbac-db-sequelize-migrate <command> [options]

Commands:
  status         Print the current, executed and pending migrations as JSON
  migrate        Apply every pending migration
  migrate-next   Apply the next pending migration only
  migrate-prev   Revert the most recently applied migration
  migrate-down   Revert every applied migration

Options:
  --url <url>            Connection string. Env: RBAC_DB_URL, DATABASE_URL
  --table-prefix <p>     Table prefix. Env: RBAC_DB_TABLE_PREFIX (default ${DEFAULT_TABLE_PREFIX})
  --schema <name>        PostgreSQL schema. Env: RBAC_DB_SCHEMA
  --meta-table <name>    Table recording applied migrations (default <prefix>migration)
  --quiet                Only report errors
  -h, --help             Print this message

The prefix and schema must match the ones passed to SequelizeRbacStore.`;

/** Thrown for anything the user can fix by retyping the command. */
export class CliError extends Error {}

const FLAGS_WITH_VALUE = {
  "--url": "url",
  "--table-prefix": "tablePrefix",
  "--schema": "schema",
  "--meta-table": "metaTableName",
} as const;

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

/**
 * Parses argv (without the node and script entries).
 *
 * Returns `undefined` for `--help`, which is a successful run that prints usage
 * rather than a parse result to act on.
 */
export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv): CliOptions | undefined {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return undefined;
  }

  const values: Partial<Record<(typeof FLAGS_WITH_VALUE)[keyof typeof FLAGS_WITH_VALUE], string>> =
    {};
  let command: Command | undefined;
  let quiet = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;

    if (arg === "--quiet") {
      quiet = true;
      continue;
    }

    if (arg in FLAGS_WITH_VALUE) {
      const key = FLAGS_WITH_VALUE[arg as keyof typeof FLAGS_WITH_VALUE];
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new CliError(`${arg} needs a value.`);
      }
      values[key] = value;
      i++;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CliError(`Unknown option: ${arg}`);
    }

    if (command) {
      throw new CliError(`Unexpected argument: ${arg}`);
    }
    if (!isCommand(arg)) {
      throw new CliError(`Unknown command: ${arg}. Expected one of ${COMMANDS.join(", ")}.`);
    }
    command = arg;
  }

  if (!command) {
    throw new CliError(`No command given. Expected one of ${COMMANDS.join(", ")}.`);
  }

  const url = values.url ?? env["RBAC_DB_URL"] ?? env["DATABASE_URL"];
  if (!url) {
    throw new CliError("No connection string. Pass --url or set RBAC_DB_URL / DATABASE_URL.");
  }

  return {
    command,
    url,
    tablePrefix: values.tablePrefix ?? env["RBAC_DB_TABLE_PREFIX"] ?? DEFAULT_TABLE_PREFIX,
    schema: values.schema ?? env["RBAC_DB_SCHEMA"],
    metaTableName: values.metaTableName,
    quiet,
  };
}

export type Log = (message: string) => void;

/** Runs one command against an already-configured migrator. */
export async function runCommand(
  migrator: RbacMigrator,
  command: Command,
  log: Log,
): Promise<void> {
  const names = (metas: { name: string }[]): string[] => metas.map((meta) => meta.name);

  switch (command) {
    case "status": {
      const executed = names(await migrator.executed());
      const pending = names(await migrator.pending());
      log(
        JSON.stringify(
          { current: executed[executed.length - 1] ?? null, executed, pending },
          null,
          2,
        ),
      );
      return;
    }
    case "migrate": {
      const applied = names(await migrator.up());
      log(applied.length ? `Applied: ${applied.join(", ")}` : "Nothing to apply.");
      return;
    }
    case "migrate-next": {
      const applied = names(await migrator.up({ step: 1 }));
      log(applied.length ? `Applied: ${applied.join(", ")}` : "Nothing to apply.");
      return;
    }
    case "migrate-prev": {
      const reverted = names(await migrator.down({ step: 1 }));
      log(reverted.length ? `Reverted: ${reverted.join(", ")}` : "Already at the initial state.");
      return;
    }
    case "migrate-down": {
      const reverted = names(await migrator.down({ to: 0 }));
      log(reverted.length ? `Reverted: ${reverted.join(", ")}` : "Already at the initial state.");
      return;
    }
  }
}

/**
 * A line worth printing for an error.
 *
 * Sequelize's connection errors carry an empty `message` and put the useful
 * part in `name` and `original.code`, so `error.message` alone prints a blank
 * line for the most common failure the CLI has.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const code = (error as { original?: { code?: string } }).original?.code;
  const described = error.message || error.name;
  return code && !described.includes(code) ? `${described} (${code})` : described;
}

/**
 * Loads the migrator lazily.
 *
 * `umzug` is an optional peer dependency, so a static import would turn a
 * missing install into an unreadable module-resolution stack trace.
 */
async function loadCreateMigrator(): Promise<(options: RbacMigratorOptions) => RbacMigrator> {
  try {
    const { createRbacMigrator } = await import("./umzug.js");
    return createRbacMigrator;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      throw new CliError("This command needs umzug. Install it with `npm install umzug`.");
    }
    throw error;
  }
}

export async function main(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<number> {
  let options: CliOptions | undefined;
  try {
    options = parseArgs(argv, env);
  } catch (error) {
    console.error(describeError(error));
    console.error(`\n${USAGE}`);
    return 1;
  }

  if (!options) {
    console.log(USAGE);
    return 0;
  }

  const log: Log = options.quiet
    ? () => undefined
    : (message) => {
        console.log(message);
      };
  const createMigrator = await loadCreateMigrator();
  // The one place in the package that opens its own connection: a CLI has no
  // application around it to hand one in.
  const sequelize = new Sequelize(options.url, { logging: false });

  try {
    await sequelize.authenticate();
    const migrator = createMigrator({
      sequelize,
      tablePrefix: options.tablePrefix,
      schema: options.schema,
      metaTableName: options.metaTableName,
    });
    await runCommand(migrator, options.command, log);
    return 0;
  } catch (error) {
    console.error(describeError(error));
    return 1;
  } finally {
    await sequelize.close();
  }
}
