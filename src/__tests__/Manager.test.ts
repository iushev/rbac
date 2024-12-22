import MockManager, { prepareData } from "./MockManager";

test("Check access", async () => {
  const manager = new MockManager();
  await prepareData(manager);

  const testSuites: {
    [username: string]: {
      [permissionName: string]: boolean;
    };
  } = {
    reader: {
      createPost: false,
      readPost: true,
      deletePost: false,
      updatePost: false,
    },
    "author A": {
      createPost: true,
      readPost: true,
      deletePost: true,
      updatePost: true,
    },
    "author B": {
      createPost: true,
      readPost: true,
      deletePost: false,
      updatePost: false,
    },
    admin: {
      createPost: true,
      readPost: true,
      updateOwnPost: false,
      updatePost: true,
      blaBlaBla: false,
      null: false,
    },
    guest: {
      // all actions denied for guest (user not exists)
      createPost: false,
      readPost: false,
      updateOwnPost: false,
      deletePost: false,
      updatePost: false,
      blaBlaBla: false,
      null: false,
    },
  };

  const params = {
    authorId: "author A",
  };

  await Promise.all(
    Object.keys(testSuites).reduce<Promise<void>[]>((prevValue, username) => {
      const tests = testSuites[username];

      Object.keys(tests).forEach((permissionName) => {
        prevValue.push(
          (async () => {
            const result = await manager.checkAccess(username, permissionName, params);
            expect(result).toBe(tests[permissionName]);
          })(),
        );
      });

      return prevValue;
    }, []),
  );
});
