#!/usr/bin/env node
// Puts every workspace package on one version and points the @iushev/* ranges between them at it.
// `npm version <v> --workspaces` only rewrites each package's own "version" field and leaves
// sibling ranges such as "^0.1.0" behind — and under 0.x a caret admits patch releases only,
// so a minor bump of rbac-react alone would break rbac-tanstack's peer dependency.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEP_FIELDS = ["dependencies", "peerDependencies", "devDependencies", "optionalDependencies"];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const BUMPS = ["major", "minor", "patch"];

function fail(message) {
  console.error(`release:version: ${message}`);
  process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((arg) => arg !== "--dry-run");
if (positional.length !== 1) {
  fail("usage: npm run release:version -- <x.y.z | major | minor | patch> [--dry-run]");
}
const [target] = positional;

const packages = readJson(join(root, "package.json")).workspaces.map((dir) => {
  const file = join(root, dir, "package.json");
  return { dir, file, pkg: readJson(file) };
});
const names = new Set(packages.map(({ pkg }) => pkg.name));

function resolveVersion() {
  if (SEMVER.test(target)) return target;
  if (!BUMPS.includes(target)) fail(`"${target}" is neither x.y.z nor major | minor | patch`);

  // A bump is only meaningful from a shared starting point; with mixed versions the result
  // would depend on which package we happened to read first.
  const current = new Set(packages.map(({ pkg }) => pkg.version));
  if (current.size !== 1) {
    fail(`packages are on different versions (${[...current].join(", ")}); pass an exact x.y.z`);
  }
  const [base] = current;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(base);
  if (!match) fail(`cannot ${target}-bump prerelease ${base}; pass an exact x.y.z`);

  const [major, minor, patch] = match.slice(1).map(Number);
  if (target === "major") return `${major + 1}.0.0`;
  if (target === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const version = resolveVersion();
const range = `^${version}`;

for (const { dir, file, pkg } of packages) {
  const changes = [];
  if (pkg.version !== version) changes.push(`version ${pkg.version} → ${version}`);
  pkg.version = version;

  for (const field of DEP_FIELDS) {
    const deps = pkg[field] ?? {};
    for (const name of Object.keys(deps)) {
      if (!names.has(name) || deps[name] === range) continue;
      changes.push(`${field}.${name} ${deps[name]} → ${range}`);
      deps[name] = range;
    }
  }

  console.log(`${pkg.name} (${dir})`);
  for (const change of changes.length > 0 ? changes : ["unchanged"]) console.log(`  ${change}`);
  if (!dryRun) writeJson(file, pkg);
}

// Workspace and file: dependencies are symlinks, so node_modules needs nothing; only the
// lockfiles keep a copy of each package's version. The examples are not workspaces and
// carry lockfiles of their own.
const examplesDir = join(root, "examples");
const lockDirs = [
  root,
  ...(existsSync(examplesDir) ? readdirSync(examplesDir, { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(examplesDir, entry.name))
    .filter((dir) => existsSync(join(dir, "package.json"))),
];
const label = (dir) => relative(root, dir) || ".";

if (dryRun) {
  console.log(
    `\ndry run: nothing written; lockfiles to refresh: ${lockDirs.map(label).join(", ")}`,
  );
  process.exit(0);
}

for (const cwd of lockDirs) {
  console.log(`\nnpm install --package-lock-only (${label(cwd)})`);
  execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts"], {
    cwd,
    stdio: "inherit",
  });
}

console.log(`\nAll packages are on ${version}. Nothing is committed or tagged — review git diff,`);
console.log(`then commit and tag v${version}.`);
