const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const prisma = require("../src/config/db");
const app = require("../src/app");
const { signToken } = require("../src/lib/jwt");

// ─── Prisma stubbing helpers ──────────────────────────────────────────────────

const saved = new Map();

function stubMethod(model, method, impl) {
  const target = model === "$" ? prisma : prisma[model];
  if (!saved.has(model)) saved.set(model, new Map());
  const methods = saved.get(model);
  if (!methods.has(method)) methods.set(method, target[method]);
  target[method] = impl;
}

const alice = { id: "alice", email: "alice@example.com" };
const bob = { id: "bob", email: "bob@example.com" };
const aliceToken = signToken(alice.id);
const bobToken = signToken(bob.id);

const aliceProject = {
  id: "proj-a",
  userId: alice.id,
  name: "Alice Banner",
  canvasWidth: 800,
  canvasHeight: 200,
};

beforeEach(() => {
  stubMethod("user", "findUnique", async ({ where }) =>
    where.id === alice.id || where.id === bob.id
      ? { id: where.id, email: `${where.id}@example.com` }
      : null,
  );
});

afterEach(() => {
  for (const [model, methods] of saved) {
    const target = model === "$" ? prisma : prisma[model];
    for (const [method, original] of methods) {
      target[method] = original;
    }
  }
  saved.clear();
});

// ─── Projects ─────────────────────────────────────────────────────────────────

describe("Project routes require auth", () => {
  it("GET /api/projects without a token → 401", async () => {
    const res = await request(app).get("/api/projects");
    assert.equal(res.status, 401);
  });

  it("POST /api/projects without a token → 401", async () => {
    const res = await request(app).post("/api/projects").send({ name: "X" });
    assert.equal(res.status, 401);
  });
});

describe("GET /api/projects", () => {
  it("lists only the authenticated user's projects", async () => {
    let capturedWhere;
    stubMethod("project", "findMany", async ({ where }) => {
      capturedWhere = where;
      return [{ ...aliceProject, _count: { layers: 0 } }];
    });

    const res = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${aliceToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.deepEqual(capturedWhere, { userId: alice.id });
  });
});

describe("POST /api/projects", () => {
  it("creates the project under the authenticated user", async () => {
    let capturedData;
    stubMethod("project", "create", async ({ data }) => {
      capturedData = data;
      return { ...aliceProject, ...data };
    });

    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ name: "New Banner" });

    assert.equal(res.status, 201);
    assert.equal(capturedData.userId, alice.id);
    assert.equal(capturedData.name, "New Banner");
  });
});

describe("GET /api/projects/:id", () => {
  it("returns a project owned by the user", async () => {
    stubMethod("project", "findFirst", async () => ({
      ...aliceProject,
      _count: { layers: 0 },
    }));
    const res = await request(app)
      .get("/api/projects/proj-a")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, "proj-a");
  });

  it("hides projects owned by another user (404)", async () => {
    stubMethod("project", "findFirst", async () => null);
    const res = await request(app)
      .get("/api/projects/proj-b")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 404);
  });
});

describe("PUT /api/projects/:id", () => {
  it("updates an owned project", async () => {
    stubMethod("project", "findFirst", async () => ({ id: "proj-a" }));
    stubMethod("project", "update", async ({ data }) => ({
      ...aliceProject,
      ...data,
    }));

    const res = await request(app)
      .put("/api/projects/proj-a")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ name: "Renamed" });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Renamed");
  });

  it("refuses to update another user's project (404)", async () => {
    stubMethod("project", "findFirst", async () => null);
    const res = await request(app)
      .put("/api/projects/proj-b")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ name: "Hijack" });
    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes an owned project", async () => {
    stubMethod("project", "findFirst", async () => ({ id: "proj-a" }));
    stubMethod("project", "delete", async () => ({}));

    const res = await request(app)
      .delete("/api/projects/proj-a")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
  });

  it("refuses to delete another user's project (404)", async () => {
    stubMethod("project", "findFirst", async () => null);
    const res = await request(app)
      .delete("/api/projects/proj-b")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 404);
  });
});

// ─── Nested layer/element routes ─────────────────────────────────────────────

describe("Layer routes are project-scoped", () => {
  it("GET layers for a project owned by the user → 200", async () => {
    stubMethod("project", "findUnique", async () => ({ id: "proj-a", userId: alice.id }));
    stubMethod("layer", "findMany", async () => []);
    const res = await request(app)
      .get("/api/projects/proj-a/layers")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 200);
  });

  it("GET layers for another user's project → 403", async () => {
    stubMethod("project", "findUnique", async () => ({ id: "proj-b", userId: bob.id }));
    const res = await request(app)
      .get("/api/projects/proj-b/layers")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 403);
  });

  it("GET layers for a missing project → 404", async () => {
    stubMethod("project", "findUnique", async () => null);
    const res = await request(app)
      .get("/api/projects/missing/layers")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 404);
  });

  it("refuses to update a layer that belongs to another project (404)", async () => {
    // Alice owns proj-a but the layer id lives in someone else's project:
    // the project-scoped lookup must not find it.
    stubMethod("project", "findUnique", async () => ({ id: "proj-a", userId: alice.id }));
    stubMethod("layer", "findFirst", async () => null);

    const res = await request(app)
      .put("/api/projects/proj-a/layers/foreign-layer")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ name: "Hijack" });
    assert.equal(res.status, 404);
  });

  it("refuses to delete a layer that belongs to another project (404)", async () => {
    stubMethod("project", "findUnique", async () => ({ id: "proj-a", userId: alice.id }));
    stubMethod("layer", "findFirst", async () => null);

    const res = await request(app)
      .delete("/api/projects/proj-a/layers/foreign-layer")
      .set("Authorization", `Bearer ${aliceToken}`);
    assert.equal(res.status, 404);
  });

  it("reorder only touches layers scoped to the request project", async () => {
    stubMethod("project", "findUnique", async () => ({ id: "proj-a", userId: alice.id }));
    const scopes = [];
    stubMethod("layer", "updateMany", async ({ where }) => {
      scopes.push(where);
      return { count: 1 };
    });
    stubMethod("$", "$transaction", async (ops) => Promise.all(ops));

    const res = await request(app)
      .put("/api/projects/proj-a/layers/reorder")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ layers: [{ id: "l1", orderIndex: 0 }, { id: "l2", orderIndex: 1 }] });

    assert.equal(res.status, 200);
    assert.deepEqual(scopes, [
      { id: "l1", projectId: "proj-a" },
      { id: "l2", projectId: "proj-a" },
    ]);
  });
});

describe("Element routes are project-scoped", () => {
  it("PUT elements for a foreign project → 403", async () => {
    stubMethod("project", "findUnique", async () => ({ id: "proj-b", userId: bob.id }));
    const res = await request(app)
      .put("/api/projects/proj-b/elements")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ elements: [] });
    assert.equal(res.status, 403);
  });

  it("PUT elements for an owned project passes ownership", async () => {
    stubMethod("project", "findUnique", async () => ({ id: "proj-a", userId: alice.id }));
    stubMethod("layer", "findMany", async () => [{ id: "layer-1" }]);
    stubMethod("$", "$transaction", async () => []);

    const res = await request(app)
      .put("/api/projects/proj-a/elements")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ elements: [{ layerId: "layer-1", type: "shape", properties: {} }] });
    assert.equal(res.status, 200);
  });
});
