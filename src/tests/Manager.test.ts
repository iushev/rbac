import MockManager from "./MockManager";

describe("Test RBAC manager", () => {
  let manager: MockManager;

  beforeEach

  afterEach(async () => {
    await auth.removeAll();
  });

  test("Create role", () => {
    const role = auth.createRole("admin");
    expect(role).toBeInstanceOf(Role);
    expect(role.type).toBe(ItemType.role);
    expect(role.name).toBe("admin");
  });

});