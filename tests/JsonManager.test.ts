import path from "path";
import fs from "fs";

import { JsonManager } from "rbac";

import authManagerTest from "./AuthManager";

describe("Testing JsonManager", () => {
  let auth = new JsonManager({
    itemFile: path.join(__dirname, "/rbacItems.json"),
    assignmentFile: path.join(__dirname, "/rbacAssignments.json"),
    ruleFile: path.join(__dirname, "/rbacRules.json"),
    defaultRoles: ["myDefaultRole"],
    logging: false,
  });

  afterAll(() => {
    fs.unlinkSync(path.join(__dirname, "/rbacItems.json"));
    fs.unlinkSync(path.join(__dirname, "/rbacAssignments.json"));
    fs.unlinkSync(path.join(__dirname, "/rbacRules.json"));
  });

  authManagerTest(auth);
});
