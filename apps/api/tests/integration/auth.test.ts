import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { bootTestApp, login, shutdownTestApp, type TestFixture } from "../helpers.js";

describe("auth", () => {
  let fx: TestFixture;

  beforeAll(async () => {
    fx = await bootTestApp();
  });

  afterAll(async () => {
    await shutdownTestApp();
  });

  it("logs in with email/password and returns me", async () => {
    const { res, cookie } = await login(fx.app, fx.ownerA.email, fx.ownerA.password);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(fx.ownerA.email);
    expect(cookie).toContain("access_token=");

    const me = await request(fx.app).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(fx.ownerA.email);
  });

  it("rejects bad password", async () => {
    const res = await request(fx.app)
      .post("/api/v1/auth/login")
      .send({ email: fx.ownerA.email, password: "wrong-password" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("requires auth for context", async () => {
    const res = await request(fx.app).get("/api/v1/context");
    expect(res.status).toBe(401);
  });
});
