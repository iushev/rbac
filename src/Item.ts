export enum ItemType {
  role = "role",
  permission = "permission",
}

export interface IItem {
  type: ItemType;
  name: string;
  description: string | null;
  ruleName: string | null;
  data: string | null;
}

export type ICreateItem = Omit<Item, "type" | "description" | "ruleName" | "data"> &
  Partial<Pick<IItem, "description" | "ruleName" | "data">>;

class Item implements IItem {
  public declare readonly type: ItemType;
  public name: string;
  public description: string | null;
  public ruleName: string | null;
  public data: string | null;

  constructor({ name, description, ruleName, data }: ICreateItem) {
    this.name = name;
    this.description = description ?? null;
    this.ruleName = ruleName ?? null;
    this.data = data ?? null;
  }
}

export class Role extends Item {
  type: ItemType = ItemType.role;
}

export class Permission extends Item {
  type: ItemType = ItemType.permission;
}
