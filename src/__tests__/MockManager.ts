import BaseManager from "../BaseManager";
import { Assignment } from "../Assignment";
import { Role, Permission, IItem, ItemType } from "../Item";
import { Rule } from "../Rule";
import AuthorRule from "./AuthorRule";
import ActionRule from "./ActionRule";

export default class MockManager extends BaseManager {
  protected assignments: Map<string, Map<string, Assignment>> = new Map();

  public getRolesByUser(_username: string): Promise<Map<string, Role>> {
    throw new Error("Method not implemented.");
  }
  public getChildRoles(_roleName: string): Promise<Map<string, Role>> {
    throw new Error("Method not implemented.");
  }
  public getPermissionsByRole(roleName: string): Promise<Map<string, Permission>> {
    throw new Error("Method not implemented.");
  }
  public getPermissionsByUser(username: string): Promise<Map<string, Permission>> {
    throw new Error("Method not implemented.");
  }
  public async getRule(name: string): Promise<Rule<any> | null> {
    return this.rules.get(name) ?? null;
  }
  public getRules(): Promise<Map<string, Rule<any>>> {
    throw new Error("Method not implemented.");
  }
  public canAddChild(parent: IItem, child: IItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public async addChild(parent: IItem, child: IItem): Promise<boolean> {
    if (!this.parents.has(child.name)) {
      this.parents.set(child.name, new Map([[parent.name, this.items.get(parent.name)!]]));
    } else {
      this.parents.get(child.name)!.set(parent.name, this.items.get(parent.name)!);
    }

    return true;
  }
  public removeChild(parent: IItem, child: IItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public removeChildren(parent: IItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public hasChild(parent: IItem, child: IItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  public getChildren(name: string): Promise<Map<string, IItem>> {
    throw new Error("Method not implemented.");
  }
  public async assign(role: Role | Permission, username: string): Promise<Assignment> {
    const assignment = new Assignment(username, role.name);

    if (!this.assignments.has(username)) {
      this.assignments.set(username, new Map([[role.name, assignment]]));
    } else {
      this.assignments.get(username)!.set(role.name, assignment);
    }

    return assignment;
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
  protected getItem(name: string): Promise<IItem | null> {
    throw new Error("Method not implemented.");
  }
  protected getItems(type: ItemType): Promise<Map<string, IItem>> {
    throw new Error("Method not implemented.");
  }
  protected async addItem(item: IItem): Promise<boolean> {
    this.items.set(item.name, item);
    return true;
  }
  protected async addRule(rule: Rule<any>): Promise<boolean> {
    this.rules.set(rule.name, rule);
    return true;
  }
  protected removeItem(item: IItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected removeRule(rule: Rule<any>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected updateItem(name: string, item: IItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected updateRule(name: string, rule: Rule<any>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  protected load(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export async function prepareData(auth: BaseManager) {
  AuthorRule.init(auth);
  ActionRule.init(auth);

  const authorRule = new AuthorRule();
  await auth.add(authorRule);

  const uniqueTrait = new Permission({
    name: "Fast Metabolism",
    description: "Your metabolic rate is twice normal",
  });
  await auth.add(uniqueTrait);

  const createPost = new Permission({ name: "createPost", description: "create a post" });
  await auth.add(createPost);

  const readPost = new Permission({ name: "readPost", description: "read a post" });
  await auth.add(readPost);

  const deletePost = new Permission({ name: "deletePost", description: "delete a post" });
  await auth.add(deletePost);

  const updatePost = new Permission({ name: "updatePost", description: "update any post" });
  await auth.add(updatePost);

  const updateOwnPost = new Permission({
    name: "updateOwnPost",
    description: "update own post",
    ruleName: authorRule.name,
  });
  await auth.add(updateOwnPost);
  await auth.addChild(updateOwnPost, updatePost);

  const withoutChildren = new Role({ name: "withoutChildren" });
  await auth.add(withoutChildren);

  const reader = new Role({ name: "reader" });
  await auth.add(reader);
  await auth.addChild(reader, readPost);

  const author = new Role({ name: "author" });
  await auth.add(author);
  await auth.addChild(author, createPost);
  await auth.addChild(author, updateOwnPost);
  await auth.addChild(author, reader);

  const admin = new Role({ name: "admin" });
  await auth.add(admin);
  await auth.addChild(admin, author);
  await auth.addChild(admin, updatePost);

  await auth.assign(uniqueTrait, "reader");

  await auth.assign(reader, "reader");
  await auth.assign(author, "author A");
  await auth.assign(deletePost, "author A");
  await auth.assign(author, "author B");
  await auth.assign(admin, "admin");
}
