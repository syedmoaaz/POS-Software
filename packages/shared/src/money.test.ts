import { describe, it, expect } from "vitest";
import { formatMoney, toMinor, fromMinor } from "./index.js";

describe("money helpers", () => {
  it("converts major/minor", () => {
    expect(toMinor(12.5)).toBe(1250);
    expect(fromMinor(1250)).toBe(12.5);
  });

  it("formats PKR", () => {
    const formatted = formatMoney(125099, "PKR", "en-PK");
    expect(formatted).toContain("1,250.99");
  });
});
