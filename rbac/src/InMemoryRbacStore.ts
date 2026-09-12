import { createAssignment, type Assignment } from "./Assignment.js";
import { ItemType, isPermission, isRole, type Item, type Permission, type Role } from "./Item.js";
import type { RbacManagerStore } from "./RbacManagerStore.js";
import type { Rule } from "./Rule.js";
import { fromSnapshot, type RbacSnapshot } from "./snapshot.js";

/**
 * A complete {@link RbacManagerStore} held in memory.
 *
 * Two uses: as the client-side store for a snapshot fetched from a server, and
 * as a fixture in tests. Persistent backends belong in their own project.
 */
export class InMemoryRbacStore implements RbacManagerStore {
  private items = new Map<string, Item>();
  private rules = new Map<string, Rule>();
  /** parent name -> child names */
  private children = new Map<string, Set<string>>();
  /** child name -> parent names; kept in step with `children` so getParents is O(1) */
  private parents = new Map<string, Set<string>>();
  /** username -> item name -> assignment */
  private assignments = new Map<string, Map<string, Assignment>>();

  constructor(snapshot?: RbacSnapshot) {
    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  /** Replaces the graph with the contents of a snapshot. Assignments are kept. */
  public loadSnapshot(snapshot: RbacSnapshot): void {
    const { items, children, rules } = fromSnapshot(snapshot);
    this.items = items;
    this.rules = rules;
    this.children = children;
    this.parents = new Map();
    for (const [parentName, childNames] of children) {
      for (const childName of childNames) {
        this.addParentEdge(parentName, childName);
      }
    }
  }

  private addParentEdge(parentName: string, childName: string): void {
    let set = this.parents.get(childName);
    if (!set) {
      set = new Set();
      this.parents.set(childName, set);
    }
    set.add(parentName);
  }

  private removeEdge(parentName: string, childName: string): boolean {
    const removed = this.children.get(parentName)?.delete(childName) ?? false;
    this.parents.get(childName)?.delete(parentName);
    return removed;
  }

  /** Resolves names to items, skipping any that no longer exist. */
  private resolve(names: Iterable<string> | undefined): Map<string, Item> {
    const result = new Map<string, Item>();
    for (const name of names ?? []) {
      const item = this.items.get(name);
      if (item) {
        result.set(name, item);
      }
    }
    return result;
  }

  // ----------------------------------------------------------- RbacStore ---

  public getItem(name: string): Promise<Item | null> {
    return Promise.resolve(this.items.get(name) ?? null);
  }

  public getItems(type?: ItemType): Promise<Map<string, Item>> {
    if (!type) {
      return Promise.resolve(new Map(this.items));
    }
    const result = new Map<string, Item>();
    for (const [name, item] of this.items) {
      if (item.type === type) {
        result.set(name, item);
      }
    }
    return Promise.resolve(result);
  }

  public getChildren(name: string): Promise<Map<string, Item>> {
    return Promise.resolve(this.resolve(this.children.get(name)));
  }

  public getParents(name: string): Promise<Map<string, Item>> {
    return Promise.resolve(this.resolve(this.parents.get(name)));
  }

  public getRule(name: string): Promise<Rule | null> {
    return Promise.resolve(this.rules.get(name) ?? null);
  }

  public getRules(): Promise<Map<string, Rule>> {
    return Promise.resolve(new Map(this.rules));
  }

  public getAssignment(itemName: string, username: string): Promise<Assignment | null> {
    return Promise.resolve(this.assignments.get(username)?.get(itemName) ?? null);
  }

  public getAssignments(username: string): Promise<Map<string, Assignment>> {
    return Promise.resolve(new Map(this.assignments.get(username) ?? []));
  }

  // ---------------------------------------------------- items and rules ---

  public addItem(item: Item): Promise<boolean> {
    if (this.items.has(item.name)) {
      throw new Error(`Item "${item.name}" already exists.`);
    }
    this.items.set(item.name, item);
    return Promise.resolve(true);
  }

  public updateItem(name: string, item: Item): Promise<boolean> {
    if (!this.items.has(name)) {
      return Promise.resolve(false);
    }
    if (name !== item.name && this.items.has(item.name)) {
      throw new Error(`Item "${item.name}" already exists.`);
    }

    this.items.delete(name);
    this.items.set(item.name, item);

    if (name !== item.name) {
      this.renameInEdges(name, item.name);
      for (const userAssignments of this.assignments.values()) {
        const assignment = userAssignments.get(name);
        if (assignment) {
          userAssignments.delete(name);
          userAssignments.set(item.name, { ...assignment, itemName: item.name });
        }
      }
    }

    return Promise.resolve(true);
  }

  /** Rewrites `from` to `to` on both sides of every hierarchy edge. */
  private renameInEdges(from: string, to: string): void {
    for (const map of [this.children, this.parents]) {
      const own = map.get(from);
      if (own) {
        map.delete(from);
        map.set(to, own);
      }
      for (const set of map.values()) {
        if (set.delete(from)) {
          set.add(to);
        }
      }
    }
  }

  public removeItem(item: Item): Promise<boolean> {
    if (!this.items.delete(item.name)) {
      return Promise.resolve(false);
    }

    for (const childName of this.children.get(item.name) ?? []) {
      this.parents.get(childName)?.delete(item.name);
    }
    this.children.delete(item.name);

    for (const parentName of this.parents.get(item.name) ?? []) {
      this.children.get(parentName)?.delete(item.name);
    }
    this.parents.delete(item.name);

    for (const userAssignments of this.assignments.values()) {
      userAssignments.delete(item.name);
    }

    return Promise.resolve(true);
  }

  public addRule(rule: Rule): Promise<boolean> {
    if (this.rules.has(rule.name)) {
      throw new Error(`Rule "${rule.name}" already exists.`);
    }
    this.rules.set(rule.name, rule);
    return Promise.resolve(true);
  }

  public updateRule(name: string, rule: Rule): Promise<boolean> {
    if (!this.rules.has(name)) {
      return Promise.resolve(false);
    }
    if (name !== rule.name && this.rules.has(rule.name)) {
      throw new Error(`Rule "${rule.name}" already exists.`);
    }

    this.rules.delete(name);
    this.rules.set(rule.name, rule);

    if (name !== rule.name) {
      for (const [itemName, item] of this.items) {
        if (item.ruleName === name) {
          this.items.set(itemName, { ...item, ruleName: rule.name });
        }
      }
    }

    return Promise.resolve(true);
  }

  public removeRule(rule: Rule): Promise<boolean> {
    if (!this.rules.delete(rule.name)) {
      return Promise.resolve(false);
    }
    this.clearRuleReferences(rule.name);
    return Promise.resolve(true);
  }

  private clearRuleReferences(ruleName?: string): void {
    for (const [itemName, item] of this.items) {
      if (item.ruleName !== null && (ruleName === undefined || item.ruleName === ruleName)) {
        this.items.set(itemName, { ...item, ruleName: null });
      }
    }
  }

  // ------------------------------------------------------------ hierarchy ---

  public addChild(parent: Item, child: Item): Promise<boolean> {
    if (!this.items.has(parent.name) || !this.items.has(child.name)) {
      throw new Error(`Both "${parent.name}" and "${child.name}" must exist before linking them.`);
    }

    let set = this.children.get(parent.name);
    if (!set) {
      set = new Set();
      this.children.set(parent.name, set);
    }
    if (set.has(child.name)) {
      return Promise.resolve(false);
    }

    set.add(child.name);
    this.addParentEdge(parent.name, child.name);
    return Promise.resolve(true);
  }

  public removeChild(parent: Item, child: Item): Promise<boolean> {
    return Promise.resolve(this.removeEdge(parent.name, child.name));
  }

  public removeChildren(parent: Item): Promise<boolean> {
    const set = this.children.get(parent.name);
    if (!set || set.size === 0) {
      return Promise.resolve(false);
    }
    for (const childName of set) {
      this.parents.get(childName)?.delete(parent.name);
    }
    this.children.delete(parent.name);
    return Promise.resolve(true);
  }

  public hasChild(parent: Item, child: Item): Promise<boolean> {
    return Promise.resolve(this.children.get(parent.name)?.has(child.name) ?? false);
  }

  // ---------------------------------------------------------- assignments ---

  public assign(item: Role | Permission, username: string): Promise<Assignment> {
    let userAssignments = this.assignments.get(username);
    if (!userAssignments) {
      userAssignments = new Map();
      this.assignments.set(username, userAssignments);
    }

    const existing = userAssignments.get(item.name);
    if (existing) {
      return Promise.resolve(existing);
    }

    const assignment = createAssignment(username, item.name);
    userAssignments.set(item.name, assignment);
    return Promise.resolve(assignment);
  }

  public revoke(item: Role | Permission, username: string): Promise<boolean> {
    return Promise.resolve(this.assignments.get(username)?.delete(item.name) ?? false);
  }

  public revokeAll(username: string): Promise<boolean> {
    return Promise.resolve(this.assignments.delete(username));
  }

  public getUsernamesByRole(roleName: string): Promise<string[]> {
    const usernames: string[] = [];
    for (const [username, userAssignments] of this.assignments) {
      if (userAssignments.has(roleName)) {
        usernames.push(username);
      }
    }
    return Promise.resolve(usernames);
  }

  // -------------------------------------------------------------- queries ---

  public getRolesByUser(username: string): Promise<Map<string, Role>> {
    const roles = new Map<string, Role>();
    for (const itemName of this.assignments.get(username)?.keys() ?? []) {
      const item = this.items.get(itemName);
      if (item && isRole(item)) {
        roles.set(itemName, item);
      }
    }
    return Promise.resolve(roles);
  }

  public getChildRoles(roleName: string): Promise<Map<string, Role>> {
    const role = this.items.get(roleName);
    if (!role || !isRole(role)) {
      throw new Error(`Role "${roleName}" not found.`);
    }

    const roles = new Map<string, Role>([[roleName, role]]);
    for (const [name, item] of this.descendants(roleName)) {
      if (isRole(item)) {
        roles.set(name, item);
      }
    }
    return Promise.resolve(roles);
  }

  public getPermissionsByRole(roleName: string): Promise<Map<string, Permission>> {
    const permissions = new Map<string, Permission>();
    for (const [name, item] of this.descendants(roleName)) {
      if (isPermission(item)) {
        permissions.set(name, item);
      }
    }
    return Promise.resolve(permissions);
  }

  public getPermissionsByUser(username: string): Promise<Map<string, Permission>> {
    const permissions = new Map<string, Permission>();
    for (const itemName of this.assignments.get(username)?.keys() ?? []) {
      const item = this.items.get(itemName);
      if (item && isPermission(item)) {
        permissions.set(itemName, item);
      }
      for (const [name, descendant] of this.descendants(itemName)) {
        if (isPermission(descendant)) {
          permissions.set(name, descendant);
        }
      }
    }
    return Promise.resolve(permissions);
  }

  /** Every item below `name`, at any depth. Cycle-safe. */
  private descendants(name: string): Map<string, Item> {
    const result = new Map<string, Item>();
    const visited = new Set<string>([name]);
    const queue = [name];

    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const childName of this.children.get(current) ?? []) {
        if (visited.has(childName)) {
          continue;
        }
        visited.add(childName);
        queue.push(childName);
        const child = this.items.get(childName);
        if (child) {
          result.set(childName, child);
        }
      }
    }

    return result;
  }

  // ----------------------------------------------------------------- bulk ---

  public removeAll(): Promise<void> {
    this.items.clear();
    this.rules.clear();
    this.children.clear();
    this.parents.clear();
    this.assignments.clear();
    return Promise.resolve();
  }

  public removeAllRoles(): Promise<void> {
    return this.removeAllOfType(ItemType.role);
  }

  public removeAllPermissions(): Promise<void> {
    return this.removeAllOfType(ItemType.permission);
  }

  private async removeAllOfType(type: ItemType): Promise<void> {
    for (const item of [...this.items.values()]) {
      if (item.type === type) {
        await this.removeItem(item);
      }
    }
  }

  public removeAllRules(): Promise<void> {
    this.rules.clear();
    this.clearRuleReferences();
    return Promise.resolve();
  }

  public removeAllAssignments(): Promise<void> {
    this.assignments.clear();
    return Promise.resolve();
  }
}
