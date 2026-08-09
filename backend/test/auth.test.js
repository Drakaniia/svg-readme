const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const prisma = require("../src/config/db");
const app = require("../src/app");
const { signToken } = require("../src/lib/jwt");

// ─── Prisma stubbing helpers ──────────────────────────────────────────────────

const saved = new Map();

function stubMethod(model, method, impl) {
  if (!saved.has(model)) saved.set(model, new Map());
  const methods = saved.get(model);
  if (!methods.has(method)) methods.set(method, prisma[model][method]);
  prisma[model][method] = impl;
}

beforeEach(() => {
  // Default: no user exists, no user is created
  stubMethod("user", "findUnique", async () => null);
  stubMethod("user", "create", async (args) => ({
    id: "user-1",
    email: args.data.email,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  }));
});

afterEach(() => {
  for (const [model, methods] of saved) {
    for (const [method, original] of methods) {
      prisma[model][method] = original;
    }
  }
  saved.clear();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validUser = { id: "user-1", email: "jane@example.com" };
const validPassword = "secret123";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  it("registers a new user and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "Jane@Example.com", password: validPassword });

    assert.equal(res.status, 201);
    assert.ok(res.body.token, "token should be returned");
    assert.equal(res.body.user.email, "jane@example.com"); // normalized
    assert.equal(res.body.user.id, "user-1");
  });

  it("stores a bcrypt-hashed password (never plaintext)", async () => {
    let captured;
    stubMethod("user", "create", async (args) => {
      captured = args.data;
      return { id: "user-1", email: args.data.email };
    });

    await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: validPassword });

    assert.ok(captured.passwordHash, "passwordHash must be set");
    assert.notEqual(captured.passwordHash, validPassword);
    assert.equal(
      await bcrypt.compare(validPassword, captured.passwordHash),
      true,
    );
  });

  it("rejects a duplicate email with 409", async () => {
    stubMethod("user", "findUnique", async () => ({ id: "existing" }));
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "taken@example.com", password: validPassword });
    assert.equal(res.status, 409);
  });

  it("rejects missing fields with 400", async () => {
    const noEmail = await request(app)
      .post("/api/auth/register")
      .send({ password: validPassword });
    assert.equal(noEmail.status, 400);

    const noPassword = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.com" });
    assert.equal(noPassword.status, 400);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: validPassword });
    assert.equal(res.status, 400);
  });

  it("rejects a short password with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "123" });
    assert.equal(res.status, 400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials and returns a token", async () => {
    const hash = bcrypt.hashSync(validPassword, 4);
    stubMethod("user", "findUnique", async () => ({ ...validUser, passwordHash: hash }));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: validPassword });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, "jane@example.com");
  });

  it("rejects a wrong password with 401", async () => {
    const hash = bcrypt.hashSync(validPassword, 4);
    stubMethod("user", "findUnique", async () => ({ ...validUser, passwordHash: hash }));

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "wrong-password" });
    assert.equal(res.status, 401);
  });

  it("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: validPassword });
    assert.equal(res.status, 401);
  });

  it("rejects missing credentials with 400", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    assert.equal(res.status, 400);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid token", async () => {
    stubMethod("user", "findUnique", async () => ({
      id: validUser.id,
      email: validUser.email,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    }));

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signToken(validUser.id)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, validUser.id);
  });

  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    assert.equal(res.status, 401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");
    assert.equal(res.status, 401);
  });

  it("rejects a token for a deleted user", async () => {
    // findUnique still returns null (user deleted)
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signToken("gone")}`);
    assert.equal(res.status, 401);
  });
});
