export enum ItemType {
  role = "role",
  permission = "permission",
}

export class Item {
  public type!: ItemType;
  public name!: string;
  public description!: string | null;
  public ruleName!: string | null;
  // public data!: any;

  constructor(data: Partial<Item>) {
    if (data.type) {
      this.type = data.type;
    }

    if (data.name) {
      this.name = data.name;
    }

    if (data.description) {
      this.description = data.description;
    }

    if (data.ruleName) {
      this.ruleName = data.ruleName;
    }
  }
}

export class Role extends Item {
  type: ItemType = ItemType.role;
}

export class Permission extends Item {
  type: ItemType = ItemType.permission;
}
