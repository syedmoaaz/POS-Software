import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { bootTestApp, login, shutdownTestApp, type TestFixture } from "../helpers.js";

describe("checkout + returns", () => {
  let fx: TestFixture;
  let cookie: string;
  let sessionId: string;

  beforeAll(async () => {
    fx = await bootTestApp();
    const auth = await login(fx.app, fx.ownerA.email, fx.ownerA.password);
    cookie = auth.cookie;

    const open = await request(fx.app)
      .post("/api/v1/register-sessions/open")
      .set("Cookie", cookie)
      .send({ registerId: fx.registerA.id, openingCashMinor: 100000 });
    expect(open.status).toBe(201);
    sessionId = open.body.data.id;
  });

  afterAll(async () => {
    await shutdownTestApp();
  });

  it("checks out with idempotency", async () => {
    const key = `test-checkout-${Date.now()}`;
    const body = {
      branchId: fx.branchA.id,
      registerId: fx.registerA.id,
      items: [{ variantId: fx.variantA.id, qty: 2 }],
      payments: [{ method: "cash", amountMinor: fx.variantA.retailPriceMinor * 2 }],
    };

    const first = await request(fx.app)
      .post("/api/v1/sales/checkout")
      .set("Cookie", cookie)
      .set("Idempotency-Key", key)
      .send(body);
    expect(first.status).toBe(201);
    expect(first.body.data.receiptNo).toBeTruthy();
    expect(first.body.meta.replayed).toBe(false);

    const second = await request(fx.app)
      .post("/api/v1/sales/checkout")
      .set("Cookie", cookie)
      .set("Idempotency-Key", key)
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.meta.replayed).toBe(true);
    expect(second.body.data.id).toBe(first.body.data.id);

    const saleId = first.body.data.id;
    const ret = await request(fx.app)
      .post("/api/v1/returns")
      .set("Cookie", cookie)
      .send({
        saleId,
        reason: "test return",
        lines: [
          {
            saleItemId: first.body.data.items[0].id,
            qty: 1,
            disposition: "restock",
          },
        ],
        refundPayments: [{ method: "cash", amountMinor: fx.variantA.retailPriceMinor }],
      });
    expect([200, 201]).toContain(ret.status);
    expect(ret.body.data.returnNo || ret.body.data.id).toBeTruthy();
  });

  it("keeps register session for checkout", async () => {
    const current = await request(fx.app)
      .get(`/api/v1/register-sessions/current?registerId=${fx.registerA.id}`)
      .set("Cookie", cookie);
    expect(current.status).toBe(200);
    expect(current.body.data.id).toBe(sessionId);
  });
});
