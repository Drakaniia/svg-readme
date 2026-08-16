import { API_BASE } from "./apiConfig";
import { getAuthToken, invalidateAuth } from "./auth";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Matches the Layer model on the backend */
export type ApiLayer = {
  id: string;
  projectId: string;
  name: string;
  type: "text" | "shape" | "image" | "group";
  orderIndex: number;
  locked: boolean;
  visible: boolean;
  active?: boolean;
  parentId?: string | null;
  collapsed?: boolean;
};

/** Matches the Project model on the backend */
export type ApiProject = {
  id: string;
  userId: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  createdAt: string;
  updatedAt: string;
  _count?: { layers: number };
};

/** Matches the Element model on the backend */
export type ApiElement = {
  id: string;
  layerId: string;
  type: string;
  orderIndex: number;
  properties: Record<string, unknown>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
};

/**
 * fetch wrapper that provisions the local user on first use and attaches the
 * JWT (`Authorization: Bearer …`) to every request. If the server rejects the
 * token (401), the cached token is invalidated, a fresh one is obtained via
 * login, and the request is retried exactly once.
 */
async function apiFetch(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init?.headers);
  // Only JSON-string bodies get an explicit Content-Type — FormData/Blob
  // bodies must keep the browser-set boundary header.
  if (typeof init?.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Retry once on 401, but only when a token was actually attached — retrying
  // without one (backend down / auth failed) just doubles the failed request.
  if (res.status === 401 && !retried && token) {
    invalidateAuth();
    return apiFetch(path, init, true);
  }
  return res;
}

// ─── Projects ────────────────────────────────────────────────────────────────

/** GET /api/projects — list all projects */
export const listProjects = async (): Promise<ApiProject[]> => {
  const res = await apiFetch("/projects");
  return handleResponse<ApiProject[]>(res);
};

/** GET /api/projects/:id */
export const getProject = async (id: string): Promise<ApiProject> => {
  const res = await apiFetch(`/projects/${id}`);
  return handleResponse<ApiProject>(res);
};

/** POST /api/projects — create a new project */
export const createProject = async (payload: {
  id?: string;
  name?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}): Promise<ApiProject> => {
  const res = await apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse<ApiProject>(res);
};

/** PUT /api/projects/:id */
export const updateProject = async (
  id: string,
  updates: { name?: string; canvasWidth?: number; canvasHeight?: number },
): Promise<ApiProject> => {
  const res = await apiFetch(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return handleResponse<ApiProject>(res);
};

/** DELETE /api/projects/:id */
export const deleteProject = async (id: string): Promise<void> => {
  const res = await apiFetch(`/projects/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(res);
};

// ─── Layers ──────────────────────────────────────────────────────────────────

/** GET /api/projects/:projectId/layers */
export const getLayers = async (projectId: string): Promise<ApiLayer[]> => {
  const res = await apiFetch(`/projects/${projectId}/layers`);
  return handleResponse<ApiLayer[]>(res);
};

/** POST /api/projects/:projectId/layers */
export const createLayer = async (
  projectId: string,
  payload: {
    id?: string;
    name: string;
    type?: string;
    orderIndex?: number;
    locked?: boolean;
    visible?: boolean;
    parentId?: string | null;
  },
): Promise<ApiLayer> => {
  const res = await apiFetch(`/projects/${projectId}/layers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse<ApiLayer>(res);
};

/** PUT /api/projects/:projectId/layers/:id */
export const updateLayer = async (
  projectId: string,
  id: string,
  updates: Partial<
    Pick<ApiLayer, "name" | "locked" | "visible" | "orderIndex" | "parentId" | "type">
  >,
): Promise<ApiLayer> => {
  const res = await apiFetch(`/projects/${projectId}/layers/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return handleResponse<ApiLayer>(res);
};

/** DELETE /api/projects/:projectId/layers/:id */
export const deleteLayer = async (
  projectId: string,
  id: string,
): Promise<void> => {
  const res = await apiFetch(`/projects/${projectId}/layers/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(res);
};

/** PUT /api/projects/:projectId/layers/reorder */
export const reorderLayers = async (
  projectId: string,
  layers: { id: string; orderIndex: number }[],
): Promise<void> => {
  const res = await apiFetch(`/projects/${projectId}/layers/reorder`, {
    method: "PUT",
    body: JSON.stringify({ layers }),
  });
  return handleResponse<void>(res);
};

// ─── Layers — bulk save (convenience) ────────────────────────────────────────

/** Bulk replace all layers for a project (delete all + batch create) */
export const bulkSaveLayers = async (
  projectId: string,
  layers: {
    id: string;
    name: string;
    type: string;
    orderIndex: number;
    locked: boolean;
    visible: boolean;
    parentId?: string | null;
  }[],
): Promise<void> => {
  // Fetch existing layers, delete them all, then batch create
  const existing = await getLayers(projectId);
  await Promise.all(existing.map((l) => deleteLayer(projectId, l.id)));
  await Promise.all(
    layers.map((l) =>
      createLayer(projectId, {
        id: l.id,
        name: l.name,
        type: l.type,
        orderIndex: l.orderIndex,
        locked: l.locked,
        visible: l.visible,
        parentId: l.parentId,
      }),
    ),
  );
};

// ─── Elements ────────────────────────────────────────────────────────────────

/** GET /api/projects/:projectId/elements */
export const getElements = async (projectId: string): Promise<ApiElement[]> => {
  const res = await apiFetch(`/projects/${projectId}/elements`);
  return handleResponse<ApiElement[]>(res);
};

/** PUT /api/projects/:projectId/elements — bulk upsert */
export const saveElements = async (
  projectId: string,
  elements: {
    id?: string;
    layerId: string;
    type: string;
    orderIndex?: number;
    properties: Record<string, unknown>;
  }[],
): Promise<void> => {
  const res = await apiFetch(`/projects/${projectId}/elements`, {
    method: "PUT",
    body: JSON.stringify({ elements }),
  });
  return handleResponse<void>(res);
};
