import fs from "fs/promises";

import { Assignment } from "../Assignment";
import BaseManager, { BaseManagerOptions } from "../BaseManager";
import { Role, Permission, Item, ItemType } from "../Item";
import { Rule } from "../Rule";

class MockManager extends BaseManager {
  protected assignments: Map<string, Map<string, Assignment>> = new Map();

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
  public getAssignments(username: string): Promise<Map<string, Assignment>> {
    throw new Error("Method not implemented.");
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
  protected load(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default MockManager;
