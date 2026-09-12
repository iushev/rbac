import { cloneItem, type Item } from "./Item.js";
import type { RbacStore } from "./RbacStore.js";
import { cloneRule, type Rule } from "./Rule.js";

/**
 * The authorization graph in a plain, JSON-safe shape.
 *
 * `Map` does not survive `JSON.stringify`, so this is the wire format a server
 * uses to hand its RBAC data to a web / React Native client. Assignments are
 * deliberately not included: a snapshot describes the graph, and a client only
 * ever needs the assignments of the current user.
 */
export interface RbacSnapshot {
  items: Item[];
  /** `[parentName, childNames]` pairs describing the hierarchy edges. */
  children: [string, string[]][];
  rules: Rule[];
}

/** Reads the whole graph out of a store into a serializable snapshot. */
export async function toSnapshot(store: RbacStore): Promise<RbacSnapshot> {
  const items = [...(await store.getItems()).values()].map(cloneItem);

  const children: [string, string[]][] = [];
  for (const item of items) {
    const itemChildren = await store.getChildren(item.name);
    if (itemChildren.size > 0) {
      children.push([item.name, [...itemChildren.keys()]]);
    }
  }

  const rules = [...(await store.getRules()).values()].map(cloneRule);

  return { items, children, rules };
}

/** Rebuilds the maps a store keeps internally from a snapshot. */
export function fromSnapshot(snapshot: RbacSnapshot): {
  items: Map<string, Item>;
  children: Map<string, Set<string>>;
  rules: Map<string, Rule>;
} {
  const items = new Map<string, Item>();
  for (const item of snapshot.items) {
    items.set(item.name, cloneItem(item));
  }

  const children = new Map<string, Set<string>>();
  for (const [parentName, childNames] of snapshot.children) {
    children.set(parentName, new Set(childNames));
  }

  const rules = new Map<string, Rule>();
  for (const rule of snapshot.rules) {
    rules.set(rule.name, cloneRule(rule));
  }

  return { items, children, rules };
}
