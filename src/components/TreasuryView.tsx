import React, { useState, useEffect } from 'react';
import { Deposit, Expense, Supplier, Transfer, TransferType } from '../types';
import { localDB } from '../services/db';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import { formatNumber, CURRENCY_SYMBOL } from '../services/formatters';
import {
  Vault,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Building2,
  User,
  Wallet,
} from 'lucide-react';

export const TreasuryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deposits' | 'expenses' | 'transfers'>('deposits');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Treasury summary values
  const [cashBalance, setCashBalance] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalTransfers, setTotalTransfers] = useState(0);

  // Form states
  // 1. Deposit form
  const [depAmount, setDepAmount] = useState('');
  const [depDesc, setDepDesc] = useState('');
  const [depDate, setDepDate] = useState(new Date().toISOString().split('T')[0]);
  const [depNotes, setDepNotes] = useState('');

  // 2. Expense form
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expNotes, setExpNotes] = useState('');

  // 3. Transfer form (Three options: Transfer to Suppliers, Transfer to Modi, Transfer to Qasim)
  const [transferType, setTransferType] = useState<TransferType>('SUPPLIER');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [transDesc, setTransDesc] = useState('');
  const [transNotes, setTransNotes] = useState('');

  // Delete confirm states
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'deposit' | 'expense' | 'transfer'; id: string; name: string } | null>(null);

  const loadData = async () => {
    const summary = await businessService.getTreasurySummary();
    setCashBalance(summary.cashBalance);
    setTotalDeposits(summary.totalDeposits);
    setTotalExpenses(summary.totalExpenses);
    setTotalTransfers(summary.totalTransfers);

    const deps = await localDB.getAll<Deposit>('deposits');
    deps.sort((a, b) => b.createdAt - a.createdAt);
    setDeposits(deps);

    const exps = await localDB.getAll<Expense>('expenses');
    exps.sort((a, b) => b.createdAt - a.createdAt);
    setExpenses(exps);

    const trs = await localDB.getAll<Transfer>('transfers');
    trs.sort((a, b) => b.createdAt - a.createdAt);
    setTransfers(trs);

    const sups = await localDB.getAll<Supplier>('suppliers');
    setSuppliers(sups);
    if (sups.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(sups[0].id);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = syncManager.subscribeData(loadData);
    return () => unsub();
  }, []);

  // Submit Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number(depAmount) || !depDesc.trim()) {
      alert('يرجى تحديد المبلغ ووصف الإيداع');
      return;
    }

    await businessService.createDeposit({
      amount: Number(depAmount),
      description: depDesc,
      date: depDate,
      notes: depNotes,
    });

    setDepAmount('');
    setDepDesc('');
    setDepNotes('');
    await loadData();
  };

  // Submit Expense
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number(expAmount) || !expDesc.trim()) {
      alert('يرجى تحديد المبلغ ووصف المصروف');
      return;
    }

    await businessService.createExpense({
      amount: Number(expAmount),
      description: expDesc,
      date: expDate,
      notes: expNotes,
    });

    setExpAmount('');
    setExpDesc('');
    setExpNotes('');
    await loadData();
  };

  // Submit Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number(transAmount)) {
      alert('يرجى إدخال مبلغ التحويل');
      return;
    }

    let targetName = '';
    let targetId: string | undefined = undefined;

    if (transferType === 'SUPPLIER') {
      const foundSup = suppliers.find((s) => s.id === selectedSupplierId);
      if (!foundSup) {
        alert('يرجى اختيار المورد المحول إليه');
        return;
      }
      targetName = foundSup.name;
      targetId = foundSup.id;
    } else if (transferType === 'MODI') {
      targetName = 'مودي';
    } else if (transferType === 'QASIM') {
      targetName = 'قاسم';
    }

    const defaultDesc =
      transferType === 'SUPPLIER'
        ? `تحويل سداد للمورد ${targetName}`
        : `تحويل إلى ${targetName}`;

    await businessService.createTransfer({
      type: transferType,
      targetId,
      targetName,
      amount: Number(transAmount),
      date: transDate,
      description: transDesc.trim() || defaultDesc,
      notes: transNotes,
    });

    setTransAmount('');
    setTransDesc('');
    setTransNotes('');
    await loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'deposit') {
      await businessService.deleteDeposit(deleteTarget.id);
    } else if (deleteTarget.type === 'expense') {
      await businessService.deleteExpense(deleteTarget.id);
    } else if (deleteTarget.type === 'transfer') {
      await businessService.deleteTransfer(deleteTarget.id);
    }
    setDeleteTarget(null);
    await loadData();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Treasury Header Summary Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20">
              <Vault className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs text-blue-200">الرصيد النقدي في الخزينة</div>
              <div className="text-2xl font-black" dir="ltr">
                {formatNumber(cashBalance)} <span className="text-xs font-bold">{CURRENCY_SYMBOL}</span>
              </div>
            </div>
          </div>
          <div className="text-left text-xs space-y-1">
            <div className="text-emerald-300">
              + إيداعات: {formatNumber(totalDeposits)} {CURRENCY_SYMBOL}
            </div>
            <div className="text-rose-300">
              - مصروفات: {formatNumber(totalExpenses)} {CURRENCY_SYMBOL}
            </div>
            <div className="text-purple-300">
              - تحويلات: {formatNumber(totalTransfers)} {CURRENCY_SYMBOL}
            </div>
          </div>
        </div>
      </div>

      {/* Exactly 3 Tabs: 1. Deposits 2. Expenses 3. Transfers */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('deposits')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'deposits'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>1. الإيداعات ({deposits.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>2. المصروفات ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'transfers'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>3. التحويلات ({transfers.length})</span>
        </button>
      </div>

      {/* 1. DEPOSITS SECTION */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          {/* Input Form */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span>تسجيل إيداع نقدي جديد في الخزينة (زيادة الرصيد)</span>
            </h3>

            <form onSubmit={handleDepositSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">البيان / السبب *</label>
                  <input
                    type="text"
                    value={depDesc}
                    onChange={(e) => setDepDesc(e.target.value)}
                    placeholder="سبب الإيداع (مثلاً: تمويل نقدي، رأس مال)..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={depDate}
                    onChange={(e) => setDepDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={depNotes}
                  onChange={(e) => setDepNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إيداع المبلغ في الخزينة</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Deposits */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">قائمة الإيداعات المسجلة:</h4>
            {deposits.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                لا توجد إيداعات مسجلة حتى الآن
              </div>
            ) : (
              deposits.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                        +{formatNumber(d.amount)} {CURRENCY_SYMBOL}
                      </span>
                      <span>• {d.description}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      التاريخ: {d.date} {d.notes ? `• ${d.notes}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ type: 'deposit', id: d.id, name: d.description })}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. EXPENSES SECTION */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Input Form */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-rose-600" />
              <span>تسجيل مصروف جديد (خصم من رصيد الخزينة)</span>
            </h3>

            <form onSubmit={handleExpenseSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">وصف المصروف *</label>
                  <input
                    type="text"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    placeholder="مثلاً: إيجار، كهرباء، صيانة، رواتب..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shadow-rose-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>تسجيل وخصم المصروف</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Expenses */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">قائمة المصروفات المسجلة:</h4>
            {expenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                لا توجد مصروفات مسجلة حتى الآن
              </div>
            ) : (
              expenses.map((e) => (
                <div
                  key={e.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="font-black text-rose-600 dark:text-rose-400" dir="ltr">
                        -{formatNumber(e.amount)} {CURRENCY_SYMBOL}
                      </span>
                      <span>• {e.description}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      التاريخ: {e.date} {e.notes ? `• ${e.notes}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ type: 'expense', id: e.id, name: e.description })}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. TRANSFERS SECTION (3 Options: Suppliers, Modi, Qasim) */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Input Form */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-600" />
              <span>تحويل مالي (خصم من الخزينة وإيداع في حساب الوجهة)</span>
            </h3>

            {/* Three Transfer Options Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                نوع التحويل (حدد الوجهة):
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferType('SUPPLIER')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    transferType === 'SUPPLIER'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>1. تحويل للموردين</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferType('MODI')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    transferType === 'MODI'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>2. تحويل لـ مودي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferType('QASIM')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    transferType === 'QASIM'
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>3. تحويل لـ قاسم</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* If Supplier is selected, show Supplier dropdown */}
                {transferType === 'SUPPLIER' ? (
                  <div>
                    <label className="block font-semibold mb-1">المورد المستلم *</label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      required
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold mb-1">المستلم</label>
                    <input
                      type="text"
                      disabled
                      value={transferType === 'MODI' ? 'حساب مودي المستقل' : 'حساب قاسم المستقل'}
                      className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-purple-700 dark:text-purple-300"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold mb-1">مبلغ التحويل (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={transAmount}
                    onChange={(e) => setTransAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={transDate}
                    onChange={(e) => setTransDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">البيان / الوصف</label>
                  <input
                    type="text"
                    value={transDesc}
                    onChange={(e) => setTransDesc(e.target.value)}
                    placeholder="وصف التحويل..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={transNotes}
                    onChange={(e) => setTransNotes(e.target.value)}
                    placeholder="ملاحظات اختيارية..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>تأكيد التحويل وخصمه من الخزينة</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of Transfers */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">سجل التحويلات الصادرة:</h4>
            {transfers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                لا توجد تحويلات مسجلة حتى الآن
              </div>
            ) : (
              transfers.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="font-black text-purple-600 dark:text-purple-400" dir="ltr">
                        -{formatNumber(t.amount)} {CURRENCY_SYMBOL}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                        {t.type === 'SUPPLIER' ? 'مورد' : t.type === 'MODI' ? 'مودي' : 'قاسم'}
                      </span>
                      <span>إلى: {t.targetName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {t.description} • التاريخ: {t.date} {t.notes ? `• ${t.notes}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget({ type: 'transfer', id: t.id, name: t.targetName })}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="font-bold text-sm">تأكيد الحذف</h4>
            <p className="text-xs text-slate-500">
              هل أنت متأكد من حذف هذه الحركة ({deleteTarget.name})؟ سيتم تعديل رصيد الخزينة والحسابات المرتبطة تلقائياً.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-xl border text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                حذف الحركة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
