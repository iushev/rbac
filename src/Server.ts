import express, { NextFunction, Request, Response } from "express";
import HttpStatus from "http-status-codes";

import { Item, ItemType } from "./Item";
import { Rule } from "./Rule";
import { Assignment } from "./Assignment";

export type ServerOptions = {
  path: string;
};

export class Server {
  private app: express.Application;
  private path: string;

  constructor(app: express.Application, options: ServerOptions) {
    this.app = app;
    this.path = options.path || "/rbac";
    this.app.get(this.path, this.serve);
  }

  private async serve(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user || !req.user.username) {
      res.sendStatus(HttpStatus.UNAUTHORIZED);
      return;
    }

    try {
      const itemsToObject = async (mapItems: Map<string, Item>) => {
        const items: {
          [itemName: string]: {
            type: ItemType;
            name: string;
            description: string | null;
            ruleName: string | null;
            children: string[];
          };
        } = {};
        for (let [itemName, item] of mapItems) {
          items[itemName] = {
            type: item.type,
            name: item.name,
            description: item.description,
            ruleName: item.ruleName,
            children: [],
          };

          const children = await req.authManager.getChildren(itemName);
          if (children) {
            for (let childName of children.keys()) {
              items[itemName].children.push(childName);
            }
          }
        }
        return items;
      };

      const rulesToObject = (mapRules: Map<string, Rule>) => {
        const rules: {
          [ruleName: string]: {
            name: string;
            data: {
              typeName: string;
              rule: string;
            };
          };
        } = {};

        for (let rule of mapRules.values()) {
          rules[rule.name] = {
            name: rule.name,
            data: {
              typeName: rule.constructor.name,
              rule: JSON.stringify(rule),
            },
          };
        }
        return rules;
      };

      const assignmentsToObject = (userAssignments: Map<string, Assignment>) => {
        const assignments: string[] = [];

        for (let assignment of userAssignments.values()) {
          assignments.push(assignment.itemName);
        }

        return assignments;
      };

      const { items, rules } = await req.authManager.getRBAC();
      const assignments = await req.authManager.getAssignments(req.user.username);

      res.status(HttpStatus.OK).json({
        items: await itemsToObject(items),
        rules: rulesToObject(rules),
        assignments: assignmentsToObject(assignments),
      });
    } catch (err) {
      next(err);
    }
  }
}
