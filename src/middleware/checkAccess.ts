import { Request, Response, NextFunction } from "express";
import requestIp from "request-ip";
import HttpStatus from "http-status-codes";

import { RuleParams } from "../Rule";
import matchRole from "../matchRole";

export type RuleParamsFunction = (req: Request) => RuleParams;
export type MatchFunction = (req: Request) => boolean;

export type CheckAccessOptions = {
  roles: string[];
  allow?: boolean;
  params?: RuleParams | RuleParamsFunction;
  ips?: string[];
  match?: MatchFunction;
  logging?: false | ((...args: any[]) => void);
};

const checkAccess = (options: CheckAccessOptions) => {
  const { roles, allow = true, params = {}, ips, match, logging = false } = options;
  const matchIP = (ip: string) => {
    if (!ips || ips.length === 0) {
      if (logging) {
        logging("No IP restrictions set, allowing all IPs");
      }
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
      if (logging) {
        logging("No custom match function provided, allowing all requests");
      }
      return true;
    }
    return match(req);
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      if (logging) {
        logging("req.user is not initialized");
      }
      return next("req.user is not initialized");
    }

    if (!req.user.isGuest && !req.user.isActive) {
      if (logging) {
        logging(`User ${req.user.username} is inactive`);
      }
      return res.status(HttpStatus.UNAUTHORIZED).send("Inactive user");
    }

    try {
      if (
        req.user.isSuperuser ||
        ((await matchRole({
          user: req.user,
          roles,
          allow,
          params: typeof params === "function" ? params(req) : params,
          logging,
        })) &&
          matchIP(requestIp.getClientIp(req) ?? "") &&
          matchCustom(req) &&
          allow)
      ) {
        if (logging) {
          logging(`Access granted to user ${req.user.username} for roles [${roles.join(", ")}]`);
        }
        return next();
      }

      if (logging) {
        logging(`Access denied to user ${req.user.username} for roles [${roles.join(", ")}]`);
      }
      return res.status(HttpStatus.UNAUTHORIZED).send("Unauthorized");
    } catch (err) {
      next(err);
    }
  };
};

export default checkAccess;
