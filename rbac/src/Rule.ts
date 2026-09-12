import type { Item } from "./Item.js";

/** Name-value pairs passed into `checkAccess` and forwarded to rules. */
export type RuleParams = Record<string, unknown>;

/**
 * The persisted shape of a rule.
 *
 * Only the name and a text payload are stored; the code that decides the
 * outcome lives in a {@link RuleRegistry}, so nothing executable is ever
 * written to storage or sent over the wire.
 */
export interface Rule {
  name: string;
  data: string | null;
}

export function createRule(name: string, data?: string | null): Rule {
  return { name, data: data ?? null };
}

export function cloneRule(rule: Rule): Rule {
  return { ...rule };
}

/** Everything a rule implementation is given when it runs. */
export interface RuleContext<TParams extends RuleParams = RuleParams> {
  /** The user the access check is being performed for. */
  username: string;
  /** The item whose rule is being executed. */
  item: Item;
  /** Params passed to `checkAccess`. */
  params: TParams;
  /** The `data` payload of the stored rule. */
  data: string | null;
}

export type RuleFn<TParams extends RuleParams = RuleParams> = (
  context: RuleContext<TParams>,
) => boolean | Promise<boolean>;

export class UnknownRuleError extends Error {
  public readonly ruleName: string;

  constructor(ruleName: string) {
    super(`Rule "${ruleName}" is not registered.`);
    this.name = "UnknownRuleError";
    this.ruleName = ruleName;
  }
}

/**
 * Maps rule names to their implementations. The application registers rules at
 * startup; the same registry code runs on server and client.
 */
export class RuleRegistry {
  private readonly rules = new Map<string, RuleFn>();

  constructor(rules?: Record<string, RuleFn>) {
    if (rules) {
      this.registerAll(rules);
    }
  }

  public register(name: string, fn: RuleFn, options?: { override?: boolean }): this {
    if (this.rules.has(name) && !options?.override) {
      throw new Error(`Rule "${name}" is already registered. Pass { override: true } to replace it.`);
    }
    this.rules.set(name, fn);
    return this;
  }

  public registerAll(rules: Record<string, RuleFn>, options?: { override?: boolean }): this {
    for (const [name, fn] of Object.entries(rules)) {
      this.register(name, fn, options);
    }
    return this;
  }

  public get(name: string): RuleFn | undefined {
    return this.rules.get(name);
  }

  public has(name: string): boolean {
    return this.rules.has(name);
  }

  public unregister(name: string): boolean {
    return this.rules.delete(name);
  }

  public clear(): void {
    this.rules.clear();
  }

  public get size(): number {
    return this.rules.size;
  }

  /** Runs the named rule. Throws {@link UnknownRuleError} when it is not registered. */
  public async execute(name: string, context: RuleContext): Promise<boolean> {
    const fn = this.rules.get(name);
    if (!fn) {
      throw new UnknownRuleError(name);
    }
    return fn(context);
  }
}
