import { useCallback, useEffect, useRef, useState } from "react";

type Envelope<T> = { v: 1; updatedAt: number; data: T };

function safeRead<T>(storage: Storage, key: string, ttlMs: number): Envelope<T> | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || env.v !== 1 || typeof env.updatedAt !== "number" || !("data" in env)) return null;

    if (Date.now() - env.updatedAt > ttlMs) {
      storage.removeItem(key);
      return null;
    }
    return env;
  } catch {
    return null;
  }
}

export function useDraftState<T>(opts: {
  key: string | null;     // pass null to disable
  base: T;                // saved profile mapped to form shape
  debounceMs?: number;    // default 250
  ttlMs?: number;         // default 7 days
  storage?: Storage;      // default localStorage
}) {
  const {
    key,
    base,
    debounceMs = 250,
    ttlMs = 1000 * 60 * 60 * 24 * 7,
    storage = typeof window !== "undefined" ? window.localStorage : (undefined as any),
  } = opts;

  const [value, _setValue] = useState<T>(base);
  const [hasDraft, setHasDraft] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Load draft on key change
  useEffect(() => {
    if (!key || !storage) {
      dirtyRef.current = false;
      setHasDraft(false);
      setRestoredAt(null);
      _setValue(base);
      return;
    }

    const env = safeRead<T>(storage, key, ttlMs);
    if (env) {
      dirtyRef.current = true; // draft originated from user edits
      setHasDraft(true);
      setRestoredAt(env.updatedAt);
      _setValue(env.data);
    } else {
      dirtyRef.current = false;
      setHasDraft(false);
      setRestoredAt(null);
      _setValue(base);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // If base changes (fresh DB fetch) and there is no draft, keep form in sync with base
  useEffect(() => {
    if (!hasDraft) _setValue(base);
  }, [base, hasDraft]);

  // Persist only after user edits (dirty)
  useEffect(() => {
    if (!key || !storage) return;
    if (!dirtyRef.current) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        const env: Envelope<T> = { v: 1, updatedAt: Date.now(), data: value };
        storage.setItem(key, JSON.stringify(env));
        setHasDraft(true);
      } catch {
        // ignore (quota / private mode)
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [key, value, debounceMs, storage]);

  // Use this in onChange handlers (marks dirty)
  const setDraft = useCallback((next: T | ((prev: T) => T)) => {
    dirtyRef.current = true;
    _setValue((prev) => (typeof next === "function" ? (next as any)(prev) : next));
  }, []);

  const clearDraft = useCallback(() => {
    if (key && storage) {
      try {
        storage.removeItem(key);
      } catch {}
    }
    dirtyRef.current = false;
    setHasDraft(false);
    setRestoredAt(null);
  }, [key, storage]);

  const resetToBase = useCallback(() => {
    clearDraft();
    _setValue(base);
  }, [base, clearDraft]);

  return { value, setDraft, clearDraft, resetToBase, hasDraft, restoredAt };
}
