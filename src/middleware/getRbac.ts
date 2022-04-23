import express, { NextFunction, Request, Response } from "express";
import HttpStatus from "http-status-codes";

import { IItem, ItemType } from "../Item";
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

export type Assignments = {
  [username: string]: string[];
};

export type RBACResponse = {
  items: {
    [itemName: string]: ResponseItem;
  };
  rules: {
    [ruleName: string]: ResponseRule;
  };
  assignments: Assignments;
};

const itemsToObject = (mapItems: Map<string, IItem>, mapParents: Map<string, Map<string, IItem>>) => {
  const items: {
    [itemName: string]: ResponseItem;
  } = {};
  for (const [itemName, item] of mapItems) {
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
      for (const childName of children.keys()) {
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

  for (const rule of mapRules.values()) {
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
  const assignments: Assignments = {};

  for (const assignment of userAssignments.values()) {
    if (!assignments[assignment.username]) {
      assignments[assignment.username] = [];
    }
    assignments[assignment.username].push(assignment.itemName);
  }

  return assignments;
};

export async function getRbac(req: Request, res: Response<RBACResponse>, next: NextFunction): Promise<void> {
  if (!req.user || !req.user.username) {
    res.sendStatus(HttpStatus.UNAUTHORIZED);
    return;
  }

  try {
    const { items, parents, rules } = await req.authManager.getRBAC();
    const assignments = await req.authManager.getAssignments(req.user.username);

    res.status(HttpStatus.OK).json({
      items: itemsToObject(items, parents),
      rules: rulesToObject(rules),
      assignments: assignmentsToObject(assignments),
    });
  } catch (err) {
    next(err);
  }
}
