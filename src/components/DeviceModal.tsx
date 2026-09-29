import React, { useState } from 'react';
import { syncManager } from '../services/syncManager';
import { Smartphone, WifiOff, Wifi, RefreshCw, X, ShieldCheck, Check } from 'lucide-react';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileChanged: () => void;
}

const PRESET_DEVICES = [
  { id: 'device_a', name: 'الجهاز الرئيسي (أ) - الإدارة' },
  { id: 'device_b', name: 'جهاز المستودع (ب) - البضاعة' },
  { id: 'device_c', name: 'جهاز المبيعات (ج) - الكاشير' },
  { id: 'device_d', name: 'جهاز المحاسبة (د) - الخزينة' },
];

export const DeviceModal: React.FC<DeviceModalProps> = ({ isOpen, onClose, onProfileChanged }) => {
  if (!isOpen) return null;

  const currentId = syncManager.getDeviceId();
  const [isSimOffline, setIsSimOffline] = useState(syncManager.getSimulatedOffline());
  const [selectedId, setSelectedId] = useState(currentId);

  const handleToggleOffline = async (val: boolean) => {
    setIsSimOffline(val);
    await syncManager.setSimulatedOffline(val);
    onProfileChanged();
  };

  const handleSwitchDevice = async (device: { id: string; name: string }) => {
    setSelectedId(device.id);
    await syncManager.setDeviceProfile(device.id, device.name);
    await syncManager.triggerSync();
    onProfileChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">إدارة الأجهزة والمزامنة</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">تزامن البيانات الحي بين 3-4 أجهزة أندرويد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Offline simulation toggle */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  isSimOffline
                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isSimOffline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">محاكاة انقطاع الإنترنت</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isSimOffline ? 'وضع عدم الاتصال نشط (العمليات تحفظ محلياً)' : 'متصل بالشبكة السحابية'}
                </div>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSimOffline}
                onChange={(e) => handleToggleOffline(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Device Profile Switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              الملف التعريفي للجهاز النشط:
            </label>
            <div className="space-y-2">
              {PRESET_DEVICES.map((dev) => {
                const isActive = selectedId === dev.id;
                return (
                  <button
                    key={dev.id}
                    onClick={() => handleSwitchDevice(dev)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-right transition active:scale-[0.99] cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                      <span className="text-sm">{dev.name}</span>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sync Information */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              جميع الأجهزة الأربعة تتصل بقاعدة البيانات السحابية المشتركة وتتزامن بصورة لحظية ودورية تلقائياً دون الحاجة لنفس شبكة الواي فاي.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
