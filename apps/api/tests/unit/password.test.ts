import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password.js";

describe("password hashing", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("demo1234");
    expect(hash).not.toBe("demo1234");
    expect(await verifyPassword("demo1234", hash)).toBe(true);
    expect(await verifyPassword("nope", hash)).toBe(false);
  });
});
