import { NextFunction, Request, Response } from "express";
import BaseManager from "./BaseManager";
import checkAccess, { CheckAccessOptions } from "./middleware/checkAccess";

export type RbacOptions = {
  authManager: BaseManager;
  rbacPath?: string;
};

export default class Rbac {
  private authManager: BaseManager | null = null;
  private rbacPath: string = "/rbac";

  initialize(options: RbacOptions) {
    this.authManager = options.authManager;

    if (options.rbacPath) {
      this.rbacPath = options.rbacPath;
    }

    return (req: Request, _res: Response, next: NextFunction) => {
      req.authManager = this.authManager;
      next();
    }
  }

  checkAccess(options: CheckAccessOptions) {
    return checkAccess(options);
  }
}
