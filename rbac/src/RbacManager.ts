import type { Assignment } from "./Assignment.js";
import {
  ItemType,
  cloneItem,
  isPermission,
  isRole,
  type Item,
  type Permission,
  type Role,
} from "./Item.js";
import { CheckAccess, type CheckAccessOptions } from "./CheckAccess.js";
import type { RbacManagerStore } from "./RbacManagerStore.js";
import { cloneRule, createRule, type Rule } from "./Rule.js";

/** Anything `add` / `remove` / `update` accept. */
export type RbacObject = Role | Permission | Rule;

export interface RbacManagerOptions extends Omit<CheckAccessOptions, "store"> {
  store: RbacManagerStore;
}

/** The authorization data as a set of maps — a defensive copy of store state. */
export interface Rbac {
  items: Map<string, Item>;
  parents: Map<string, Map<string, Item>>;
  rules: Map<string, Rule>;
}

function isItem(object: RbacObject): object is Role | Permission {
  return "type" in object;
}

/**
 * The build half of RBAC: creating items, wiring the hierarchy and assigning
 * roles, on top of a {@link RbacManagerStore}.
 *
 * It also inherits `checkAccess`, so a server can use one object for both
 * halves. Backend-independent policy lives here rather than in each store:
 * loop detection, the rule that a permission may not contain a role, and
 * auto-creating a placeholder rule for an item that names an unknown one.
 */
export class RbacManager extends CheckAccess {
  declare protected readonly store: RbacManagerStore;

  constructor(options: RbacManagerOptions) {
    super(options);
  }

  // ----------------------------------------------------------- add/remove ---

  /**
   * Adds a role, permission or rule.
   *
   * When an item names a rule that does not exist yet, a placeholder rule row is
   * created so the reference stays valid; register the implementation separately.
   */
  public async add(object: RbacObject): Promise<boolean> {
    if (isItem(object)) {
      await this.ensureRuleExists(object.ruleName);
      return this.store.addItem(object);
    }
    return this.store.addRule(object);
  }

  /** Removes a role, permission or rule. */
  public async remove(object: RbacObject): Promise<boolean> {
    if (isItem(object)) {
      return this.store.removeItem(object);
    }
    return this.store.removeRule(object);
  }

  /** Replaces the role, permission or rule stored under `name`. */
  public async update(name: string, object: RbacObject): Promise<boolean> {
    if (isItem(object)) {
      await this.ensureRuleExists(object.ruleName);
      return this.store.updateItem(name, object);
    }
    return this.store.updateRule(name, object);
  }

  private async ensureRuleExists(ruleName: string | null): Promise<void> {
    if (ruleName && (await this.store.getRule(ruleName)) === null) {
      await this.store.addRule(createRule(ruleName));
    }
  }

  // -------------------------------------------------------- items & rules ---

  public async getRole(name: string): Promise<Role | null> {
    const item = await this.store.getItem(name);
    return item && isRole(item) ? item : null;
  }

  public async getRoles(): Promise<Map<string, Role>> {
    return (await this.store.getItems(ItemType.role)) as Map<string, Role>;
  }

  public async getPermission(name: string): Promise<Permission | null> {
    const item = await this.store.getItem(name);
    return item && isPermission(item) ? item : null;
  }

  public async getPermissions(): Promise<Map<string, Permission>> {
    return (await this.store.getItems(ItemType.permission)) as Map<string, Permission>;
  }

  public async getRule(name: string): Promise<Rule | null> {
    return this.store.getRule(name);
  }

  public async getRules(): Promise<Map<string, Rule>> {
    return this.store.getRules();
  }

  // ------------------------------------------------------------ hierarchy ---

  /**
   * Whether `child` may be added under `parent`.
   *
   * Rejects an item under itself, a role under a permission (a role may contain
   * a permission, but not the reverse), and any edge that would close a loop —
   * the hierarchy is a partial order.
   */
  public async canAddChild(parent: Item, child: Item): Promise<boolean> {
    if (parent.name === child.name) {
      return false;
    }
    if (isPermission(parent) && isRole(child)) {
      return false;
    }
    return !(await this.detectLoop(parent, child));
  }

  /**
   * Adds `child` under `parent`.
   * @throws if the edge is not allowed, or if either item does not exist.
   */
  public async addChild(parent: Item, child: Item): Promise<boolean> {
    if (parent.name === child.name) {
      throw new Error(`Cannot add "${parent.name}" as a child of itself.`);
    }
    if (isPermission(parent) && isRole(child)) {
      throw new Error(`Cannot add role "${child.name}" as a child of permission "${parent.name}".`);
    }
    if (await this.detectLoop(parent, child)) {
      throw new Error(
        `Cannot add "${child.name}" as a child of "${parent.name}": a loop has been detected.`,
      );
    }
    return this.store.addChild(parent, child);
  }

  public async removeChild(parent: Item, child: Item): Promise<boolean> {
    return this.store.removeChild(parent, child);
  }

  public async removeChildren(parent: Item): Promise<boolean> {
    return this.store.removeChildren(parent);
  }

  public async hasChild(parent: Item, child: Item): Promise<boolean> {
    return this.store.hasChild(parent, child);
  }

  public async getChildren(name: string): Promise<Map<string, Item>> {
    return this.store.getChildren(name);
  }

  /**
   * Whether adding `child` under `parent` would close a loop, i.e. whether
   * `parent` is already reachable from `child`.
   */
  protected async detectLoop(parent: Item, child: Item): Promise<boolean> {
    if (child.name === parent.name) {
      return true;
    }

    const visited = new Set<string>([child.name]);
    const queue = [child.name];

    while (queue.length > 0) {
      // Guarded by queue.length, so the shift always yields a name.
      const current = queue.shift() as string;
      const children = await this.store.getChildren(current);
      for (const name of children.keys()) {
        if (name === parent.name) {
          return true;
        }
        if (!visited.has(name)) {
          visited.add(name);
          queue.push(name);
        }
      }
    }

    return false;
  }

  // ---------------------------------------------------------- assignments ---

  public async assign(item: Role | Permission, username: string): Promise<Assignment> {
    return this.store.assign(item, username);
  }

  public async revoke(item: Role | Permission, username: string): Promise<boolean> {
    return this.store.revoke(item, username);
  }

  public async revokeAll(username: string): Promise<boolean> {
    return this.store.revokeAll(username);
  }

  public async getAssignment(itemName: string, username: string): Promise<Assignment | null> {
    return this.store.getAssignment(itemName, username);
  }

  public async getAssignments(username: string): Promise<Map<string, Assignment>> {
    return this.store.getAssignments(username);
  }

  public async getUsernamesByRole(roleName: string): Promise<string[]> {
    return this.store.getUsernamesByRole(roleName);
  }

  public async getRolesByUser(username: string): Promise<Map<string, Role>> {
    return this.store.getRolesByUser(username);
  }

  public async getChildRoles(roleName: string): Promise<Map<string, Role>> {
    return this.store.getChildRoles(roleName);
  }

  public async getPermissionsByRole(roleName: string): Promise<Map<string, Permission>> {
    return this.store.getPermissionsByRole(roleName);
  }

  public async getPermissionsByUser(username: string): Promise<Map<string, Permission>> {
    return this.store.getPermissionsByUser(username);
  }

  // ----------------------------------------------------------------- bulk ---

  public async removeAll(): Promise<void> {
    return this.store.removeAll();
  }

  public async removeAllRoles(): Promise<void> {
    return this.store.removeAllRoles();
  }

  public async removeAllPermissions(): Promise<void> {
    return this.store.removeAllPermissions();
  }

  public async removeAllRules(): Promise<void> {
    return this.store.removeAllRules();
  }

  public async removeAllAssignments(): Promise<void> {
    return this.store.removeAllAssignments();
  }

  // --------------------------------------------------------------- export ---

  /**
   * The whole authorization graph as a defensive copy, for serving to a client
   * or inspecting in tests. Mutating the result does not touch store state.
   */
  public async getRbac(): Promise<Rbac> {
    const items = new Map<string, Item>();
    const parents = new Map<string, Map<string, Item>>();
    const rules = new Map<string, Rule>();

    for (const [name, item] of await this.store.getItems()) {
      items.set(name, cloneItem(item));
    }

    for (const name of items.keys()) {
      const itemParents = await this.store.getParents(name);
      if (itemParents.size === 0) {
        continue;
      }
      const copy = new Map<string, Item>();
      for (const [parentName, parent] of itemParents) {
        copy.set(parentName, cloneItem(parent));
      }
      parents.set(name, copy);
    }

    for (const [name, rule] of await this.store.getRules()) {
      rules.set(name, cloneRule(rule));
    }

    return { items, parents, rules };
  }
}
