import { describe, expect, it } from "vitest";

import {
  ForbiddenError,
  RbacHttpError,
  UnauthorizedError,
  isRbacHttpError,
  reviveRbacHttpError,
} from "./errors.js";

describe("errors", () => {
  it("carries the status twice, for both Express-shaped conventions", () => {
    const error = new ForbiddenError(["updatePost"]);

    expect(error.status).toBe(403);
    expect(error.statusCode).toBe(403);
    expect(error.expose).toBe(true);
    expect(error.required).toEqual(["updatePost"]);
    expect(error.name).toBe("ForbiddenError");
  });

  it("distinguishes a guest from a refused user", () => {
    expect(new UnauthorizedError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
  });

  it("recognises its own errors and nothing else", () => {
    expect(isRbacHttpError(new UnauthorizedError())).toBe(true);
    expect(isRbacHttpError(new Error("nope"))).toBe(false);
    expect(isRbacHttpError({ status: 403 })).toBe(false);
  });

  it("revives the subclass the status implies", () => {
    const revived = reviveRbacHttpError({ status: 401, message: "sign-in required", required: [] });

    expect(revived).toBeInstanceOf(UnauthorizedError);
    expect(revived.message).toBe("sign-in required");
  });

  it("falls back to the base class for a status a guard never produces", () => {
    const revived = reviveRbacHttpError({ status: 418, message: "teapot", required: [] });

    expect(revived).toBeInstanceOf(RbacHttpError);
    expect(revived).not.toBeInstanceOf(ForbiddenError);
    expect(revived.status).toBe(418);
  });
});
