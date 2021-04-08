import fs from "fs/promises";

import { Assignment } from "../../src/Assignment";
import BaseManager, { BaseManagerOptions } from "../../src/BaseManager";
import { Role, Permission, Item, ItemType } from "../../src/Item";
import { Rule } from "../../src/Rule";

type MockManagerOptions = BaseManagerOptions & {
  itemFile: string;
  assignmentFile: string;
  ruleFile: string;
};

class MockManager extends BaseManager {
  public readonly itemFile!: string;
  public readonly assignmentFile!: string;
  public readonly ruleFile!: string;
  protected assignments: Map<string, Map<string, Assignment>> = new Map();

  public constructor({ itemFile, assignmentFile, ruleFile, ...baseOptions }: MockManagerOptions) {
    super(baseOptions);

    this.itemFile = itemFile;
    this.assignmentFile = assignmentFile;
    this.ruleFile = ruleFile;
  }

  public getRolesByUser(username: string): Promise<Map<string, Role>> {
    throw new Error("Method not implemented.");
  }
  public getChildRoles(roleName: string): Promise<Map<string, Role>> {
    throw new Error("Method not implemented.");
  }
  public getPermissionsByRole(roleName: string): Promise<Map<string, Permission>> {
    throw new Error("Method not implemented.");
  }
  public getPermissionsByUser(username: string): Promise<Map<string, Permission>> {
    throw new Error("Method not implemented.");
  }
  public getRule(name: string): Promise<Rule<any> | null> {
    throw new Error("Method not implemented.");
  }
  public getRules(): Promise<Map<string, Rule<any>>> {
    throw new Error("Method not implemented.");
  }
  public canAddChild(parent: Item, child: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public addChild(parent: Item, child: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public removeChild(parent: Item, child: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public removeChildren(parent: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public hasChild(parent: Item, child: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public getChildren(name: string): Promise<Map<string, Item>> {
    throw new Error("Method not implemented.");
  }
  public assign(role: Role | Permission, username: string): Promise<Assignment> {
    throw new Error("Method not implemented.");
  }
  public revoke(role: Role | Permission, username: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public revokeAll(username: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public getAssignment(roleName: string, username: string): Promise<Assignment | null> {
    throw new Error("Method not implemented.");
  }
  public async getAssignments(username: string): Promise<Map<string, Assignment>> {
    return this.assignments.get(username) ?? new Map();
  }
  public getUsernamesByRole(roleName: string): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  public removeAll(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public removeAllPermissions(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public removeAllRoles(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public removeAllRules(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public removeAllAssignments(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  protected getItem(name: string): Promise<Item | null> {
    throw new Error("Method not implemented.");
  }
  protected getItems(type: ItemType): Promise<Map<string, Item>> {
    throw new Error("Method not implemented.");
  }
  protected addItem(item: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected addRule(rule: Rule<any>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected removeItem(item: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected removeRule(rule: Rule<any>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected updateItem(name: string, item: Item): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected updateRule(name: string, rule: Rule<any>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected async load(): Promise<void> {
    this.invalidateRbac();

    const items = JSON.parse(await fs.readFile(this.itemFile, "utf-8"));
    // $itemsMtime = @filemtime($this->itemFile);
    const assignments = JSON.parse(await fs.readFile(this.assignmentFile, "utf-8"));
    // $assignmentsMtime = @filemtime($this->assignmentFile);
    const rules = JSON.parse(await fs.readFile(this.ruleFile, "utf-8"));

    Object.keys(items).forEach((name) => {
      const item = items[name];
      const ItemClass = item["type"] == ItemType.permission ? Permission : Role;
      this.items.set(
        name,
        new ItemClass({
          name,
          description: item.description ?? null,
          ruleName: item.ruleName ?? null,
          // data: item.data ?? null,
        })
      );
    });

    Object.keys(items).forEach((name) => {
      const item = items[name];
      if (item.children.length > 0) {
        item.children.forEach((childName: string) => {
          if (this.items.has(childName)) {
            if (this.parents.has(childName)) {
              this.parents.get(childName)!.set(name, this.items.get(name)!);
            } else {
              this.parents.set(
                childName,
                new Map<string, Item>([[name, this.items.get(name)!]])
              );
            }
          }
        });
      }
    });

    Object.keys(assignments).forEach((username) => {
      const items: string[] = assignments[username];
      items.forEach((itemName) => {
        if (this.assignments.has(username)) {
          this.assignments.get(username)?.set(
            itemName,
            new Assignment({
              username,
              itemName,
            })
          );
        } else {
          this.assignments.set(
            username,
            new Map([
              [
                itemName,
                new Assignment({
                  username,
                  itemName,
                }),
              ],
            ])
          );
        }
      });
    });

    Object.keys(rules).forEach((ruleName) => {
      const ruleData = rules[ruleName];
      const RuleClass = this.ruleClasses.get(ruleData.data.typeName) ?? Rule;
      const rule = new RuleClass(ruleName, JSON.parse(ruleData.data.rule));
      this.rules.set(rule.name, rule);
    });
  }
}

export default MockManager;
