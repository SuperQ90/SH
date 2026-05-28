import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Database, Smartphone, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import CacheManager from './CacheManager';

interface DiagnosticInfo {
  totalSongs: number;
  userSongs: number;
  cacheStatus: string;
  networkStatus: string;
  lastSync: string;
  storageUsed: string;
  connectionHealth: 'good' | 'warning' | 'error';
  supabaseConnection: boolean;
  mobileIssues: string[];
}

export const SongDiagnostics: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      console.log('Running mobile diagnostics...');
      
      // Test Supabase connection with multiple methods
      let supabaseConnection = false;
      let totalSongs = 0;
      
      try {
        // Use count query to get actual total of playable songs (with valid audio URLs)
        const { count: totalCount, error: countError } = await supabase
          .from('songs')
          .select('*', { count: 'exact', head: true })
          .not('audio_url', 'is', null)
          .neq('audio_url', '');
        
        console.log('Count query result:', { totalCount, countError });
        
        if (!countError && totalCount !== null) {
          supabaseConnection = true;
          totalSongs = totalCount;
          console.log(`Supabase connection successful - Found ${totalSongs} songs in database`);
        } else {
          console.error('Count query failed:', countError);
          
          // Fallback: try a regular select with no limit to get actual count
          try {
            const { data: allSongs, error: fallbackError } = await supabase
              .from('songs')
              .select('id');
            
            if (!fallbackError && allSongs) {
              totalSongs = allSongs.length;
              supabaseConnection = true;
              console.log(`Fallback count successful - Found ${totalSongs} songs`);
            }
          } catch (fallbackErr) {
            console.error('Fallback count also failed:', fallbackErr);
          }
        }
        
      } catch (error) {
        console.error('Database connection failed:', error);
        supabaseConnection = false;
      }

      // Check user songs count
      let userSongCount = 0;
      if (user && supabaseConnection) {
        try {
          const { count: userCount, error: userError } = await supabase
            .from('songs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
          
          if (!userError && userCount !== null) {
            userSongCount = userCount;
          }
        } catch (error) {
          console.error('User songs query failed:', error);
        }
      }

      // Check mobile-specific issues
      const mobileIssues: string[] = [];
      
      // Check if running on mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        mobileIssues.push('Running on mobile device');
      }
      
      // Check network connection
      const networkStatus = navigator.onLine ? 'Online' : 'Offline';
      if (!navigator.onLine) {
        mobileIssues.push('Device is offline');
      }
      
      // Check cache status
      const cacheKeys = await caches.keys();
      const cacheStatus = cacheKeys.length > 0 ? `${cacheKeys.length} caches active` : 'No caches';
      if (cacheKeys.length > 5) {
        mobileIssues.push('Multiple caches may be causing conflicts');
      }

      // Check storage usage
      let storageUsed = 'Unknown';
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const used = estimate.usage || 0;
          const quota = estimate.quota || 0;
          storageUsed = `${(used / 1024 / 1024).toFixed(1)}MB / ${(quota / 1024 / 1024 / 1024).toFixed(1)}GB`;
          
          // Check if storage is nearly full
          if (used / quota > 0.9) {
            mobileIssues.push('Device storage is nearly full');
          }
        } catch {
          storageUsed = 'Storage API not available';
        }
      }

      // Check for service worker issues
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 1) {
            mobileIssues.push('Multiple service workers detected');
          }
        } catch {
          mobileIssues.push('Service worker check failed');
        }
      }

      // Determine connection health
      let connectionHealth: 'good' | 'warning' | 'error' = 'good';
      if (!navigator.onLine || !supabaseConnection) {
        connectionHealth = 'error';
      } else if (totalSongs === 0 || mobileIssues.length > 2) {
        connectionHealth = 'warning';
      }

      setDiagnostics({
        totalSongs,
        userSongs: userSongCount,
        cacheStatus,
        networkStatus,
        lastSync: new Date().toLocaleString(),
        storageUsed,
        connectionHealth,
        supabaseConnection,
        mobileIssues
      });

    } catch (error: any) {
      console.error('Diagnostic error:', error);
      toast({
        title: 'Diagnostic Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testDatabaseConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .limit(1);
      
      if (error) throw error;
      
      toast({
        title: 'Database Connection',
        description: `Successfully connected! Found ${data?.length || 0} songs.`
      });
    } catch (error: any) {
      toast({
        title: 'Database Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [user]);

  if (!diagnostics) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="ml-2">Running mobile diagnostics...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mobile">Mobile Issues</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <Smartphone className="w-5 h-5 mr-2" />
              System Status
            </h3>
            <Badge variant={diagnostics.connectionHealth === 'good' ? 'default' : 
                          diagnostics.connectionHealth === 'warning' ? 'secondary' : 'destructive'}>
              {diagnostics.connectionHealth === 'good' && <CheckCircle className="w-3 h-3 mr-1" />}
              {diagnostics.connectionHealth !== 'good' && <AlertTriangle className="w-3 h-3 mr-1" />}
              {diagnostics.connectionHealth.toUpperCase()}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Database className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Total Songs:</span>
              </div>
              <p className="text-2xl font-bold">{diagnostics.totalSongs}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center">
                <Database className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Your Songs:</span>
              </div>
              <p className="text-2xl font-bold">{diagnostics.userSongs}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Network:</span>
              <Badge variant={diagnostics.networkStatus === 'Online' ? 'default' : 'destructive'}>
                <Wifi className="w-3 h-3 mr-1" />
                {diagnostics.networkStatus}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Database:</span>
              <Badge variant={diagnostics.supabaseConnection ? 'default' : 'destructive'}>
                {diagnostics.supabaseConnection ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Cache:</span>
              <Badge variant="secondary">{diagnostics.cacheStatus}</Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Storage:</span>
              <span className="text-sm">{diagnostics.storageUsed}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={runDiagnostics} disabled={loading} className="flex-1">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={testDatabaseConnection} variant="outline" className="flex-1">
              Test DB
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="mobile" className="space-y-4">
          <h4 className="font-medium">Mobile Device Issues</h4>
          
          {diagnostics.mobileIssues.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                No mobile-specific issues detected.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {diagnostics.mobileIssues.map((issue, index) => (
                <div key={index} className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    • {issue}
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {diagnostics.totalSongs === 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                No songs found - Possible causes:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 mt-2 list-disc list-inside">
                <li>Mobile network connectivity issues</li>
                <li>App cache preventing fresh data load</li>
                <li>Database connection problems</li>
                <li>Service worker conflicts</li>
              </ul>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="cache">
          <CacheManager />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default SongDiagnostics;