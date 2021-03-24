export class Assignment {
  public itemName!: string;
  public username!: string;

  constructor(data: Partial<Assignment>) {
    if (data.itemName) {
      this.itemName = data.itemName;
    }

    if (data.username) {
      this.username = data.username;
    }
  }
}
