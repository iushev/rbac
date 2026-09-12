import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

/**
 * The entry the Start plugin looks for. It has to be a function: the router is
 * built once per request on the server and once in the browser, and the two
 * must not share state.
 */
export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}
