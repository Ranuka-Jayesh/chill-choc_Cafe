import React, { useState, useEffect } from 'react';
import { Database, Wifi, WifiHigh, WifiLow, WifiZero, WifiOff, RefreshCw } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { db } from '@/services/storage/db';
import { toast } from 'sonner';

interface BrandFooterProps {
  className?: string;
}

type SignalQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'OFFLINE';

export const BrandFooter: React.FC<BrandFooterProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const [signalQuality, setSignalQuality] = useState<SignalQuality>('EXCELLENT');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const measureNetworkSignal = async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setSupabaseConnected(false);
      setSignalQuality('OFFLINE');
      setLatencyMs(null);
      return;
    }

    const start = performance.now();
    try {
      const { error } = await supabase.from('system_settings').select('id').limit(1);
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setSupabaseConnected(!error);
      setIsOnline(true);

      const navConn = (navigator as any).connection;
      const rtt = navConn?.rtt ? Math.min(navConn.rtt, elapsed) : elapsed;

      if (rtt < 100) {
        setSignalQuality('EXCELLENT');
      } else if (rtt < 250) {
        setSignalQuality('GOOD');
      } else if (rtt < 550) {
        setSignalQuality('FAIR');
      } else {
        setSignalQuality('POOR');
      }
    } catch {
      setSupabaseConnected(false);
      setSignalQuality(navigator.onLine ? 'POOR' : 'OFFLINE');
    }
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await db.initFromSupabase();
      await measureNetworkSignal();
      toast.success('Database synchronized with Supabase Cloud!');
    } catch {
      toast.error('Sync failed. Working in offline mode.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      measureNetworkSignal();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSupabaseConnected(false);
      setSignalQuality('OFFLINE');
      setLatencyMs(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    measureNetworkSignal();
    const interval = setInterval(measureNetworkSignal, 15000);

    // Briefly spin sync icon on local data changes/writes
    const unsub = db.subscribe(() => {
      setIsSyncing(true);
      const timer = setTimeout(() => setIsSyncing(false), 900);
      return () => clearTimeout(timer);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      unsub();
    };
  }, []);

  const isDbLive = isOnline && supabaseConnected;

  const renderWifiSignalIcon = () => {
    switch (signalQuality) {
      case 'EXCELLENT':
        return (
          <span
            className="flex items-center cursor-default"
            title={`Internet Signal: Strong (${latencyMs ? `${latencyMs}ms` : '<100ms'})`}
          >
            <Wifi className="w-3.5 h-3.5 stroke-[2.4] text-emerald-600 transition-colors" />
          </span>
        );
      case 'GOOD':
        return (
          <span
            className="flex items-center cursor-default"
            title={`Internet Signal: Good (${latencyMs ? `${latencyMs}ms` : '150ms'})`}
          >
            <WifiHigh className="w-3.5 h-3.5 stroke-[2.4] text-emerald-600 transition-colors" />
          </span>
        );
      case 'FAIR':
        return (
          <span
            className="flex items-center cursor-default"
            title={`Internet Signal: Moderate (${latencyMs ? `${latencyMs}ms` : '350ms'})`}
          >
            <WifiLow className="w-3.5 h-3.5 stroke-[2.4] text-amber-500 transition-colors" />
          </span>
        );
      case 'POOR':
        return (
          <span
            className="flex items-center cursor-default"
            title={`Internet Signal: Weak (${latencyMs ? `${latencyMs}ms` : '>500ms'})`}
          >
            <WifiZero className="w-3.5 h-3.5 stroke-[2.4] text-rose-500 transition-colors" />
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="flex items-center cursor-default" title="Internet Connection: Offline">
            <WifiOff className="w-3.5 h-3.5 stroke-[2.4] text-rose-500 transition-colors" />
          </span>
        );
    }
  };

  return (
    <footer
      className={`h-7 px-4 sm:px-6 flex items-center justify-between text-[11px] font-bold text-text-secondary/80 flex-shrink-0 select-none z-10 w-full bg-white border-t border-[#EAE3DA] ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span>Developed By</span>
        <a
          href="https://www.ogotechnology.net"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-orange hover:opacity-80 font-extrabold hover:underline transition-colors"
        >
          www.ogotechnology.net
        </a>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="font-extrabold text-brand-brown-dark tracking-wide">Chill&amp;Choc V1.</span>
        
        {/* Dynamic Real-time Signal Strength Wi-Fi Icon */}
        {renderWifiSignalIcon()}

        {/* Supabase Database Connection Status Icon */}
        <span
          className="flex items-center cursor-default"
          title={
            isDbLive
              ? 'Supabase Cloud Database: Connected & Live'
              : 'Supabase Cloud: Disconnected (Offline POS Cache Active - Zero Downtime)'
          }
        >
          <Database
            className={`w-3.5 h-3.5 stroke-[2.4] transition-colors ${
              isDbLive ? 'text-emerald-600' : 'text-rose-500'
            }`}
          />
        </span>

        {/* Live Cloud Sync Icon (Interactive: Click to force resync) */}
        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="flex items-center cursor-pointer hover:opacity-75 transition-opacity disabled:cursor-not-allowed bg-transparent border-0 p-0 m-0"
          title={
            isSyncing
              ? 'Synchronizing with Supabase Cloud...'
              : isDbLive
              ? 'Cloud Sync: Synchronized (Click to force refresh)'
              : 'Cloud Sync: Offline mode (Changes stored locally)'
          }
        >
          <RefreshCw
            className={`w-3.5 h-3.5 stroke-[2.4] transition-colors ${
              isSyncing
                ? 'animate-spin text-brand-teal'
                : isDbLive
                ? 'text-emerald-600'
                : 'text-amber-500'
            }`}
          />
        </button>
      </div>
    </footer>
  );
};
