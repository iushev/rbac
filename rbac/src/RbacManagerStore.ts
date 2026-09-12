import type { Assignment } from "./Assignment.js";
import type { Item, Permission, Role } from "./Item.js";
import type { RbacStore } from "./RbacStore.js";
import type { Rule } from "./Rule.js";

/**
 * Full storage contract: reads plus the mutations needed to build the
 * authorization data. Server-side only — a client never needs this half.
 *
 * Implementations are responsible for persistence and referential integrity
 * (removing an item must drop its hierarchy edges and assignments). Policy that
 * does not depend on the backend — loop detection, role-under-permission
 * rejection — lives in `RbacManager` instead, so backends do not re-implement it.
 */
export interface RbacManagerStore extends RbacStore {
  // ---------------------------------------------------------------- items ---

  /**
   * Adds an item.
   * @returns whether the item was added.
   * @throws if an item with the same name already exists.
   */
  addItem(item: Item): Promise<boolean>;

  /**
   * Replaces the item stored under `name`, which may rename it.
   * Hierarchy edges and assignments must follow the rename.
   */
  updateItem(name: string, item: Item): Promise<boolean>;

  /** Removes an item along with its hierarchy edges and assignments. */
  removeItem(item: Item): Promise<boolean>;

  // ---------------------------------------------------------------- rules ---

  addRule(rule: Rule): Promise<boolean>;

  /** Replaces the rule stored under `name`; items referencing it must follow a rename. */
  updateRule(name: string, rule: Rule): Promise<boolean>;

  /** Removes a rule; items referencing it must have their `ruleName` cleared. */
  removeRule(rule: Rule): Promise<boolean>;

  // ------------------------------------------------------------ hierarchy ---

  /**
   * Records `child` as a child of `parent`.
   *
   * Callers should go through `RbacManager.addChild`, which validates the edge
   * first; this method only persists it.
   */
  addChild(parent: Item, child: Item): Promise<boolean>;

  /** Removes a single parent-child edge. The items themselves are kept. */
  removeChild(parent: Item, child: Item): Promise<boolean>;

  /** Removes every edge from `parent` to its children. The items are kept. */
  removeChildren(parent: Item): Promise<boolean>;

  /** Whether `child` is a direct child of `parent`. */
  hasChild(parent: Item, child: Item): Promise<boolean>;

  // ---------------------------------------------------------- assignments ---

  /** Assigns a role or permission to a user. */
  assign(item: Role | Permission, username: string): Promise<Assignment>;

  /** Revokes a role or permission from a user. */
  revoke(item: Role | Permission, username: string): Promise<boolean>;

  /** Revokes every assignment of a user. */
  revokeAll(username: string): Promise<boolean>;

  /** Usernames directly assigned the named role. */
  getUsernamesByRole(roleName: string): Promise<string[]>;

  // -------------------------------------------------------------- queries ---

  /** Roles assigned directly to the user. Child roles are not included. */
  getRolesByUser(username: string): Promise<Map<string, Role>>;

  /** All roles below the named role, at any depth. */
  getChildRoles(roleName: string): Promise<Map<string, Role>>;

  /** All permissions the named role grants, at any depth. */
  getPermissionsByRole(roleName: string): Promise<Map<string, Permission>>;

  /** All permissions the user has, directly or through roles. */
  getPermissionsByUser(username: string): Promise<Map<string, Permission>>;

  // ----------------------------------------------------------------- bulk ---

  /** Removes all authorization data: items, rules, hierarchy and assignments. */
  removeAll(): Promise<void>;

  /** Removes all roles; parent-child relations are adjusted accordingly. */
  removeAllRoles(): Promise<void>;

  /** Removes all permissions; parent-child relations are adjusted accordingly. */
  removeAllPermissions(): Promise<void>;

  /** Removes all rules; items referencing them have `ruleName` cleared. */
  removeAllRules(): Promise<void>;

  /** Removes all assignments. */
  removeAllAssignments(): Promise<void>;
}
