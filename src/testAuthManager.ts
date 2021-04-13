import { BaseManager, Item, ItemType, Permission, Role, Rule, RuleParams } from ".";

export interface AuthorRuleData {
  reallyReally: boolean;
}

export class AuthorRule extends Rule<AuthorRuleData> {
  constructor(name: string = "isAuthor", data?: AuthorRuleData) {
    super(name, {
      reallyReally: false,
      ...(data ?? {}),
    });
  }

  /**
   * @inheritdoc
   */
  public execute = (username: string, _item: Item, params: RuleParams) => {
    return params["authorId"] === username;
  };
}

export interface ActionRuleData {
  action: string;
}
export class ActionRule extends Rule<ActionRuleData> {
  constructor(name: string = "action_rule", data?: ActionRuleData) {
    super(name, {
      action: "read",
      ...(data ?? {}),
    });
  }

  /**
   * @inheritdoc
   */
  public execute = (_username: string, _item: Item, params: RuleParams) => {
    return this.data.action === "all" || this.data.action === params["action"];
  };
}

export async function prepareData(auth: BaseManager) {
  AuthorRule.init(auth);
  ActionRule.init(auth);

  const rule = new AuthorRule();
  await auth.add(rule);

  const uniqueTrait = auth.createPermission("Fast Metabolism");
  uniqueTrait.description =
    "Your metabolic rate is twice normal. This means that you are much less resistant to radiation and poison, but your body heals faster.";
  await auth.add(uniqueTrait);

  const createPost = auth.createPermission("createPost");
  // createPost.data = 'createPostData';
  createPost.description = "create a post";
  await auth.add(createPost);

  const readPost = auth.createPermission("readPost");
  readPost.description = "read a post";
  await auth.add(readPost);

  const deletePost = auth.createPermission("deletePost");
  deletePost.description = "delete a post";
  await auth.add(deletePost);

  const updatePost = auth.createPermission("updatePost");
  updatePost.description = "update a post";
  updatePost.ruleName = rule.name;
  await auth.add(updatePost);

  const updateAnyPost = auth.createPermission("updateAnyPost");
  updateAnyPost.description = "update any post";
  await auth.add(updateAnyPost);

  const withoutChildren = auth.createRole("withoutChildren");
  await auth.add(withoutChildren);

  const reader = auth.createRole("reader");
  await auth.add(reader);
  await auth.addChild(reader, readPost);

  const author = auth.createRole("author");
  // author->data = 'authorData';
  await auth.add(author);
  await auth.addChild(author, createPost);
  await auth.addChild(author, updatePost);
  await auth.addChild(author, reader);

  const admin = auth.createRole("admin");
  await auth.add(admin);
  await auth.addChild(admin, author);
  await auth.addChild(admin, updateAnyPost);

  await auth.assign(uniqueTrait, "reader A");

  await auth.assign(reader, "reader A");
  await auth.assign(author, "author B");
  await auth.assign(deletePost, "author B");
  await auth.assign(admin, "admin C");
}

export default (auth: BaseManager) => {
  afterEach(async () => {
    await auth.removeAll();
  });

  test("Create role", () => {
    const role = auth.createRole("admin");
    expect(role).toBeInstanceOf(Role);
    expect(role.type).toBe(ItemType.role);
    expect(role.name).toBe("admin");
  });

  test("Create permission", () => {
    const permission = auth.createPermission("edit post");
    expect(permission).toBeInstanceOf(Permission);
    expect(permission.type).toBe(ItemType.permission);
    expect(permission.name).toBe("edit post");
  });

  test("Add item", async () => {
    const role = auth.createRole("admin");
    role.description = "administrator";
    expect(await auth.add(role)).toBeTruthy();

    const permission = auth.createPermission("edit post");
    permission.description = "edit a post";
    expect(await auth.add(permission)).toBeTruthy();

    const rule = new AuthorRule();
    rule.name = "is author";
    rule.data.reallyReally = true;
    expect(await auth.add(rule)).toBeTruthy();

    // todo: check duplication of name
  });

  test("Get children", async () => {
    const user = auth.createRole("user");
    await auth.add(user);
    expect((await auth.getChildren(user.name)).size).toBe(0);

    const changeName = auth.createPermission("changeName");
    await auth.add(changeName);
    await auth.addChild(user, changeName);
    expect((await auth.getChildren(user.name)).size).toBe(1);
  });

  test("Get rule", async () => {
    await prepareData(auth);

    let rule = await auth.getRule("isAuthor");
    expect(rule).toBeTruthy();
    expect(rule).toBeInstanceOf(Rule);
    expect(rule?.name).toBe("isAuthor");

    rule = await auth.getRule("nonExisting");
    expect(rule).toBeNull();
  });

  test("Add rule", async () => {
    await prepareData(auth);

    const ruleName = "isReallyReallyAuthor";
    let rule: AuthorRule | null = new AuthorRule();
    rule.name = ruleName;
    rule.data.reallyReally = true;
    await auth.add(rule);

    rule = (await auth.getRule(ruleName)) as AuthorRule | null;
    expect(rule).toBeTruthy();
    expect(rule?.name).toBe(ruleName);
    expect(rule?.data.reallyReally).toBeTruthy();
  });

  test("Update rule", async () => {
    await prepareData(auth);

    let rule = (await auth.getRule("isAuthor")) as AuthorRule;
    rule!.name = "newName";
    rule!.data.reallyReally = false;
    await auth.update("isAuthor", rule);

    rule = (await auth.getRule("isAuthor")) as AuthorRule;
    expect(rule).toBeNull();

    rule = (await auth.getRule("newName")) as AuthorRule;
    expect(rule.name).toBe("newName");
    expect(rule.data.reallyReally).toBe(false);

    rule.data.reallyReally = true;
    await auth.update("newName", rule);

    rule = (await auth.getRule("newName")) as AuthorRule;
    expect(rule.data.reallyReally).toBe(true);

    let item = (await auth.getPermission("createPost")) as Permission;
    item.name = "new createPost";
    await auth.update("createPost", item);

    item = (await auth.getPermission("createPost")) as Permission;
    expect(item).toBeNull();

    item = (await auth.getPermission("new createPost")) as Permission;
    expect(item.name).toBe("new createPost");
  });

  test("Get rules", async () => {
    await prepareData(auth);

    const rule = new AuthorRule();
    rule.name = "isReallyReallyAuthor";
    rule.data.reallyReally = true;
    await auth.add(rule);

    const rules = await auth.getRules();

    const ruleNames = Array.from(rules.values()).map((rule) => {
      return rule.name;
    });
    expect(ruleNames).toContain("isReallyReallyAuthor");
    expect(ruleNames).toContain("isAuthor");
  });

  test("Remove rule", async () => {
    await prepareData(auth);

    await auth.remove((await auth.getRule("isAuthor"))!);
    const rules = await auth.getRules();
    expect(rules.size).toBe(0);

    await auth.remove((await auth.getPermission("createPost"))!);
    const item = await auth.getPermission("createPost");
    expect(item).toBeNull();
  });

  test("Check access", async () => {
    await prepareData(auth);

    const testSuites: {
      [username: string]: {
        [permissionName: string]: boolean;
      };
    } = {
      "reader A": {
        createPost: false,
        readPost: true,
        updatePost: false,
        updateAnyPost: false,
      },
      "author B": {
        createPost: true,
        readPost: true,
        updatePost: true,
        deletePost: true,
        updateAnyPost: false,
      },
      "admin C": {
        createPost: true,
        readPost: true,
        updatePost: false,
        updateAnyPost: true,
        blablabla: false,
        null: false,
      },
      guest: {
        // all actions denied for guest (user not exists)
        createPost: false,
        readPost: false,
        updatePost: false,
        deletePost: false,
        updateAnyPost: false,
        blablabla: false,
        null: false,
      },
    };

    const params = {
      authorId: "author B",
    };

    await Promise.all(
      Object.keys(testSuites).reduce<Promise<void>[]>((prevValue, username) => {
        const tests = testSuites[username];

        Object.keys(tests).forEach((permissionName) => {
          prevValue.push(
            (async () => {
              const result = await auth.checkAccessAsync(username, permissionName, params);
              expect(result).toBe(tests[permissionName]);
            })()
          );
        });

        return prevValue;
      }, [])
    );
  });

  test("Get permissions by role", async () => {
    await prepareData(auth);

    const permissions = await auth.getPermissionsByRole("admin");
    const expectedPermissions = ["createPost", "updatePost", "readPost", "updateAnyPost"];
    expect(permissions.size).toBe(expectedPermissions.length);
    expectedPermissions.forEach((permissionName) => {
      expect(permissions.get(permissionName)).toBeInstanceOf(Permission);
    });
  });

  test("Get permissions by user", async () => {
    await prepareData(auth);

    const permissions = await auth.getPermissionsByUser("author B");
    const expectedPermissions = ["deletePost", "createPost", "updatePost", "readPost"];
    expect(permissions.size).toBe(expectedPermissions.length);
    expectedPermissions.forEach((permissionName) => {
      expect(permissions.get(permissionName)).toBeInstanceOf(Permission);
    });
  });

  test("Get role", async () => {
    await prepareData(auth);

    const author = await auth.getRole("author");
    expect(author?.type).toBe(ItemType.role);
    expect(author?.name).toBe("author");
    // expect(author?.data).toBe('authorData');
  });

  test("Get permission", async () => {
    await prepareData(auth);

    const createPost = await auth.getPermission("createPost");
    expect(createPost?.type).toBe(ItemType.permission);
    expect(createPost?.name).toBe("createPost");
    // expect(createPost?.data).toBe('createPostData'););
  });

  test("Get roles by user", async () => {
    await prepareData(auth);

    const reader = (await auth.getRole("reader")) as Role;
    await auth.assign(reader, "0");
    await auth.assign(reader, "123");

    let roles = await auth.getRolesByUser("reader A");
    expect(roles.get("reader")).toBeInstanceOf(Role);
    expect(roles.get("reader")?.name).toBe("reader");

    roles = await auth.getRolesByUser("0");
    expect(roles.get("reader")).toBeInstanceOf(Role);
    expect(roles.get("reader")?.name).toBe("reader");

    roles = await auth.getRolesByUser("123");
    expect(roles.get("reader")).toBeInstanceOf(Role);
    expect(roles.get("reader")?.name).toBe("reader");

    expect(roles.has("myDefaultRole")).toBe(true);
  });

  test("Get child roles", async () => {
    await prepareData(auth);

    let roles = await auth.getChildRoles("withoutChildren");
    expect(roles.size).toBe(1);
    expect(roles.values().next().value).toBeInstanceOf(Role);
    expect((roles.values().next().value as Role).name).toBe("withoutChildren");

    roles = await auth.getChildRoles("reader");
    expect(roles.size).toBe(1); // 1 ???
    expect(roles.values().next().value).toBeInstanceOf(Role);
    expect((roles.values().next().value as Role).name).toBe("reader");

    roles = await auth.getChildRoles("author");
    expect(roles.size).toBe(2); // 2 ???
    expect(roles.has("author")).toBe(true);
    expect(roles.has("reader")).toBe(true);

    roles = await auth.getChildRoles("admin");
    expect(roles.size).toBe(3); // 3 ???
    expect(roles.has("admin")).toBe(true);
    expect(roles.has("author")).toBe(true);
    expect(roles.has("reader")).toBe(true);
  });

  test("Assign multiple roles", async () => {
    await prepareData(auth);

    const reader = (await auth.getRole("reader")) as Role;
    const author = (await auth.getRole("author")) as Role;
    await auth.assign(reader, "readingAuthor");
    await auth.assign(author, "readingAuthor");

    // auth = createManager();

    const roles = await auth.getRolesByUser("readingAuthor");
    expect(roles.has("reader")).toBe(true);
    expect(roles.has("author")).toBe(true);
  });

  test("Get assignments by role", async () => {
    await prepareData(auth);

    const reader = (await auth.getRole("reader")) as Role;
    await auth.assign(reader, "123");

    // auth = createManager();

    const usersNonExistingRole = await auth.getUsernamesByRole("nonexisting");
    expect(usersNonExistingRole).toHaveLength(0);

    const usersReader = await auth.getUsernamesByRole("reader");
    expect(usersReader).toHaveLength(2);
    expect(usersReader).toContain("reader A");
    expect(usersReader).toContain("123");

    const usersAuthor = await auth.getUsernamesByRole("author");
    expect(usersAuthor).toHaveLength(1);
    expect(usersAuthor).toContain("author B");

    const usersAdmin = await auth.getUsernamesByRole("admin");
    expect(usersAdmin).toHaveLength(1);
    expect(usersAdmin).toContain("admin C");
  });

  test("Can add child", async () => {
    await prepareData(auth);

    const author = auth.createRole("author");
    const reader = auth.createRole("reader");

    expect(await auth.canAddChild(author, reader)).toBe(true);
    expect(await auth.canAddChild(reader, author)).toBe(false);
  });

  test("Remove all rules", async () => {
    await prepareData(auth);

    await auth.removeAllRules();

    expect((await auth.getRules()).size).toBe(0);

    expect((await auth.getRoles()).size).toBeGreaterThan(0);
    expect((await auth.getPermissions()).size).toBeGreaterThan(0);
  });

  test("Remove all roles", async () => {
    await prepareData(auth);

    await auth.removeAllRoles();

    expect((await auth.getRoles()).size).toBe(0);

    expect((await auth.getRules()).size).toBeGreaterThan(0);
    expect((await auth.getPermissions()).size).toBeGreaterThan(0);
  });

  test("Remove all permissions", async () => {
    await prepareData(auth);

    await auth.removeAllPermissions();

    expect((await auth.getPermissions()).size).toBe(0);

    expect((await auth.getRules()).size).toBeGreaterThan(0);
    expect((await auth.getRoles()).size).toBeGreaterThan(0);
  });

  test("Assign rule to role", async () => {
    await testAssignRule(ItemType.role);
  });

  test("Assign rule to permission", async () => {
    await testAssignRule(ItemType.permission);
  });

  async function testAssignRule(itemType: ItemType) {
    const username = "3";

    await auth.removeAll();
    let item = createRBACItem(itemType, "Admin");
    await auth.add(item);
    await auth.assign(item, username);
    expect(await auth.checkAccessAsync(username, "Admin", {})).toBe(true);

    // with normal register rule
    await auth.removeAll();
    const rule = new ActionRule();
    await auth.add(rule);
    item = createRBACItem(itemType, "Reader");
    item.ruleName = rule.name;
    await auth.add(item);
    await auth.assign(item, username);
    expect(await auth.checkAccessAsync(username, "Reader", { action: "read" })).toBe(true);
    expect(await auth.checkAccessAsync(username, "Reader", { action: "write" })).toBe(false);

    // update role and rule
    const allRule = new ActionRule();
    allRule.name = "all_rule";
    allRule.data.action = "all";
    await auth.add(allRule);
    item = (await getRBACItem(itemType, "Reader"))!;
    item.name = "AdminPost";
    item.ruleName = "all_rule";
    await auth.update("Reader", item);
    expect(await auth.checkAccessAsync(username, "AdminPost", { action: "print" })).toBe(true);

    //     // using rule class name
    //     $auth.removeAll();
    //     $item = createRBACItem($RBACItemType, 'Reader');
    //     $item->ruleName = 'yiiunit\framework\rbac\ActionRule';
    //     $auth.add($item);
    //     $auth.assign($item, $userId);
    //     assertTrue($auth.checkAccess($userId, 'Reader', ['action' => 'read']));
    //     assertFalse($auth.checkAccess($userId, 'Reader', ['action' => 'write']));

    //     // using DI
    //     \Yii::$container->set('write_rule', ['class' => 'yiiunit\framework\rbac\ActionRule', 'action' => 'write']);
    //     \Yii::$container->set('delete_rule', ['class' => 'yiiunit\framework\rbac\ActionRule', 'action' => 'delete']);
    //     \Yii::$container->set('all_rule', ['class' => 'yiiunit\framework\rbac\ActionRule', 'action' => 'all']);

    //     $item = createRBACItem($RBACItemType, 'Writer');
    //     $item->ruleName = 'write_rule';
    //     $auth.add($item);
    //     $auth.assign($item, $userId);
    //     assertTrue($auth.checkAccess($userId, 'Writer', ['action' => 'write']));
    //     assertFalse($auth.checkAccess($userId, 'Writer', ['action' => 'update']));

    //     $item = createRBACItem($RBACItemType, 'Deleter');
    //     $item->ruleName = 'delete_rule';
    //     $auth.add($item);
    //     $auth.assign($item, $userId);
    //     assertTrue($auth.checkAccess($userId, 'Deleter', ['action' => 'delete']));
    //     assertFalse($auth.checkAccess($userId, 'Deleter', ['action' => 'update']));

    //     $item = createRBACItem($RBACItemType, 'Author');
    //     $item->ruleName = 'all_rule';
    //     $auth.add($item);
    //     $auth.assign($item, $userId);
    //     assertTrue($auth.checkAccess($userId, 'Author', ['action' => 'update']));
  }

  test("Revoke rule from role", async () => {
    await testRevokeRule(ItemType.role);
  });

  test("Revoke rule from permission", async () => {
    await testRevokeRule(ItemType.permission);
  });

  async function testRevokeRule(itemType: ItemType) {
    const username = "3";

    await auth.removeAll();
    let item = createRBACItem(itemType, "Admin");
    await auth.add(item);
    await auth.assign(item, username);
    expect(await auth.revoke(item, username)).toBe(true);
    expect(await auth.checkAccessAsync(username, "Admin", {})).toBe(false);

    await auth.removeAll();
    const rule = new ActionRule();
    await auth.add(rule);
    item = createRBACItem(itemType, "Reader");
    item.ruleName = rule.name;
    await auth.add(item);
    await auth.assign(item, username);
    expect(await auth.revoke(item, username)).toBe(true);
    expect(await auth.checkAccessAsync(username, "Reader", { action: "read" })).toBe(false);
    expect(await auth.checkAccessAsync(username, "Reader", { action: "write" })).toBe(false);
  }

  /**
   * Create Role or Permission RBAC item.
   * @param {ItemType} itemType
   * @param {string} name
   * @return {Permission | Role}
   */
  function createRBACItem(itemType: ItemType, name: string): Permission | Role {
    if (itemType === ItemType.role) {
      return auth.createRole(name);
    }
    if (itemType === ItemType.permission) {
      return auth.createPermission(name);
    }

    throw new Error("Invalid argument");
  }

  /**
   * Get Role or Permission RBAC item.
   * @param {ItemType} itemType
   * @param {string} name
   * @return {Promise<Permission | Role | null>}
   */
  function getRBACItem(itemType: ItemType, name: string): Promise<Permission | Role | null> {
    if (itemType === ItemType.role) {
      return auth.getRole(name);
    }
    if (itemType === ItemType.permission) {
      return auth.getPermission(name);
    }

    throw new Error("Invalid argument");
  }

  // /**
  //  * @see https://github.com/yiisoft/yii2/issues/10176
  //  * @see https://github.com/yiisoft/yii2/issues/12681
  //  */
  // public function testRuleWithPrivateFields()
  // {
  //     $auth = auth;

  //     $auth.removeAll();

  //     $rule = new ActionRule();
  //     $auth.add($rule);

  //     /** @var ActionRule $rule */
  //     $rule = auth.getRule('action_rule');
  //     assertInstanceOf(ActionRule::className(), $rule);
  // }

  // public function testDefaultRolesWithClosureReturningNonArrayValue()
  // {
  //     expectException('yii\base\InvalidValueException');
  //     expectExceptionMessage('Default roles closure must return an array');
  //     auth.defaultRoles = function () {
  //         return 'test';
  //     };
  // }

  // public function testDefaultRolesWithNonArrayValue()
  // {
  //     expectException('yii\base\InvalidArgumentException');
  //     expectExceptionMessage('Default roles must be either an array or a callable');
  //     auth.defaultRoles = 'test';
  // }
};
