import React, { useState, useEffect } from 'react';
import { Customer, InventoryItem, InvoiceItem, PurchaseReturn, SalesReturn, Supplier } from '../types';
import { localDB } from '../services/db';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import { RotateCcw, Plus, ShoppingBag, TrendingUp, X, Trash2, AlertCircle } from 'lucide-react';
import { formatCurrency, formatNumber, CURRENCY_SYMBOL } from '../services/formatters';

export const ReturnsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales_returns' | 'purchase_returns'>('sales_returns');
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // Modals
  const [showAddSalesReturnModal, setShowAddSalesReturnModal] = useState(false);
  const [showAddPurchaseReturnModal, setShowAddPurchaseReturnModal] = useState(false);

  // Sales return form
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [salesReturnDate, setSalesReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesReturnNotes, setSalesReturnNotes] = useState('');
  const [salesReturnItems, setSalesReturnItems] = useState<InvoiceItem[]>([
    { itemId: '', itemName: '', quantity: 1, price: 0, total: 0 },
  ]);

  // Purchase return form
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseReturnDate, setPurchaseReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseReturnNotes, setPurchaseReturnNotes] = useState('');
  const [purchaseReturnItems, setPurchaseReturnItems] = useState<InvoiceItem[]>([
    { itemId: '', itemName: '', quantity: 1, price: 0, total: 0 },
  ]);

  const loadData = async () => {
    const sr = await localDB.getAll<SalesReturn>('salesReturns');
    sr.sort((a, b) => b.createdAt - a.createdAt);
    setSalesReturns(sr);

    const pr = await localDB.getAll<PurchaseReturn>('purchaseReturns');
    pr.sort((a, b) => b.createdAt - a.createdAt);
    setPurchaseReturns(pr);

    const custs = await localDB.getAll<Customer>('customers');
    setCustomers(custs);
    if (custs.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(custs[0].id);
    }

    const sups = await localDB.getAll<Supplier>('suppliers');
    setSuppliers(sups);
    if (sups.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(sups[0].id);
    }

    const items = await localDB.getAll<InventoryItem>('inventoryItems');
    setInventoryItems(items);
  };

  useEffect(() => {
    loadData();
    const unsub = syncManager.subscribeData(loadData);
    return () => unsub();
  }, []);

  // Sales return items handler
  const handleSalesReturnItemSelect = (index: number, itemId: string) => {
    const found = inventoryItems.find((i) => i.id === itemId);
    const updated = [...salesReturnItems];
    if (found) {
      const qty = updated[index].quantity || 1;
      const price = found.price || 0;
      updated[index] = {
        itemId: found.id,
        itemName: found.name,
        quantity: qty,
        price,
        total: qty * price,
      };
    } else {
      updated[index].itemId = itemId;
    }
    setSalesReturnItems(updated);
  };

  const handleSalesReturnLineChange = (index: number, field: 'quantity' | 'price' | 'itemName', val: any) => {
    const updated = [...salesReturnItems];
    if (field === 'quantity') {
      const q = Math.max(1, Number(val) || 1);
      updated[index].quantity = q;
      updated[index].total = q * (updated[index].price || 0);
    } else if (field === 'price') {
      const p = Math.max(0, Number(val) || 0);
      updated[index].price = p;
      updated[index].total = (updated[index].quantity || 1) * p;
    } else if (field === 'itemName') {
      updated[index].itemName = val;
    }
    setSalesReturnItems(updated);
  };

  const handleSaveSalesReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) {
      alert('يرجى اختيار العميل');
      return;
    }

    const validItems = salesReturnItems.filter((i) => i.itemName.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل مع تحديد الكمية');
      return;
    }

    await businessService.createSalesReturn({
      customerId: cust.id,
      customerName: cust.name,
      date: salesReturnDate,
      items: validItems,
      notes: salesReturnNotes,
    });

    setShowAddSalesReturnModal(false);
    setSalesReturnItems([{ itemId: '', itemName: '', quantity: 1, price: 0, total: 0 }]);
    setSalesReturnNotes('');
    await loadData();
  };

  // Purchase return items handler
  const handlePurchaseReturnItemSelect = (index: number, itemId: string) => {
    const found = inventoryItems.find((i) => i.id === itemId);
    const updated = [...purchaseReturnItems];
    if (found) {
      const qty = updated[index].quantity || 1;
      const price = found.costPrice || found.price || 0;
      updated[index] = {
        itemId: found.id,
        itemName: found.name,
        quantity: qty,
        price,
        total: qty * price,
      };
    } else {
      updated[index].itemId = itemId;
    }
    setPurchaseReturnItems(updated);
  };

  const handlePurchaseReturnLineChange = (index: number, field: 'quantity' | 'price' | 'itemName', val: any) => {
    const updated = [...purchaseReturnItems];
    if (field === 'quantity') {
      const q = Math.max(1, Number(val) || 1);
      updated[index].quantity = q;
      updated[index].total = q * (updated[index].price || 0);
    } else if (field === 'price') {
      const p = Math.max(0, Number(val) || 0);
      updated[index].price = p;
      updated[index].total = (updated[index].quantity || 1) * p;
    } else if (field === 'itemName') {
      updated[index].itemName = val;
    }
    setPurchaseReturnItems(updated);
  };

  const handleSavePurchaseReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === selectedSupplierId);
    if (!sup) {
      alert('يرجى اختيار المورد');
      return;
    }

    const validItems = purchaseReturnItems.filter((i) => i.itemName.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل مع تحديد الكمية والسعر');
      return;
    }

    await businessService.createPurchaseReturn({
      supplierId: sup.id,
      supplierName: sup.name,
      date: purchaseReturnDate,
      items: validItems,
      notes: purchaseReturnNotes,
    });

    setShowAddPurchaseReturnModal(false);
    setPurchaseReturnItems([{ itemId: '', itemName: '', quantity: 1, price: 0, total: 0 }]);
    setPurchaseReturnNotes('');
    await loadData();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Exactly 2 Tabs: 1. Sales Returns, 2. Purchase Returns */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sales_returns')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'sales_returns'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>1. مرتجع مبيعات ({salesReturns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('purchase_returns')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'purchase_returns'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>2. مرتجع مشتريات ({purchaseReturns.length})</span>
          </button>
        </div>

        {activeTab === 'sales_returns' ? (
          <button
            onClick={() => {
              if (customers.length === 0) {
                alert('يرجى إضافة عميل أولاً');
                return;
              }
              setShowAddSalesReturnModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مرتجع مبيعات</span>
          </button>
        ) : (
          <button
            onClick={() => {
              if (suppliers.length === 0) {
                alert('يرجى إضافة مورد أولاً');
                return;
              }
              setShowAddPurchaseReturnModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مرتجع مشتريات</span>
          </button>
        )}
      </div>

      {/* SALES RETURNS LIST */}
      {activeTab === 'sales_returns' && (
        <div className="space-y-2.5">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
            💡 مرتجع المبيعات: يعيد الكميات إلى رصيد المخزن تلقائياً (+quantity) ويسجل حركة مرتجع مبيعات مالية ومخزنية معتمدة.
          </div>

          {salesReturns.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border text-slate-400 text-xs">
              لا توجد مرتجعات مبيعات مسجلة
            </div>
          ) : (
            salesReturns.map((sr) => (
              <div
                key={sr.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
              >
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 font-mono">
                      {sr.returnNumber}
                    </span>
                    <span>العميل: {sr.customerName}</span>
                  </div>
                  <span className="text-slate-400">{sr.date}</span>
                </div>

                <div className="text-xs bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl flex justify-between items-center">
                  <span>الأصناف المرتجعة: {sr.items.map((i) => `${i.itemName} (${i.quantity})`).join(', ')}</span>
                  <span className="font-black text-rose-600 dark:text-rose-400" dir="ltr">
                    +{formatNumber(sr.total)} ج.م
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PURCHASE RETURNS LIST */}
      {activeTab === 'purchase_returns' && (
        <div className="space-y-2.5">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
            💡 مرتجع المشتريات: يخصم البضاعة المرتجعة من المخزن (-quantity) ويخفض حساب المورد بمقدار قيمة المرتجع في كشف الحساب.
          </div>

          {purchaseReturns.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border text-slate-400 text-xs">
              لا توجد مرتجعات مشتريات مسجلة
            </div>
          ) : (
            purchaseReturns.map((pr) => (
              <div
                key={pr.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
              >
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 font-mono">
                      {pr.returnNumber}
                    </span>
                    <span>المورد: {pr.supplierName}</span>
                  </div>
                  <span className="text-slate-400">{pr.date}</span>
                </div>

                <div className="text-xs bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl flex justify-between items-center">
                  <span>الأصناف المرتجعة للمورد: {pr.items.map((i) => `${i.itemName} (${i.quantity})`).join(', ')}</span>
                  <span className="font-black text-rose-600 dark:text-rose-400" dir="ltr">
                    -{formatNumber(pr.total)} ج.م
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ADD SALES RETURN MODAL */}
      {showAddSalesReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm">تسجيل مرتجع مبيعات من عميل</h3>
              <button onClick={() => setShowAddSalesReturnModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSalesReturn} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">العميل *</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={salesReturnDate}
                    onChange={(e) => setSalesReturnDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <label className="block font-bold">الأصناف المرتجعة (تضاف للمخزن):</label>
                {salesReturnItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select
                        value={item.itemId}
                        onChange={(e) => handleSalesReturnItemSelect(idx, e.target.value)}
                        className="w-full p-1.5 rounded-lg border text-xs"
                      >
                        <option value="">-- اختر صنف --</option>
                        {inventoryItems.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handleSalesReturnLineChange(idx, 'itemName', e.target.value)}
                        placeholder="اسم الصنف"
                        className="w-full p-1.5 mt-1 rounded-lg border text-xs"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleSalesReturnLineChange(idx, 'quantity', e.target.value)}
                        className="w-full p-1.5 rounded-lg border text-xs text-center"
                        required
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-400 block">سعر الوحدة</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => handleSalesReturnLineChange(idx, 'price', e.target.value)}
                        className="w-full p-1.5 rounded-lg border text-xs text-center"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={salesReturnNotes}
                  onChange={(e) => setSalesReturnNotes(e.target.value)}
                  placeholder="سبب الإرجاع..."
                  className="w-full p-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSalesReturnModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
                >
                  حفظ المرتجع وإضافة الكميات للمخزن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PURCHASE RETURN MODAL */}
      {showAddPurchaseReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm">تسجيل مرتجع مشتريات إلى مورد</h3>
              <button onClick={() => setShowAddPurchaseReturnModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchaseReturn} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">المورد *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
                    required
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={purchaseReturnDate}
                    onChange={(e) => setPurchaseReturnDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <label className="block font-bold">الأصناف المرتجعة (تخصم من المخزن):</label>
                {purchaseReturnItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select
                        value={item.itemId}
                        onChange={(e) => handlePurchaseReturnItemSelect(idx, e.target.value)}
                        className="w-full p-1.5 rounded-lg border text-xs"
                      >
                        <option value="">-- اختر صنف --</option>
                        {inventoryItems.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (متوفر: {inv.quantity})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handlePurchaseReturnLineChange(idx, 'itemName', e.target.value)}
                        placeholder="اسم الصنف"
                        className="w-full p-1.5 mt-1 rounded-lg border text-xs"
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 block">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handlePurchaseReturnLineChange(idx, 'quantity', e.target.value)}
                        className="w-full p-1.5 rounded-lg border text-xs text-center"
                        required
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-400 block">سعر الوحدة</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => handlePurchaseReturnLineChange(idx, 'price', e.target.value)}
                        className="w-full p-1.5 rounded-lg border text-xs text-center"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={purchaseReturnNotes}
                  onChange={(e) => setPurchaseReturnNotes(e.target.value)}
                  placeholder="سبب إرجاع البضاعة للمورد..."
                  className="w-full p-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseReturnModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
                >
                  حفظ وخصم الكمية من المخزن وحساب المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
