import { NextFunction, Request, RequestHandler, Response } from "express";
import BaseManager from "./BaseManager";

import checkAccess, { CheckAccessOptions } from "./middleware/checkAccess";

export type RbacOptions = {
  authManager: BaseManager;
};

export default class Rbac {
  declare private authManager: BaseManager;

  initialize(options: RbacOptions): RequestHandler {
    this.authManager = options.authManager;

    return async (req: Request, _res: Response, next: NextFunction) => {
      req.authManager = this.authManager;
      next();
    };
  }

  checkAccess(options: CheckAccessOptions) {
    return checkAccess(options);
  }
}
