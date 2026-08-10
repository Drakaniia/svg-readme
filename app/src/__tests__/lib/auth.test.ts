import { describe, it, expect, vi, beforeEach } from "vitest";

const AUTH_KEY = "svg-readme-auth";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

/** Fresh module instances per test so cached tokens / in-flight promises reset. */
async function freshAuth() {
  vi.resetModules();
  return import("../../lib/auth");
}

async function freshApi() {
  vi.resetModules();
  return import("../../lib/api");
}

// ═════════════════════════════════════════════════════════════════════════════
//  auth.ts — headless local user provisioning
// ═════════════════════════════════════════════════════════════════════════════

describe("auth — headless local user", () => {
  it("registers a local user on first use and persists the token", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/auth/register")) {
        return jsonResponse(201, { token: "jwt-1", user: { id: "u1" } });
      }
      return jsonResponse(500, { error: "unexpected" });
    });

    const auth = await freshAuth();
    expect(await auth.getAuthToken()).toBe("jwt-1");

    // First run → register (no login attempt).
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.endsWith("/api/auth/register"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/api/auth/login"))).toBe(false);

    // Identity + token stored for later visits.
    const stored = JSON.parse(localStorage.getItem(AUTH_KEY)!);
    expect(stored.token).toBe("jwt-1");
    expect(stored.email).toMatch(/^local-.+@svg-readme\.local$/);
    expect(stored.password.length).toBeGreaterThan(8);
  });

  it("logs in with stored credentials when no token is persisted", async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ email: "local-abc@svg-readme.local", password: "sr-secret-1" }),
    );
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/auth/login")) {
        return jsonResponse(200, { token: "jwt-2", user: { id: "u2" } });
      }
      return jsonResponse(500, { error: "unexpected" });
    });

    const auth = await freshAuth();
    expect(await auth.getAuthToken()).toBe("jwt-2");

    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.endsWith("/api/auth/login"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/api/auth/register"))).toBe(false);
  });

  it("uses a persisted token without any network call (reload case)", async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        email: "local-abc@svg-readme.local",
        password: "sr-secret-1",
        token: "jwt-old",
      }),
    );

    const auth = await freshAuth();
    expect(await auth.getAuthToken()).toBe("jwt-old");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("memoizes the in-memory token without duplicate auth requests", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { token: "jwt-3", user: {} }));

    const auth = await freshAuth();
    await auth.getAuthToken();
    await auth.getAuthToken();

    const authCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).includes("/api/auth/"),
    );
    expect(authCalls.length).toBe(1);
  });

  it("regenerates the identity and retries registration on a 409 collision", async () => {
    const usedEmails: string[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (!url.endsWith("/api/auth/register")) return jsonResponse(500, {});
      const body = JSON.parse(String(init?.body)) as { email: string };
      usedEmails.push(body.email);
      if (usedEmails.length === 1) {
        return jsonResponse(409, { error: "Email already registered" });
      }
      return jsonResponse(201, { token: "jwt-4", user: {} });
    });

    const auth = await freshAuth();
    expect(await auth.getAuthToken()).toBe("jwt-4");
    expect(usedEmails.length).toBe(2);
    expect(usedEmails[0]).not.toBe(usedEmails[1]);
  });

  it("returns null when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(
      new TypeError("NetworkError when attempting to fetch resource."),
    );

    const auth = await freshAuth();
    expect(await auth.getAuthToken()).toBeNull();
  });

  it("invalidateAuth drops a stale persisted token so login refreshes it", async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        email: "local-abc@svg-readme.local",
        password: "sr-secret-1",
        token: "stale-token",
      }),
    );
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/auth/login")) {
        return jsonResponse(200, { token: "fresh-token", user: {} });
      }
      return jsonResponse(500, {});
    });

    const auth = await freshAuth();
    auth.invalidateAuth();
    expect(await auth.getAuthToken()).toBe("fresh-token");
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).endsWith("/api/auth/login")),
    ).toBe(true);
  });

  it("signOutAuth removes the token and identity", async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ email: "a@b.c", password: "secret", token: "jwt" }),
    );

    const auth = await freshAuth();
    expect(await auth.getAuthToken()).toBe("jwt");
    auth.signOutAuth();
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  api.ts — Authorization header + 401 retry
// ═════════════════════════════════════════════════════════════════════════════

describe("api — Authorization header + 401 retry", () => {
  it("attaches the Bearer token to authed requests", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/auth/register")) {
        return jsonResponse(201, { token: "jwt-api", user: {} });
      }
      if (url.endsWith("/api/projects")) return jsonResponse(200, []);
      return jsonResponse(500, {});
    });

    const { listProjects } = await freshApi();
    await listProjects();

    const projectsCall = fetchMock.mock.calls.find(([u]) =>
      String(u).endsWith("/api/projects"),
    )!;
    const headers = new Headers(projectsCall[1]?.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer jwt-api");
  });

  it("does not attach a header when auth could not be provisioned", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));

    const { listProjects } = await freshApi();
    await expect(listProjects()).rejects.toThrow();

    const projectsCall = fetchMock.mock.calls.find(([u]) =>
      String(u).endsWith("/api/projects"),
    )!;
    const headers = new Headers(projectsCall[1]?.headers as HeadersInit);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("re-authenticates and retries once when the token is rejected (401)", async () => {
    let sawStale = false;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/register")) {
        return jsonResponse(201, { token: "jwt-1", user: {} });
      }
      if (url.endsWith("/api/auth/login")) {
        return jsonResponse(200, { token: "jwt-2", user: {} });
      }
      if (url.endsWith("/api/projects")) {
        const headers = new Headers(init?.headers as HeadersInit);
        if (headers.get("Authorization") === "Bearer jwt-1" && !sawStale) {
          sawStale = true;
          return jsonResponse(401, { error: "Not authorized, invalid token" });
        }
        return jsonResponse(200, []);
      }
      return jsonResponse(500, {});
    });

    const { listProjects } = await freshApi();
    const result = await listProjects();

    expect(result).toEqual([]);
    expect(sawStale).toBe(true);
    // Re-auth went through login with stored credentials.
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).endsWith("/api/auth/login")),
    ).toBe(true);
  });

  it("fails through to the caller when the retry is also rejected", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/auth/register")) {
        return jsonResponse(201, { token: "jwt-1", user: {} });
      }
      if (url.endsWith("/api/projects")) {
        return jsonResponse(401, { error: "Not authorized, invalid token" });
      }
      return jsonResponse(500, {});
    });

    const { listProjects } = await freshApi();
    await expect(listProjects()).rejects.toThrow(
      "Not authorized, invalid token",
    );
  });
});
