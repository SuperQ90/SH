// src/lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase bootstrap
 * - Exposes:
 *    - supabase            → normal app client (persists session)
 *    - getAuthedClient()   → ephemeral client that ALWAYS sends Authorization
 *    - edgeFetch()         → raw fetch to Edge Functions (no forced headers)
 *    - invokeEdge()        → JSON or FormData aware Edge caller
 *    - invokeEdgeForm()    → convenience for FormData uploads
 */

// Fallbacks (public anon key is fine on the client)
const FALLBACK_URL = "https://mpjdjmatvuahnpflzeni.supabase.co";
const FALLBACK_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wamRqbWF0dnVhaG5wZmx6ZW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NzY5MDMsImV4cCI6MjA3NTU1MjkwM30.8s3pHsLEVVG0qposHT5hI7hJEWIQ9LQGwXX4wJuZxOI";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase URL or anon key.");
}

// Persistent app client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "airadio",
  },
});

// Short-lived client that ALWAYS sends the user's JWT in Authorization
export function getAuthedClient(accessToken: string): SupabaseClient {
  if (!accessToken) throw new Error("getAuthedClient: accessToken is missing.");

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "airadio-upload",
    },
  });
}

// ---------- Edge helpers ----------
const edgeUrl = (fn: string) => `${SUPABASE_URL}/functions/v1/${fn}`;

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Raw fetch to Edge with apikey + user Authorization (if present).
 * Does NOT force Content-Type. Use when you need full control (e.g., FormData).
 */
export async function edgeFetch(functionName: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  return fetch(edgeUrl(functionName), { ...init, headers });
}

async function parseJSONSafe<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const msg = text && !text.startsWith("{") ? text.slice(0, 300) : "";
    throw new Error(msg || `Edge function failed (${res.status})`);
  }
}

/**
 * Smart Edge invoker:
 * - If you pass FormData (or init.body), we DO NOT set Content-Type.
 * - If you pass a plain JS payload, we JSON.stringify and set Content-Type: application/json.
 */
export async function invokeEdge<T = unknown>(
  functionName: string,
  payload?: unknown,
  init: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  let body: BodyInit | undefined = init.body as BodyInit | undefined;

  if (payload !== undefined && init.body === undefined) {
    if (payload instanceof FormData) {
      body = payload;
    } else {
      body = JSON.stringify(payload);
      if (!("Content-Type" in headers)) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const res = await edgeFetch(functionName, {
    ...init,
    method: init.method || "POST",
    headers,
    body,
  });

  return parseJSONSafe<T>(res);
}

/**
 * Convenience for FormData uploads (no Content-Type header).
 */
export async function invokeEdgeForm<T = any>(
  functionName: string,
  form: FormData,
  init: RequestInit = {}
): Promise<T> {
  const res = await edgeFetch(functionName, {
    ...init,
    method: init.method || "POST",
    body: form,
  });
  return parseJSONSafe<T>(res);
}

// ---------- Keep-alive on mobile resume ----------
// This prevents “come back to app → token stale → UI thinks logged out”.
declare global {
  interface Window {
    __airadioSupabaseKeepAlive?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__airadioSupabaseKeepAlive) {
  window.__airadioSupabaseKeepAlive = true;

  let lastRun = 0;
  const THROTTLE_MS = 15_000;

  const refresh = async () => {
    const now = Date.now();
    if (now - lastRun < THROTTLE_MS) return;
    lastRun = now;

    try {
      await supabase.auth.refreshSession();
    } catch {
      // If there is no session/refresh token, this can fail — that’s fine.
    }
  };

  const onVis = () => {
    if (!document.hidden) refresh();
  };

  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", onVis);
}
