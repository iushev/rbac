import http from "http";
import express from "express";
import request from "supertest";

import MockManager, { prepareData } from "../MockManager";
import BaseManager from "../../BaseManager";
import User from "../../User";
import rbac from "../../index";
import { getRbac } from "../../middleware/getRbac";

describe("RBAC Server", () => {
  let authManager: BaseManager;
  let app: express.Application;
  let httpServer: http.Server;
  let getUser: (() => User) | null = null;

  beforeAll(async () => {
    // init http server;
    authManager = new MockManager();
    await prepareData(authManager);

    app = express();
    app.set("env", "test");
    app.use((req, _res, next) => {
      if (getUser) {
        req.user = getUser();
      }
      next();
    });
    app.use(rbac.initialize({ authManager }));
    httpServer = http.createServer(app);

    app.get("/api/rbac", getRbac);

    await new Promise<void>((resolve) => {
      httpServer.listen(3000, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) =>
      httpServer.close((err) => {
        if (err) {
          console.error(err);
        }
        resolve();
      }),
    );
  });

  test("Get RBAC Items", async () => {
    getUser = () => {
      const user = new User(authManager);
      user.identity = {
        username: "reader",
        isActive: true,
        isSuperuser: false,
      };
      return user;
    };

    const response = await request(httpServer).get("/api/rbac");
    expect(response).toBeTruthy();
    expect(response.body.items).toBeTruthy();
    expect(response.body.rules).toBeTruthy();
    expect(response.body.assignments).toBeTruthy();

    getUser = null;
  });
});
