import React, { useEffect, useState } from 'react';
import { ConnectionState, SyncState } from '../types';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import { formatCurrency, formatNumber } from '../services/formatters';
import { NavSection } from './AndroidNavBar';
import {
  Wallet,
  ArrowDownLeft,
  Send,
  Wifi,
  WifiOff,
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertTriangle,
  TrendingUp,
  ShoppingBag,
  Vault,
  Package,
  RotateCcw,
  Search,
  Users2,
  Settings,
  ChevronLeft,
  Moon,
  Sun,
} from 'lucide-react';

interface DashboardViewProps {
  connectionState: ConnectionState;
  syncState: SyncState;
  pendingCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onNavigate: (section: NavSection) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  connectionState,
  syncState,
  pendingCount,
  isDarkMode,
  onToggleTheme,
  onNavigate,
}) => {
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [totalTransfers, setTotalTransfers] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const summary = await businessService.getTreasurySummary();
      setCashBalance(summary.cashBalance);
      setTotalExpenses(summary.totalExpenses);
      setTotalTransfers(summary.totalTransfers);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const unsubData = syncManager.subscribeData(loadDashboardData);
    return () => unsubData();
  }, []);

  const isConnected = connectionState === 'connected';

  const getSyncStatusDetails = () => {
    if (syncState === 'syncing') {
      return {
        label: 'Syncing',
        arabicLabel: 'جاري المزامنة',
        icon: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
      };
    }
    if (syncState === 'pending' || pendingCount > 0) {
      return {
        label: 'Pending operations',
        arabicLabel: `عمليات معلقة (${pendingCount})`,
        icon: <Clock className="w-4 h-4 text-amber-500" />,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      };
    }
    if (syncState === 'failed') {
      return {
        label: 'Sync failed',
        arabicLabel: 'فشلت المزامنة',
        icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
      };
    }
    return {
      label: 'Synced',
      arabicLabel: 'متزامن',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    };
  };

  const syncDetails = getSyncStatusDetails();

  return (
    <div className="space-y-5 pb-20">
      {/* 4 & 5: Exactly ONE "Connection Status" and ONE "Sync Status" + Theme Quick Toggle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Connection Status Card */}
        <div
          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-xs ${
            isConnected
              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/70 text-rose-900 dark:text-rose-200 animate-pulse'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                isConnected ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Connection Status</div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                <span className="text-xs font-normal opacity-80">({isConnected ? 'متصل' : 'غير متصل'})</span>
              </div>
            </div>
          </div>
          <span
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
        </div>

        {/* Sync Status Card */}
        <div
          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-xs ${syncDetails.color}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 shadow-xs">
              {syncDetails.icon}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Sync Status</div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <span>{syncDetails.label}</span>
                <span className="text-xs font-normal opacity-80">({syncDetails.arabicLabel})</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => syncManager.triggerSync()}
            className="text-xs p-1.5 rounded-lg bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            title="مزامنة فورية الآن"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main Screen Theme Toggle Card */}
        <div className="p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-amber-500">
              {isDarkMode ? <Moon className="w-5 h-5 text-amber-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">مظهر التطبيق (Theme)</div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <span>{isDarkMode ? 'الوضع الليلي (Dark)' : 'الوضع الفاتح (Light)'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onToggleTheme}
            className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            title={isDarkMode ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            <span>{isDarkMode ? 'فاتح' : 'ليلي'}</span>
          </button>
        </div>
      </div>

      {/* 1, 2, 3: Cash Balance, Total Expenses, Total Transfers in Egyptian Pound (ج.م) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Current Cash Balance (الرصيد النقدي الحالي) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 text-white shadow-lg shadow-blue-900/20 relative overflow-hidden">
          <div className="absolute top-0 end-0 translate-x-4 -translate-y-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">
              الرصيد النقدي الحالي
            </span>
            <div className="p-2 rounded-xl bg-white/15 text-white">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight" dir="ltr">
            {formatNumber(cashBalance)} <span className="text-sm font-bold text-blue-200">ج.م</span>
          </div>
          <div className="mt-2 text-[11px] text-blue-200 flex items-center justify-between">
            <span>الخزينة = الإيداعات - المصروفات - التحويلات</span>
            {cashBalance < 0 && (
              <span className="bg-rose-500/80 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                رصيد مدين
              </span>
            )}
          </div>
        </div>

        {/* 2. Total Expenses (إجمالي المصروفات) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              إجمالي المصروفات
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white" dir="ltr">
            {formatNumber(totalExpenses)} <span className="text-sm font-bold text-rose-600 dark:text-rose-400">ج.م</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            مجموع كافة بنود المصروفات المسجلة
          </div>
        </div>

        {/* 3. Total Transfers (إجمالي التحويلات) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              إجمالي التحويلات
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white" dir="ltr">
            {formatNumber(totalTransfers)} <span className="text-sm font-bold text-purple-600 dark:text-purple-400">ج.م</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            الموردين + مودي + قاسم
          </div>
        </div>
      </div>

      {/* Main Sections Navigation Grid */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">أقسام النظام الأساسية</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {
              id: 'sales' as NavSection,
              title: 'المبيعات',
              desc: 'فواتير المبيعات والعملاء',
              icon: TrendingUp,
              color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
            },
            {
              id: 'purchases' as NavSection,
              title: 'المشتريات',
              desc: 'فواتير الشراء والموردين',
              icon: ShoppingBag,
              color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
            },
            {
              id: 'treasury' as NavSection,
              title: 'الخزينة',
              desc: 'إيداعات، مصروفات، تحويلات',
              icon: Vault,
              color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
            },
            {
              id: 'inventory' as NavSection,
              title: 'المخزن',
              desc: 'الأصناف وحركات الجرد',
              icon: Package,
              color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30',
            },
            {
              id: 'returns' as NavSection,
              title: 'المرتجعات',
              desc: 'مرتجع مبيعات ومشتريات',
              icon: RotateCcw,
              color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30',
            },
            {
              id: 'search' as NavSection,
              title: 'البحث',
              desc: 'عملاء وهميون',
              icon: Search,
              color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30',
            },
            {
              id: 'accounts' as NavSection,
              title: 'الحسابات',
              desc: 'حساب مودي وحساب قاسم',
              icon: Users2,
              color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30',
            },
            {
              id: 'settings' as NavSection,
              title: 'الإعدادات',
              desc: 'النسخ الاحتياطي وسجل العمليات',
              icon: Settings,
              color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
            },
          ].map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                onClick={() => onNavigate(sec.id)}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-right hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition active:scale-[0.98] cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${sec.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition" />
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                  {sec.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {sec.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
