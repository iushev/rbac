import { NextFunction, Request, Response } from "express";
import BaseManager from "./BaseManager";
import HttpStatus from "http-status-codes";

import checkAccess, { CheckAccessOptions } from "./middleware/checkAccess";
import { Item, ItemType } from "./Item";
import { Rule } from "./Rule";

export type RbacOptions = {
  authManager: BaseManager;
  rbacPath?: string;
};

export default class Rbac {
  private authManager!: BaseManager;
  private rbacPath: string = "/rbac";

  initialize(options: RbacOptions) {
    this.authManager = options.authManager;

    if (options.rbacPath) {
      this.rbacPath = options.rbacPath;
    }

    return async (req: Request, _res: Response, next: NextFunction) => {
      req.authManager = this.authManager;
      next();
    };
  }

  checkAccess(options: CheckAccessOptions) {
    return checkAccess(options);
  }
}
