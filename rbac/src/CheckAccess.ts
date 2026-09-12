import type { Assignment } from "./Assignment.js";
import type { Item } from "./Item.js";
import type { RbacStore } from "./RbacStore.js";
import { RuleRegistry, UnknownRuleError, type RuleParams } from "./Rule.js";

export type Logger = (...args: unknown[]) => void;

export interface CheckAccessOptions {
  store: RbacStore;
  /** Rule implementations. An empty registry is fine when no item uses rules. */
  rules?: RuleRegistry;
  /** Items every user is considered to hold without an explicit assignment. */
  defaultRoles?: string[];
  /** Default logger for every check; a per-call `logging` argument overrides it. */
  logging?: false | Logger;
}

export interface CheckAccessArgs {
  username: string;
  itemName: string;
  params?: RuleParams;
  /** Pre-fetched assignments; looked up from the store when omitted. */
  assignments?: Map<string, Assignment>;
  logging?: Logger;
}

/**
 * The access-check half of RBAC: given the authorization data in a
 * {@link RbacStore}, decides whether a user holds an item.
 *
 * Read-only, so it runs unchanged on a server and in a web / React Native
 * bundle over a store built from a snapshot.
 */
export class CheckAccess {
  protected readonly store: RbacStore;
  public readonly rules: RuleRegistry;
  public readonly defaultRoles: string[];
  protected readonly logging: false | Logger;

  constructor(options: CheckAccessOptions) {
    this.store = options.store;
    this.rules = options.rules ?? new RuleRegistry();
    this.defaultRoles = options.defaultRoles ?? [];
    this.logging = options.logging ?? false;
  }

  /**
   * Whether `username` holds `itemName`.
   *
   * The item is granted when it is assigned to the user directly, when it is a
   * default role, or when any item above it in the hierarchy is granted. Every
   * item visited along the way must pass its own rule.
   *
   * @throws {UnknownRuleError} if an item references a rule that is not registered.
   */
  public async checkAccess({
    username,
    itemName,
    params = {},
    assignments,
    logging,
  }: CheckAccessArgs): Promise<boolean> {
    const log = this.logging === false ? logging : this.logging;

    log?.(`checkAccess: username=${username}, itemName=${itemName}`);

    const resolved = assignments ?? (await this.store.getAssignments(username));

    return this.checkItem(username, itemName, params, resolved, new Set<string>(), log);
  }

  /**
   * Walks the hierarchy upward from `itemName`.
   *
   * `visited` makes the traversal terminate on a cyclic graph and stops the same
   * item being re-checked when several paths lead to it.
   */
  private async checkItem(
    username: string,
    itemName: string,
    params: RuleParams,
    assignments: Map<string, Assignment>,
    visited: Set<string>,
    log: Logger | undefined,
  ): Promise<boolean> {
    if (visited.has(itemName)) {
      log?.(`checkAccess: item "${itemName}" already visited, skipping`);
      return false;
    }
    visited.add(itemName);

    const item = await this.store.getItem(itemName);
    if (!item) {
      log?.(`checkAccess: item "${itemName}" not found, access denied`);
      return false;
    }

    if (!(await this.executeRule(username, item, params, log))) {
      log?.(`checkAccess: rule of item "${itemName}" denied access`);
      return false;
    }

    if (assignments.has(itemName) || this.defaultRoles.includes(itemName)) {
      log?.(`checkAccess: item "${itemName}" granted to "${username}"`);
      return true;
    }

    const parents = await this.store.getParents(itemName);
    for (const parentName of parents.keys()) {
      if (await this.checkItem(username, parentName, params, assignments, visited, log)) {
        log?.(`checkAccess: item "${itemName}" granted through parent "${parentName}"`);
        return true;
      }
    }

    log?.(`checkAccess: item "${itemName}" denied to "${username}"`);
    return false;
  }

  /**
   * Runs the rule attached to an item. Items without a rule always pass.
   *
   * @throws {UnknownRuleError} if the item names a rule the registry does not have.
   */
  protected async executeRule(
    username: string,
    item: Item,
    params: RuleParams,
    log?: Logger,
  ): Promise<boolean> {
    if (!item.ruleName) {
      return true;
    }

    const fn = this.rules.get(item.ruleName);
    if (!fn) {
      throw new UnknownRuleError(item.ruleName);
    }

    const rule = await this.store.getRule(item.ruleName);

    log?.(`checkAccess: executing rule "${item.ruleName}" for item "${item.name}"`);

    return fn({ username, item, params, data: rule?.data ?? null });
  }
}
