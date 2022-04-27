export enum ItemType {
  role = "role",
  permission = "permission",
}

export interface IItem {
  type: ItemType;
  name: string;
  description: string | null;
  ruleName: string | null;
}

class Item implements IItem {
  public declare readonly type: ItemType;
  public name: string;
  public description: string | null;
  public ruleName: string | null;

  constructor({
    name,
    description,
    ruleName,
  }: Omit<Item, "type" | "description" | "ruleName"> & Partial<Pick<Item, "description" | "ruleName">>) {
    this.name = name;
    this.description = description ?? null;
    this.ruleName = ruleName ?? null;
  }
}

export class Role extends Item {
  type: ItemType = ItemType.role;
}

export class Permission extends Item {
  type: ItemType = ItemType.permission;
}
