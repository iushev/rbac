import HttpStatus from "http-status-codes";
import path from "path";

import { BaseManager, User, Identity, checkAccess, JsonManager } from "../../src";

describe("Testing check access middleware", () => {
  let authManager: BaseManager;
  let user: User;

  const userReader: Identity = {
    username: "reader",
    isActive: true,
    isSuperuser: false,
  };

  const userAuthor: Identity = {
    username: "author",
    isActive: true,
    isSuperuser: false,
  };

  const userAdmin: Identity = {
    username: "admin",
    isActive: true,
    isSuperuser: false,
  };

  beforeAll(() => {
    authManager = new JsonManager({
      itemFile: path.join(__dirname, "../assets/rbac_items.json"),
      assignmentFile: path.join(__dirname, "../assets/rbac_assignments.json"),
      ruleFile: path.join(__dirname, "../assets/rbac_rules.json"),
      logging: false,
    });
    user = new User(authManager);
  });

  afterAll(async () => {
    authManager.removeAll();
  });

  const mockRequest = (): any => ({
    user,
    authManager,
    headers: {},
  });

  const mockResponse = (): any => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test("Check reader access", async () => {
    user.identity = userReader;

    const req = mockRequest();
    const res = mockResponse();
    const callback = jest.fn();

    await checkAccess({ roles: ["createPost"] })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({ roles: ["readPost"] })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      roleParams: { author: userAuthor.username },
    })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      roleParams: () => ({ author: userAuthor.username }),
    })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();
  });

  test("Check author access", async () => {
    user.identity = userAuthor;

    const req = mockRequest();
    const res = mockResponse();
    const callback = jest.fn();

    await checkAccess({ roles: ["createPost"] })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({ allow: false, roles: ["createPost"] })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({ roles: ["readPost"] })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      roleParams: { author: userAuthor.username },
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      roleParams: () => ({ author: userAuthor.username }),
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      allow: false,
      roleParams: { author: userAdmin.username },
    })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      allow: false,
      roleParams: () => ({ author: userAdmin.username }),
    })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();
  });

  test("Check admin access", async () => {
    user.identity = userAdmin;

    const req = mockRequest();
    const res = mockResponse();
    const callback = jest.fn();

    await checkAccess({ roles: ["createPost"] })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({ allow: false, roles: ["createPost"], roleParams: [] })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({ roles: ["readPost"] })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      roleParams: { author: userAuthor.username },
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      roleParams: () => ({ author: userAuthor.username }),
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();
  });
});
