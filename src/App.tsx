/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ConnectionState, SyncState } from './types';
import { syncManager } from './services/syncManager';
import { localDB } from './services/db';
import { businessService } from './services/businessLogic';
import { AndroidHeader } from './components/AndroidHeader';
import { AndroidNavBar, NavSection } from './components/AndroidNavBar';
import { DashboardView } from './components/DashboardView';
import { SalesView } from './components/SalesView';
import { PurchasesView } from './components/PurchasesView';
import { TreasuryView } from './components/TreasuryView';
import { InventoryView } from './components/InventoryView';
import { ReturnsView } from './components/ReturnsView';
import { SearchView } from './components/SearchView';
import { AccountsView } from './components/AccountsView';
import { SettingsView } from './components/SettingsView';
import { DeviceModal } from './components/DeviceModal';
import { ExitConfirmDialog } from './components/ExitConfirmDialog';

export default function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [connectionState, setConnectionState] = useState<ConnectionState>(syncManager.getConnectionState());
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getSyncState());
  const [pendingCount, setPendingCount] = useState<number>(syncManager.getPendingCount());

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('power_h_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Modals
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [hasExited, setHasExited] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Sync theme to DOM and localStorage immediately
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (isDarkMode) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      body.classList.add('dark');
      body.setAttribute('data-theme', 'dark');
      localStorage.setItem('power_h_theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      body.classList.remove('dark');
      body.setAttribute('data-theme', 'light');
      localStorage.setItem('power_h_theme', 'light');
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Seed initial realistic data if database is brand new
  const checkInitialSeed = async () => {
    const items = await localDB.getAll('inventoryItems');
    if (items.length === 0) {
      // Seed initial sample inventory, customers, suppliers with Egyptian data
      const s1 = await businessService.createSupplier({
        name: 'مؤسسة النيل للتوريدات العامة',
        phone: '01011122334',
        address: 'القاهرة - مدينة نصر',
      });
      const c1 = await businessService.createCustomer({
        name: 'شركة الأفق للتجارة والتوزيع',
        phone: '01144433221',
        address: 'الجيزة - الدقي',
      });
      const i1 = await businessService.createInventoryItem({
        name: 'محول طاقة فائق 65W',
        price: 120,
        initialQuantity: 25,
      });
      const i2 = await businessService.createInventoryItem({
        name: 'كابل بيانات فائق السرعة Type-C',
        price: 35,
        initialQuantity: 60,
      });

      // Initial Treasury Deposit in EGP
      await businessService.createDeposit({
        amount: 5000,
        description: 'رأس مال افتتاحي للخزينة',
        date: new Date().toISOString().split('T')[0],
      });
    }
  };

  // Initialize sync manager and subscribers
  useEffect(() => {
    const initApp = async () => {
      await syncManager.init();
      await checkInitialSeed();
    };
    initApp();

    const unsubStatus = syncManager.subscribeStatus((conn, sync, pending) => {
      setConnectionState(conn);
      setSyncState(sync);
      setPendingCount(pending);
    });

    return () => unsubStatus();
  }, []);

  // Android Back navigation & Exit confirmation handler
  useEffect(() => {
    // Initial state push
    window.history.replaceState({ section: 'dashboard', root: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      if (currentSection !== 'dashboard') {
        // Navigate back to root dashboard
        setCurrentSection('dashboard');
        window.history.pushState({ section: 'dashboard', root: true }, '');
      } else {
        // Already at root screen: show Android exit confirmation dialog
        setShowExitDialog(true);
        // Push state again so the user doesn't accidentally navigate out of the applet
        window.history.pushState({ section: 'dashboard', root: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentSection]);

  const handleNavigate = (section: NavSection) => {
    if (section !== currentSection) {
      window.history.pushState({ section }, '');
      setCurrentSection(section);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCancelExit = () => {
    setShowExitDialog(false);
  };

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    setHasExited(true);
  };

  if (hasExited) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center font-black text-2xl shadow-xl">
          PH
        </div>
        <h2 className="text-xl font-bold">تم الخروج من تطبيق Power H</h2>
        <p className="text-xs text-slate-400 max-w-xs">
          تم حفظ كافة العمليات والحسابات محلياً وسحابياً بأمان.
        </p>
        <button
          onClick={() => {
            setHasExited(false);
            setCurrentSection('dashboard');
          }}
          className="mt-4 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
        >
          إعادة فتح التطبيق
        </button>
      </div>
    );
  }

  return (
    <div key={reloadKey} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors selection:bg-blue-500 selection:text-white">
      {/* Android Top Header */}
      <AndroidHeader
        connectionState={connectionState}
        syncState={syncState}
        pendingCount={pendingCount}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onOpenDeviceModal={() => setShowDeviceModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {currentSection === 'dashboard' && (
          <DashboardView
            connectionState={connectionState}
            syncState={syncState}
            pendingCount={pendingCount}
            isDarkMode={isDarkMode}
            onToggleTheme={handleToggleTheme}
            onNavigate={handleNavigate}
          />
        )}

        {currentSection === 'sales' && <SalesView />}

        {currentSection === 'purchases' && <PurchasesView />}

        {currentSection === 'treasury' && <TreasuryView />}

        {currentSection === 'inventory' && <InventoryView />}

        {currentSection === 'returns' && <ReturnsView />}

        {currentSection === 'search' && <SearchView />}

        {currentSection === 'accounts' && <AccountsView />}

        {currentSection === 'settings' && (
          <SettingsView
            connectionState={connectionState}
            syncState={syncState}
            pendingCount={pendingCount}
            isDarkMode={isDarkMode}
            onToggleTheme={handleToggleTheme}
            onReloadAll={() => setReloadKey((k) => k + 1)}
          />
        )}
      </main>

      {/* Android Bottom Navigation Bar */}
      <AndroidNavBar currentSection={currentSection} onSelectSection={handleNavigate} />

      {/* Multi-Device Simulator & Offline Modal */}
      <DeviceModal
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        onProfileChanged={() => setReloadKey((k) => k + 1)}
      />

      {/* Android Exit Confirmation Dialog */}
      <ExitConfirmDialog
        isOpen={showExitDialog}
        onCancel={handleCancelExit}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
}
