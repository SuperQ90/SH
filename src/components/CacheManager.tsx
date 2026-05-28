import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, RefreshCw, Smartphone, AlertCircle, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface CacheInfo {
  name: string;
  size: string;
  lastModified: string;
}

const SUPABASE_STORAGE_KEY = "airadio";
const DEVICE_ID_KEY = "airadio_device_id";
const LAST_DEVICE_ID_KEY = "airadio_last_device_id";

// Keep Supabase auth + a couple of app keys even when clearing everything else
function shouldPreserveLocalStorageKey(key: string) {
  if (key === SUPABASE_STORAGE_KEY) return true;
  if (key.startsWith(`${SUPABASE_STORAGE_KEY}-`)) return true; // pkce verifier, etc.
  if (key === DEVICE_ID_KEY) return true;
  if (key === LAST_DEVICE_ID_KEY) return true;
  return false;
}

function getStableDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const id =
      (crypto as any)?.randomUUID?.() ??
      `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // If storage is blocked, just return a best-effort value
    return `dev_${Date.now()}`;
  }
}

const CacheManager: React.FC = () => {
  const [cacheList, setCacheList] = useState<CacheInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<string>("");
  const [autoClearing, setAutoClearing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const cacheStorage = useMemo(() => {
    // window.caches is the CacheStorage API
    return typeof window !== "undefined" ? window.caches : undefined;
  }, []);

  const loadCacheInfo = useCallback(async () => {
    setLoading(true);
    try {
      if (!cacheStorage) {
        setCacheList([]);
        setStorageInfo("");
        return;
      }

      const cacheNames = await cacheStorage.keys();
      const infos: CacheInfo[] = [];

      for (const cacheName of cacheNames) {
        const cache = await cacheStorage.open(cacheName);
        const keys = await cache.keys();
        infos.push({
          name: cacheName,
          size: `${keys.length} items`,
          lastModified: new Date().toLocaleDateString(),
        });
      }

      setCacheList(infos);

      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        setStorageInfo(
          `${(used / 1024 / 1024).toFixed(1)}MB / ${(quota / 1024 / 1024 / 1024).toFixed(1)}GB`
        );
      }
    } catch (err) {
      console.error("Error loading cache info:", err);
      toast({
        title: "Cache Error",
        description: "Unable to load cache information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [cacheStorage, toast]);

  const clearAllCaches = useCallback(async () => {
    setLoading(true);
    try {
      // Clear the CacheStorage caches
      if (cacheStorage) {
        const cacheNames = await cacheStorage.keys();
        await Promise.all(cacheNames.map((name) => cacheStorage.delete(name)));
      }

      // Remove everything from localStorage EXCEPT auth/session keys
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (!shouldPreserveLocalStorageKey(k)) {
            localStorage.removeItem(k);
          }
        }
      } catch (e) {
        console.warn("localStorage cleanup failed:", e);
      }

      // Clear sessionStorage (safe; Supabase isn’t using it here)
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn("sessionStorage clear failed:", e);
      }

      // Clear IndexedDB if available (best-effort)
      if ("indexedDB" in window) {
        try {
          const anyIDB: any = indexedDB as any;
          if (typeof anyIDB.databases === "function") {
            const databases = await anyIDB.databases();
            await Promise.all(
              (databases || []).map((db: any) => {
                if (!db?.name) return Promise.resolve(true);
                const deleteReq = indexedDB.deleteDatabase(db.name);
                return new Promise((resolve, reject) => {
                  deleteReq.onsuccess = () => resolve(true);
                  deleteReq.onerror = () => reject(deleteReq.error);
                  deleteReq.onblocked = () => resolve(true);
                });
              })
            );
          }
        } catch (error) {
          console.log("IndexedDB clear failed:", error);
        }
      }

      setCacheList([]);

      toast({
        title: "Cache Cleared",
        description: "All caches cleared while preserving your login session.",
        duration: 3000,
      });

      // Force reload after clearing cache
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error("Error clearing caches:", err);
      toast({
        title: "Clear Failed",
        description: "Unable to clear all caches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [cacheStorage, toast]);

  const clearSpecificCache = useCallback(
    async (cacheName: string) => {
      try {
        if (cacheStorage) {
          await cacheStorage.delete(cacheName);
        }
        await loadCacheInfo();
        toast({
          title: "Cache Cleared",
          description: `${cacheName} cache has been cleared`,
        });
      } catch (err) {
        console.error("Error clearing cache:", err);
        toast({
          title: "Clear Failed",
          description: `Unable to clear ${cacheName} cache`,
          variant: "destructive",
        });
      }
    },
    [cacheStorage, loadCacheInfo, toast]
  );

  const forceRefresh = useCallback(() => {
    // Unregister SW then hard reload
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }
    window.location.href = window.location.pathname + "?t=" + Date.now();
  }, []);

  // Auto-clear cache (kept, but made stable so it won’t randomly fire)
  useEffect(() => {
    const run = async () => {
      if (!user || autoClearing) return;

      const currentDeviceId = getStableDeviceId();
      const lastDeviceId = localStorage.getItem(LAST_DEVICE_ID_KEY);

      // If the stored last device id differs, clear caches
      if (lastDeviceId && lastDeviceId !== currentDeviceId) {
        setAutoClearing(true);
        toast({
          title: "Device Change Detected",
          description: "Clearing cache for fresh data...",
          duration: 2500,
        });
        await clearAllCaches();
      }

      localStorage.setItem(LAST_DEVICE_ID_KEY, currentDeviceId);
    };

    run();
  }, [user, autoClearing, toast, clearAllCaches]);

  useEffect(() => {
    loadCacheInfo();
  }, [loadCacheInfo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center">
          <Smartphone className="w-5 h-5 mr-2" />
          Mobile Cache Management
        </h3>
        <Button onClick={loadCacheInfo} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {user && (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-start">
            <LogIn className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Cache tools won’t log you out
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Clearing cache preserves your Supabase session.
              </p>
            </div>
          </div>
        </div>
      )}

      {storageInfo && (
        <div className="bg-muted p-3 rounded-lg">
          <p className="text-sm">
            <strong>Storage Used:</strong> {storageInfo}
          </p>
        </div>
      )}

      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Mobile App Issues?
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              If songs aren’t loading on your mobile device, try clearing the cache and forcing a refresh.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {cacheList.length === 0 ? (
          <p className="text-muted-foreground text-sm">No caches found</p>
        ) : (
          cacheList.map((cache) => (
            <Card key={cache.name} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{cache.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {cache.size} • Modified: {cache.lastModified}
                  </p>
                </div>
                <Button onClick={() => clearSpecificCache(cache.name)} variant="outline" size="sm">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          onClick={clearAllCaches}
          disabled={loading || autoClearing}
          variant="destructive"
          className="flex-1"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {autoClearing ? "Auto Clearing..." : "Clear All Cache"}
        </Button>
        <Button onClick={forceRefresh} variant="outline" className="flex-1">
          <RefreshCw className="w-4 h-4 mr-2" />
          Force Refresh
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>• Clear All Cache: Removes cached data but preserves login</p>
        <p>• Force Refresh: Reloads the app with a fresh network request</p>
      </div>
    </div>
  );
};

export default CacheManager;
