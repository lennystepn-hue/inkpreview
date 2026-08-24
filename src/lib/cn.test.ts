import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("supports conditional classes", () => {
    const active = true;
    expect(cn("base", active && "on", !active && "off")).toBe("base on");
  });
});
