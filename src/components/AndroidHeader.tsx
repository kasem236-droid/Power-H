import React, { useState } from 'react';
import { ConnectionState, SyncState } from '../types';
import { syncManager } from '../services/syncManager';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Moon,
  Sun,
  Smartphone,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface AndroidHeaderProps {
  connectionState: ConnectionState;
  syncState: SyncState;
  pendingCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenDeviceModal: () => void;
}

export const AndroidHeader: React.FC<AndroidHeaderProps> = ({
  connectionState,
  syncState,
  pendingCount,
  isDarkMode,
  onToggleTheme,
  onOpenDeviceModal,
}) => {
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    await syncManager.triggerSync();
    setTimeout(() => setIsManualSyncing(false), 600);
  };

  const isConnected = connectionState === 'connected';

  // Render single Connection Status element
  const renderConnectionStatus = () => {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-colors ${
          isConnected
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse'
        }`}
        title="حالة الاتصال بالإنترنت"
      >
        {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        <span>حالة الاتصال: {isConnected ? 'متصل' : 'غير متصل'}</span>
      </div>
    );
  };

  // Render single Sync Status element
  const renderSyncStatus = () => {
    let icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    let text = 'متزامن';
    let style = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';

    if (syncState === 'syncing' || isManualSyncing) {
      icon = <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      text = 'جاري المزامنة';
      style = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    } else if (syncState === 'pending' || pendingCount > 0) {
      icon = <Clock className="w-3.5 h-3.5 text-amber-500" />;
      text = `عمليات معلقة (${pendingCount})`;
      style = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    } else if (syncState === 'failed') {
      icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
      text = 'فشلت المزامنة';
      style = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }

    return (
      <button
        onClick={handleManualSync}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${style}`}
        title="انقر للمزامنة الفورية"
      >
        {icon}
        <span>حالة المزامنة: {text}</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* App Title and Logo */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-extrabold flex items-center justify-center shadow-md shadow-blue-500/20 text-base">
            PH
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
              Power H
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">إدارة الأعمال السحابية</p>
          </div>
        </div>

        {/* Central Status Indicators: EXACTLY 1 Connection Status & 1 Sync Status */}
        <div className="hidden sm:flex items-center gap-2">
          {renderConnectionStatus()}
          {renderSyncStatus()}
        </div>

        {/* Action Buttons: Device Switcher & Theme Switcher */}
        <div className="flex items-center gap-1.5">
          {/* Device Profile Button */}
          <button
            onClick={onOpenDeviceModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 cursor-pointer"
            title="إدارة الأجهزة والمزامنة التجريبية"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden md:inline">{syncManager.getDeviceName()}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Theme Toggle (One simple switch) */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 cursor-pointer"
            title={isDarkMode ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>

      {/* Mobile status banner */}
      <div className="sm:hidden px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
        {renderConnectionStatus()}
        {renderSyncStatus()}
      </div>
    </header>
  );
};
