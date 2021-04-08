import express, { NextFunction, Request, Response } from "express";
import HttpStatus from "http-status-codes";

import { Item, ItemType } from "../Item";
import { Rule } from "../Rule";
import { Assignment } from "../Assignment";

export type ResponseItem = {
  type: ItemType;
  name: string;
  description?: string;
  ruleName?: string;
  children?: string[];
};

export type ResponseRule = {
  name: string;
  data: {
    typeName: string;
    rule: string;
  };
};

export type RBACResponse = {
  items: {
    [key: string]: ResponseItem;
  };
  rules: {
    [ruleName: string]: ResponseRule;
  };
  assignments: string[];
};

export async function getRbac(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user || !req.user.username) {
    res.sendStatus(HttpStatus.UNAUTHORIZED);
    return;
  }

  try {
    const itemsToObject = (mapItems: Map<string, Item>, mapParents: Map<string, Map<string, Item>>) => {
      const items: {
        [itemName: string]: ResponseItem;
      } = {};
      for (let [itemName, item] of mapItems) {
        items[itemName] = {
          type: item.type,
          name: item.name,
          description: item.description ?? undefined,
          ruleName: item.ruleName ?? undefined,
        };

        const children = new Map();
        mapParents.forEach((parents, childName) => {
          if (parents.has(itemName)) {
            children.set(childName, mapItems.get(childName));
          }
        });

        if (children) {
          items[itemName].children = [];
          for (let childName of children.keys()) {
            items[itemName].children?.push(childName);
          }
        }
      }
      return items;
    };

    const rulesToObject = (mapRules: Map<string, Rule>) => {
      const rules: {
        [ruleName: string]: ResponseRule;
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

    const { items, parents, rules } = await req.authManager.getRBAC();
    const assignments = await req.authManager.getAssignments(req.user.username);

    res.status(HttpStatus.OK).json({
      items: await itemsToObject(items, parents),
      rules: rulesToObject(rules),
      assignments: assignmentsToObject(assignments),
    });
  } catch (err) {
    next(err);
  }
}