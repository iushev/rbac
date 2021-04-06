import http from "http";
import express from "express";
import supertest from "supertest";
import path from "path";

import rbac, { Server, BaseManager, JsonManager, User } from "../src";

describe("RBAC Server", () => {
  let authManager: BaseManager;
  let server: Server;
  let app: express.Application;
  let httpServer: http.Server;
  let getUser: (() => User) | null = null;

  beforeAll(async () => {
    // init http server;
    authManager = new JsonManager({
      itemFile: path.join(__dirname, "/assets/rbac_items.json"),
      assignmentFile: path.join(__dirname, "/assets/rbac_assignments.json"),
      ruleFile: path.join(__dirname, "/assets/rbac_rules.json"),
      // logging: false,
    });

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

    server = new Server(app, {
      path: "/api/rbac",
    });

    await new Promise<void>((resolve, _reject) => {
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
      })
    );
  });

  test("Get RBAC Items", async () => {
    getUser = () => {
      const user = new User(authManager);
      user.identity = {
        username: "reader",
        isActive: true,
        isSuperuser: false
      }
      return user;
    }

    const response = await supertest(httpServer).get("/api/rbac");
    console.log(JSON.stringify(response.body, null, 2));
    expect(response).toBeTruthy();
    expect(response.body.items).toBeTruthy();
    expect(response.body.rules).toBeTruthy();
    expect(response.body.assignments).toBeTruthy();

    getUser = null;
  });
});
