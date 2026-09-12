import type { Assignment } from "./Assignment.js";
import type { Item, ItemType } from "./Item.js";
import type { Rule } from "./Rule.js";

/**
 * Read-only storage contract — everything an access check needs and nothing
 * more. This is the only interface a client (web / React Native) has to
 * implement; see `InMemoryRbacStore` for a ready-made implementation over a
 * snapshot fetched from a server.
 *
 * Implementations live in separate projects. Whether they cache, preload, or
 * hit a database per call is entirely their business.
 */
export interface RbacStore {
  /** Returns the named item, or null when it does not exist. */
  getItem(name: string): Promise<Item | null>;

  /** Returns all items, optionally narrowed to one type, indexed by name. */
  getItems(type?: ItemType): Promise<Map<string, Item>>;

  /** Returns the direct children of the named item, indexed by name. */
  getChildren(name: string): Promise<Map<string, Item>>;

  /**
   * Returns the direct parents of the named item, indexed by name.
   *
   * Access checks walk the hierarchy upward from the requested item, so this is
   * on the hot path and worth indexing in the implementation.
   */
  getParents(name: string): Promise<Map<string, Item>>;

  /** Returns the named rule, or null when it does not exist. */
  getRule(name: string): Promise<Rule | null>;

  /** Returns all rules, indexed by name. */
  getRules(): Promise<Map<string, Rule>>;

  /** Returns the assignment of an item to a user, or null when not assigned. */
  getAssignment(itemName: string, username: string): Promise<Assignment | null>;

  /** Returns every assignment for a user, indexed by item name. */
  getAssignments(username: string): Promise<Map<string, Assignment>>;
}
