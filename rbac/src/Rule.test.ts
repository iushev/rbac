import { describe, expect, it } from "vitest";

import { createRole } from "./Item.js";
import { RuleRegistry, UnknownRuleError, createRule } from "./Rule.js";

const context = () => ({
  username: "alice",
  item: createRole({ name: "author" }),
  params: {},
  data: null,
});

describe("RuleRegistry", () => {
  it("registers and runs a rule", async () => {
    const registry = new RuleRegistry({ always: () => true });

    await expect(registry.execute("always", context())).resolves.toBe(true);
  });

  it("awaits an async rule", async () => {
    const registry = new RuleRegistry({ later: () => Promise.resolve(false) });

    await expect(registry.execute("later", context())).resolves.toBe(false);
  });

  it("refuses to overwrite a rule by accident", () => {
    const registry = new RuleRegistry({ always: () => true });

    expect(() => registry.register("always", () => false)).toThrow(/already registered/);
  });

  it("overwrites when explicitly asked", async () => {
    const registry = new RuleRegistry({ always: () => true });

    registry.register("always", () => false, { override: true });

    await expect(registry.execute("always", context())).resolves.toBe(false);
  });

  it("throws UnknownRuleError naming the missing rule", async () => {
    const registry = new RuleRegistry();

    await expect(registry.execute("nosuch", context())).rejects.toMatchObject({
      name: "UnknownRuleError",
      ruleName: "nosuch",
    });
    await expect(registry.execute("nosuch", context())).rejects.toBeInstanceOf(UnknownRuleError);
  });

  it("unregisters and clears", () => {
    const registry = new RuleRegistry({ a: () => true, b: () => true });

    expect(registry.unregister("a")).toBe(true);
    expect(registry.unregister("a")).toBe(false);
    expect(registry.size).toBe(1);

    registry.clear();
    expect(registry.has("b")).toBe(false);
  });
});

describe("createRule", () => {
  it("defaults data to null", () => {
    expect(createRule("isAuthor")).toEqual({ name: "isAuthor", data: null });
  });
});
