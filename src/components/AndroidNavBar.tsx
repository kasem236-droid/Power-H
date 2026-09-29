import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  Vault,
  Package,
  RotateCcw,
  Search,
  Users2,
  Settings,
} from 'lucide-react';

export type NavSection =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'treasury'
  | 'inventory'
  | 'returns'
  | 'search'
  | 'accounts'
  | 'settings';

interface AndroidNavBarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: any }> = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'sales', label: 'المبيعات', icon: TrendingUp },
  { id: 'purchases', label: 'المشتريات', icon: ShoppingBag },
  { id: 'treasury', label: 'الخزينة', icon: Vault },
  { id: 'inventory', label: 'المخزن', icon: Package },
  { id: 'returns', label: 'المرتجعات', icon: RotateCcw },
  { id: 'search', label: 'البحث', icon: Search },
  { id: 'accounts', label: 'الحسابات', icon: Users2 },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export const AndroidNavBar: React.FC<AndroidNavBarProps> = ({ currentSection, onSelectSection }) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-1 sm:px-2 flex items-center justify-around overflow-x-auto no-scrollbar py-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] sm:min-w-[70px] py-1 px-1 rounded-xl transition-all active:scale-90 cursor-pointer ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[10px] mt-0.5 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
