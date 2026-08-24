import { beforeEach, describe, expect, it } from "vitest";

import { getToken, setToken } from "./session";

describe("session token storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when no token stored", () => {
    expect(getToken()).toBeNull();
  });

  it("persists and reads back a token", () => {
    setToken("abc.def.ghi");
    expect(getToken()).toBe("abc.def.ghi");
  });
});
