import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { bootTestApp, login, shutdownTestApp, type TestFixture } from "../helpers.js";

describe("purchases", () => {
  let fx: TestFixture;
  let cookie: string;

  beforeAll(async () => {
    fx = await bootTestApp();
    cookie = (await login(fx.app, fx.ownerA.email, fx.ownerA.password)).cookie;
  });

  afterAll(async () => {
    await shutdownTestApp();
  });

  it("creates supplier and receives purchase", async () => {
    const supplier = await request(fx.app)
      .post("/api/v1/suppliers")
      .set("Cookie", cookie)
      .send({ name: "Test Supplier", phone: "0300-0000000" });
    expect(supplier.status).toBe(201);

    const receive = await request(fx.app)
      .post("/api/v1/purchases/receive")
      .set("Cookie", cookie)
      .send({
        branchId: fx.branchA.id,
        supplierId: supplier.body.data.id,
        payNowMinor: 0,
        lines: [{ variantId: fx.variantA.id, qty: 5, unitCostMinor: 4000 }],
      });
    expect(receive.status).toBe(201);
    expect(receive.body.data.number).toMatch(/^GRN-/);
    expect(receive.body.data.paymentStatus).toBe("unpaid");
  });
});
