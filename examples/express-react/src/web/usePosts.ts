import { useCallback, useEffect, useState } from "react";

import type { Post } from "../shared/api.js";
import { ApiError, api } from "./api.js";
import { useSession } from "./session.js";

interface PostsState {
  posts: Post[];
  error: ApiError | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

/**
 * The posts of the current user, straight from the guarded endpoint.
 *
 * The UI hides what a user may not do, but the list itself is behind
 * `can("viewPost")` on the server — a guest gets 401 here, not an empty array.
 */
export function usePosts(): PostsState {
  const { user } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setPosts(await api<Post[]>("/posts"));
      setError(null);
    } catch (cause: unknown) {
      if (!(cause instanceof ApiError)) {
        throw cause;
      }
      setPosts([]);
      setError(cause);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // The identity decides the answer, so a new one asks again.
  useEffect(() => {
    void reload();
  }, [reload, user]);

  return { posts, error, isLoading, reload };
}
