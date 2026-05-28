// Ensures ANY bare fetch to Supabase REST includes the required headers.
// Only touches /rest/v1/ on YOUR Supabase URL.

const baseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/+$/, "") ||
  "https://mpjdjmatvuahnpflzeni.supabase.co";

const anonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wamRqbWF0dnVhaG5wZmx6ZW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NzY5MDMsImV4cCI6MjA3NTU1MjkwM30.8s3pHsLEVVG0qposHT5hI7hJEWIQ9LQGwXX4wJuZxOI";

const AUTH_STORAGE_KEY = "airadio";

declare global {
  interface Window {
    __supabaseRestGuard?: boolean;
  }
}

function getStoredAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Most common shape in supabase-js v2:
    if (typeof parsed?.access_token === "string") return parsed.access_token;

    // Sometimes wrappers exist (being defensive costs nothing):
    if (typeof parsed?.currentSession?.access_token === "string") return parsed.currentSession.access_token;
    if (typeof parsed?.session?.access_token === "string") return parsed.session.access_token;

    return null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined" && !window.__supabaseRestGuard) {
  const REST_PREFIX = `${baseUrl}/rest/v1/`;
  const origFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    let nextInit: RequestInit = init ? { ...init } : {};

    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;

      // Merge Request headers with init.headers
      const reqHeaders = new Headers(input.headers);
      const initHeaders = new Headers(init?.headers || {});
      initHeaders.forEach((v, k) => reqHeaders.set(k, v));
      nextInit.headers = reqHeaders;

      if (!nextInit.method) nextInit.method = input.method;
      if (!nextInit.body) nextInit.body = input.body as any;
      if (!nextInit.mode) nextInit.mode = input.mode;
      if (!nextInit.credentials) nextInit.credentials = input.credentials;
      if (!nextInit.cache) nextInit.cache = input.cache;
      if (!nextInit.redirect) nextInit.redirect = input.redirect;
      if (!nextInit.referrer) nextInit.referrer = input.referrer;
      if (!nextInit.referrerPolicy) nextInit.referrerPolicy = input.referrerPolicy;
      if (!nextInit.integrity) nextInit.integrity = input.integrity;
    }

    // Only patch Supabase REST calls
    if (url.startsWith(REST_PREFIX)) {
      const headers = new Headers(nextInit.headers || {});

      // Always required by Supabase REST
      if (!headers.has("apikey")) headers.set("apikey", anonKey);

      // If caller didn’t specify Authorization, use stored user token if present; else anon.
      if (!headers.has("Authorization")) {
        const token = getStoredAccessToken();
        headers.set("Authorization", `Bearer ${token ?? anonKey}`);
      }

      // Only set Content-Type when there is a body we are actually sending
      const method = (nextInit.method || "GET").toUpperCase();
      const hasBody = nextInit.body != null && method !== "GET" && method !== "HEAD";
      const bodyIsText =
        typeof nextInit.body === "string" || nextInit.body instanceof URLSearchParams;

      if (hasBody && bodyIsText && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      nextInit.headers = headers;
      return origFetch(url, nextInit);
    }

    return origFetch(input as any, init);
  };

  window.__supabaseRestGuard = true;
}
