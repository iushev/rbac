/**
 * Authorization item types.
 *
 * A const object rather than a TypeScript `enum`: the package is built with
 * `verbatimModuleSyntax` / `isolatedModules` and has to stay friendly to
 * type-stripping transpilers used on web and React Native.
 */
export const ItemType = {
  role: "role",
  permission: "permission",
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

/**
 * An authorization item — either a role or a permission.
 *
 * Items are plain data so they survive `JSON.stringify` and can be handed from
 * a server to a web / React Native client unchanged.
 */
export interface Item {
  readonly type: ItemType;
  name: string;
  description: string | null;
  /** Name of the rule associated with this item, if any. */
  ruleName: string | null;
  /** Free-form text carried with the item; its format is up to the application. */
  data: string | null;
}

export interface Role extends Item {
  readonly type: typeof ItemType.role;
}

export interface Permission extends Item {
  readonly type: typeof ItemType.permission;
}

/** Fields accepted when creating an item; everything but `name` is optional. */
export type CreateItem = Pick<Item, "name"> & Partial<Pick<Item, "description" | "ruleName" | "data">>;

function createItem<T extends ItemType>(type: T, { name, description, ruleName, data }: CreateItem) {
  return {
    type,
    name,
    description: description ?? null,
    ruleName: ruleName ?? null,
    data: data ?? null,
  };
}

export function createRole(item: CreateItem): Role {
  return createItem(ItemType.role, item);
}

export function createPermission(item: CreateItem): Permission {
  return createItem(ItemType.permission, item);
}

export function isRole(item: Item): item is Role {
  return item.type === ItemType.role;
}

export function isPermission(item: Item): item is Permission {
  return item.type === ItemType.permission;
}

/**
 * Copy of an item, used to hand out defensive copies of store state. Every
 * field is a primitive, so a shallow copy is a full one.
 */
export function cloneItem<T extends Item>(item: T): T {
  return { ...item };
}
