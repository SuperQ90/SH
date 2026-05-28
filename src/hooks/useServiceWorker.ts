import { useEffect } from 'react';
import { useToast } from './use-toast';

export const useServiceWorker = () => {
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Clear all caches on app load
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName);
        });
      });

      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
            
            // Force update check
            registration.update();
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      // New update available - auto update
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    }
                  }
                });
              }
            });
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });

      // Listen for controlling service worker changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, [toast]);

  const clearCacheAndReload = () => {
    if ('serviceWorker' in navigator) {
      // Clear all caches
      caches.keys().then((cacheNames) => {
        Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        ).then(() => {
          // Unregister service worker
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => {
              registration.unregister();
            });
          }).then(() => {
            // Force reload
            window.location.reload();
          });
        });
      });
    } else {
      window.location.reload();
    }
  };

  const updateApp = () => {
    clearCacheAndReload();
  };

  return { updateApp, clearCacheAndReload };
};