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
  public readonly name: string;
  public description: string | null;
  public ruleName: string | null;

  constructor(data: Omit<Item, "type" | "description" | "ruleName"> & Partial<Pick<Item, "description" | "ruleName">>) {
    this.name = data.name;
    this.description = data.description ?? null;
    this.ruleName = data.ruleName ?? null;
  }
}

export class Role extends Item {
  type: ItemType = ItemType.role;
}

export class Permission extends Item {
  type: ItemType = ItemType.permission;
}
