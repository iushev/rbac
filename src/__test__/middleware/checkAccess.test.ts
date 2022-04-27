import HttpStatus from "http-status-codes";

import checkAccess from "../../middleware/checkAccess";
import User, { Identity } from "../../User";
import MockManager, { prepareData } from "../MockManager";

describe("Testing check access middleware", () => {
  let authManager: MockManager;
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

  beforeAll(async () => {
    authManager = new MockManager();
    user = new User(authManager);
    await prepareData(authManager);
  });

  const mockRequest = (): any => ({
    user,
    authManager,
    headers: {},
  });

  const mockResponse = (): any => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
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
      params: { author: userAuthor.username },
    })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      params: () => ({ author: userAuthor.username }),
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
      params: { author: userAuthor.username },
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      params: () => ({ author: userAuthor.username }),
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      params: { author: "fake-user" },
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      allow: false,
      params: { author: userAdmin.username },
    })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      allow: false,
      params: () => ({ author: userAdmin.username }),
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

    await checkAccess({ allow: false, roles: ["createPost"], params: [] })(req, res, callback);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    res.status.mockClear();

    await checkAccess({ roles: ["readPost"] })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      params: { author: userAuthor.username },
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    await checkAccess({
      roles: ["updatePost"],
      params: () => ({ author: userAuthor.username }),
    })(req, res, callback);
    expect(callback).toHaveBeenCalled();
    callback.mockClear();
  });
});
