import { Request, Response, NextFunction } from "express";
import requestIp from "request-ip";
import HttpStatus from "http-status-codes";
import { RuleParams } from "src/Rule";

export type RuleParamsFunction = (req: Request) => RuleParams;
export type MatchFunction = (req: Request) => boolean;

export type CheckAccessOptions = {
  roles: string[];
  allow?: boolean;
  params?: RuleParams | RuleParamsFunction;
  ips?: string[];
  match?: MatchFunction;
};

const checkAccess = (options: CheckAccessOptions) => {
  const { roles, allow = true, params = {}, ips, match } = options;

  const matchRole = async (req: Request) => {
    const user = req.user!;

    if (roles.length === 0) {
      return true;
    }

    let _params;
    if (typeof params === "function") {
      _params = params(req);
    } else {
      _params = params;
    }

    for (const role of roles) {
      if (role === "?") {
        if (user.isGuest) {
          return true;
        }
      } else if (role === "@") {
        if (!user.isGuest) {
          return true;
        }
      } else {
        if (await user.can(role, _params)) {
          return true;
        }
      }
    }

    return false;
  };

  const matchIP = (ip: string) => {
    if (!ips || ips.length === 0) {
      return true;
    }

    const wildCmp = (rule: string): boolean => {
      const pos = rule.indexOf("*");
      if (pos === -1) {
        return false;
      }

      return ip.substring(0, pos) === rule.substring(0, pos);
    };

    for (const rule of ips) {
      if (rule === "*" || rule === ip || wildCmp(rule)) {
        return true;
      }
    }

    return false;
  };

  const matchCustom = (req: Request) => {
    if (!match) {
      return true;
    }
    return match(req);
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next("req.user is not initialized");
    }

    if (!req.user.isGuest && !req.user.isActive) {
      return res.status(HttpStatus.UNAUTHORIZED).send("Inactive user");
    }

    try {
      if (
        req.user.isSuperuser ||
        ((await matchRole(req)) && matchIP(requestIp.getClientIp(req) ?? "") && matchCustom(req) && allow)
      ) {
        return next();
      }

      return res.status(HttpStatus.UNAUTHORIZED).send("Unauthorized");
    } catch (err) {
      next(err);
    }
  };
};

export default checkAccess;
