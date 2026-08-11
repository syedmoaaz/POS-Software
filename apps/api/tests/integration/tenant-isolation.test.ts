import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { bootTestApp, login, shutdownTestApp, type TestFixture } from "../helpers.js";

describe("tenant isolation", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await bootTestApp();
  });

  afterAll(async () => {
    await shutdownTestApp();
  });

  it("does not leak tenant A products to tenant B", async () => {
    const a = await login(fx.app, fx.ownerA.email, fx.ownerA.password);
    const b = await login(fx.app, fx.ownerB.email, fx.ownerB.password);

    const productsA = await request(fx.app).get("/api/v1/products").set("Cookie", a.cookie);
    expect(productsA.status).toBe(200);
    expect(productsA.body.data.length).toBeGreaterThan(0);
    const variantId = productsA.body.data[0].variants[0].id;

    const productsB = await request(fx.app).get("/api/v1/products").set("Cookie", b.cookie);
    expect(productsB.status).toBe(200);
    expect(productsB.body.data.length).toBe(0);

    const getA = await request(fx.app)
      .get(`/api/v1/products/${productsA.body.data[0].id}`)
      .set("Cookie", b.cookie);
    expect(getA.status).toBe(404);

    // Tenant B cannot checkout tenant A variant
    const openB = await request(fx.app)
      .get("/api/v1/context")
      .set("Cookie", b.cookie);
    expect(openB.status).toBe(200);

    // Even with A's ids, B session cannot sell A's stock
    const checkout = await request(fx.app)
      .post("/api/v1/sales/checkout")
      .set("Cookie", b.cookie)
      .set("Idempotency-Key", `iso-${Date.now()}`)
      .send({
        branchId: fx.branchA.id,
        registerId: fx.registerA.id,
        items: [{ variantId, qty: 1 }],
        payments: [{ method: "cash", amountMinor: 10000 }],
      });
    expect(checkout.status).toBeGreaterThanOrEqual(400);
  });
});
