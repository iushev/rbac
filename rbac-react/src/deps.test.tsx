import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLatest, useStableParams, useStableRoles } from "./deps.js";

describe("useStableParams", () => {
  it("keeps the first object while the values stay the same", () => {
    const post = { id: 1 };
    const { result, rerender } = renderHook(({ params }) => useStableParams(params), {
      initialProps: { params: { post } },
    });
    const first = result.current;

    rerender({ params: { post } });

    expect(result.current).toBe(first);
  });

  it("returns the new object when a value changes", () => {
    const { result, rerender } = renderHook(({ params }) => useStableParams(params), {
      initialProps: { params: { post: { id: 1 } } },
    });
    const first = result.current;

    rerender({ params: { post: { id: 2 } } });

    expect(result.current).not.toBe(first);
  });

  it("returns one and the same object for undefined", () => {
    const { result, rerender } = renderHook(() => useStableParams(undefined));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current).toEqual({});
  });
});

describe("useStableRoles", () => {
  it("keeps the first array while the names stay the same", () => {
    const { result, rerender } = renderHook(({ roles }) => useStableRoles(roles), {
      initialProps: { roles: ["admin", "author"] },
    });
    const first = result.current;

    rerender({ roles: ["admin", "author"] });

    expect(result.current).toBe(first);
  });

  it("returns the new array when the names differ", () => {
    const { result, rerender } = renderHook(({ roles }) => useStableRoles(roles), {
      initialProps: { roles: ["admin"] },
    });
    const first = result.current;

    rerender({ roles: ["author"] });

    expect(result.current).not.toBe(first);
  });
});

describe("useLatest", () => {
  it("hands out the newest value without changing identity", () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 1 },
    });
    const ref = result.current;

    rerender({ value: 2 });

    expect(result.current).toBe(ref);
    expect(ref.current).toBe(2);
  });
});
