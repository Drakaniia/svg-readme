// ─── Headless local-user auth ────────────────────────────────────────────────
// The backend requires a Bearer JWT on /api/projects*. To keep the editor
// usable without a login screen, we silently provision a local user:
//   1. generate a random email/password identity and persist it in localStorage
//   2. login first (existing identity), fall back to register (first run)
//   3. store the returned JWT so later visits skip the network entirely
// A future real login UI can replace this module with a user-facing flow.

import { API_BASE } from "./apiConfig";

// ─── Types & storage ─────────────────────────────────────────────────────────

interface LocalIdentity {
  email: string;
  password: string;
  /** Last known JWT. Persisted so page reloads skip the login roundtrip. */
  token?: string;
}

const AUTH_STORAGE_KEY = "svg-readme-auth";

function readIdentity(): LocalIdentity | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalIdentity;
    if (typeof parsed.email !== "string" || typeof parsed.password !== "string") {
      return null;
    }
    if (parsed.token !== undefined && typeof parsed.token !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeIdentity(identity: LocalIdentity): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    /* quota exceeded – silently ignore */
  }
}

// ─── Identity generation ─────────────────────────────────────────────────────

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

function generateEmail(): string {
  return `local-${randomId()}@svg-readme.local`;
}

function generatePassword(): string {
  return `sr-${randomId()}-${randomId()}`;
}

// ─── Token state ─────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let authPromise: Promise<string | null> | null = null;

/**
 * Resolve a valid JWT for the local user, provisioning the account on first
 * use. Memoized: concurrent callers share one auth attempt, and after success
 * the token is returned from memory without touching the network.
 */
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (authPromise) return authPromise;
  authPromise = obtainToken().finally(() => {
    authPromise = null;
  });
  return authPromise;
}

/**
 * Drop the current token so the next getAuthToken() re-authenticates.
 * Also clears a stale persisted token so re-auth goes through login with the
 * stored credentials (which are still valid) instead of looping on a dead JWT.
 */
export function invalidateAuth(): void {
  cachedToken = null;
  const identity = readIdentity();
  if (identity) {
    writeIdentity({ email: identity.email, password: identity.password });
  }
}

/** Clear the token AND the local identity (full sign-out). */
export function signOutAuth(): void {
  cachedToken = null;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function obtainToken(): Promise<string | null> {
  try {
    // Reuse a previously persisted token – no network on reload.
    const stored = readIdentity();
    if (stored?.token) {
      cachedToken = stored.token;
      return stored.token;
    }

    // Ensure a local identity exists.
    let identity = stored;
    let freshIdentity = false;
    if (!identity) {
      identity = { email: generateEmail(), password: generatePassword() };
      writeIdentity(identity);
      freshIdentity = true;
    }

    // Existing identity → login first (fresh identities skip straight to
    // register — the account can't exist yet).
    if (!freshIdentity) {
      const loginRes = await postJson(`${API_BASE}/auth/login`, {
        email: identity.email,
        password: identity.password,
      });
      if (loginRes.ok) return commitToken(identity, await loginRes.json());
    }

    // First run (or backend DB was reset) → register.
    const regRes = await postJson(`${API_BASE}/auth/register`, {
      email: identity.email,
      password: identity.password,
    });
    if (regRes.ok) return commitToken(identity, await regRes.json());

    // 409 = email exists with a different password (astronomically unlikely
    // for a random identity, but the backend may have been seeded). Regenerate
    // a fresh identity and try once more.
    if (regRes.status === 409) {
      identity = { email: generateEmail(), password: generatePassword() };
      writeIdentity(identity);
      const retry = await postJson(`${API_BASE}/auth/register`, {
        email: identity.email,
        password: identity.password,
      });
      if (retry.ok) return commitToken(identity, await retry.json());
    }

    return null;
  } catch {
    // Backend unreachable / network error – the caller's request will surface
    // its own error; auth simply has no token to attach.
    return null;
  }
}

function commitToken(
  identity: LocalIdentity,
  data: { token?: string },
): string | null {
  if (typeof data.token !== "string" || data.token === "") return null;
  cachedToken = data.token;
  writeIdentity({ ...identity, token: data.token });
  return data.token;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
