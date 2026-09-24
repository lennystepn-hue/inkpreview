import { describe, expect, it } from "vitest";

import { flashNo, flashTilt, styleName } from "./flash";

describe("flash helpers", () => {
  it("numbers a design stably in the 100–999 range", () => {
    const n = flashNo("3f2a9c");
    expect(n).toBe(flashNo("3f2a9c"));
    const v = Number(n.replace("№ ", ""));
    expect(v).toBeGreaterThanOrEqual(100);
    expect(v).toBeLessThanOrEqual(999);
  });

  it("keeps the tilt within bounds", () => {
    for (const id of ["a", "b", "c", "0f1e2d3c", "/flash/koi.png"]) {
      const t = flashTilt(id, 2);
      expect(t).toBeGreaterThanOrEqual(-2);
      expect(t).toBeLessThanOrEqual(2);
    }
  });

  it("resolves the first style's display name", () => {
    const styles = [{ slug: "fine-line", name: "Fine Line" }] as never;
    expect(styleName(["fine-line"], styles)).toBe("Fine Line");
    expect(styleName(["unknown"], styles)).toBeNull();
    expect(styleName([], styles)).toBeNull();
  });
});
