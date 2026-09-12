import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without globals, so RTL's own auto-cleanup never registers.
afterEach(() => {
  cleanup();
});
