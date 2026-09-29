import React, { useState, useEffect } from 'react';
import { Customer, InventoryItem, InvoiceItem, SalesInvoice } from '../types';
import { localDB } from '../services/db';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import { formatInvoiceShare, shareContent } from '../services/shareHelper';
import { formatCurrency, formatNumber, CURRENCY_SYMBOL } from '../services/formatters';
import {
  TrendingUp,
  Users,
  Plus,
  Search,
  Share2,
  Trash2,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  AlertCircle,
  X,
  Check,
  Package,
} from 'lucide-react';

export const SalesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'customers'>('invoices');
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(null);
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] = useState<SalesInvoice | null>(null);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<Customer | null>(null);
  const [viewCustomerStatement, setViewCustomerStatement] = useState<Customer | null>(null);

  // New Invoice form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceLineItems, setInvoiceLineItems] = useState<InvoiceItem[]>([
    { itemId: '', itemName: '', quantity: 1, price: 0, total: 0 },
  ]);

  // Customer form state
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNotes, setCustNotes] = useState('');

  const loadData = async () => {
    const invs = await localDB.getAll<SalesInvoice>('salesInvoices');
    invs.sort((a, b) => b.createdAt - a.createdAt);
    setInvoices(invs);

    const custs = await localDB.getAll<Customer>('customers');
    setCustomers(custs);

    const items = await localDB.getAll<InventoryItem>('inventoryItems');
    setInventoryItems(items);
  };

  useEffect(() => {
    loadData();
    const unsub = syncManager.subscribeData(loadData);
    return () => unsub();
  }, []);

  // Filtered lists
  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Line item handlers
  const handleItemSelect = (index: number, itemId: string) => {
    const found = inventoryItems.find((i) => i.id === itemId);
    const updated = [...invoiceLineItems];
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
    setInvoiceLineItems(updated);
  };

  const handleLineChange = (index: number, field: 'quantity' | 'price' | 'itemName', val: any) => {
    const updated = [...invoiceLineItems];
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
    setInvoiceLineItems(updated);
  };

  const addLineItem = () => {
    setInvoiceLineItems([...invoiceLineItems, { itemId: '', itemName: '', quantity: 1, price: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (invoiceLineItems.length <= 1) return;
    setInvoiceLineItems(invoiceLineItems.filter((_, i) => i !== index));
  };

  const totalInvoiceAmount = invoiceLineItems.reduce((sum, item) => sum + item.total, 0);
  const totalInvoiceQty = invoiceLineItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('يرجى اختيار العميل');
      return;
    }

    const validItems = invoiceLineItems.filter((i) => i.itemName.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل مع تحديد الاسم والكمية');
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) return;

    try {
      await businessService.createSalesInvoice({
        customerId: customer.id,
        customerName: customer.name,
        date: invoiceDate,
        items: validItems,
        notes: invoiceNotes,
      });

      setShowAddInvoiceModal(false);
      // Reset form
      setInvoiceLineItems([{ itemId: '', itemName: '', quantity: 1, price: 0, total: 0 }]);
      setInvoiceNotes('');
      await loadData();
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ الفاتورة: ' + err.message);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteConfirmInvoice) return;
    try {
      await businessService.deleteSalesInvoice(deleteConfirmInvoice.id);
      setDeleteConfirmInvoice(null);
      await loadData();
    } catch (err: any) {
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  const handleShareInvoice = async (invoice: SalesInvoice) => {
    const text = formatInvoiceShare(invoice, true);
    await shareContent(`فاتورة مبيعات ${invoice.invoiceNumber}`, text);
  };

  // Customer submit
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) {
      alert('يرجى كتابة اسم العميل ورقم الهاتف');
      return;
    }

    if (editingCustomer) {
      await businessService.updateCustomer(editingCustomer.id, {
        name: custName,
        phone: custPhone,
        address: custAddress,
        notes: custNotes,
      });
    } else {
      await businessService.createCustomer({
        name: custName,
        phone: custPhone,
        address: custAddress,
        notes: custNotes,
      });
    }

    setShowAddCustomerModal(false);
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustNotes('');
    await loadData();
  };

  const handleDeleteCustomer = async () => {
    if (!deleteConfirmCustomer) return;
    await businessService.deleteCustomer(deleteConfirmCustomer.id);
    setDeleteConfirmCustomer(null);
    await loadData();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeTab === 'invoices'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>فواتير المبيعات ({invoices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>العملاء ({customers.length})</span>
          </button>
        </div>

        {activeTab === 'invoices' ? (
          <button
            onClick={() => {
              if (customers.length === 0) {
                alert('يرجى إضافة عميل أولاً قبل إنشاء الفاتورة');
                setActiveTab('customers');
                setShowAddCustomerModal(true);
                return;
              }
              setSelectedCustomerId(customers[0]?.id || '');
              setShowAddInvoiceModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>فاتورة جديدة</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setEditingCustomer(null);
              setCustName('');
              setCustPhone('');
              setCustAddress('');
              setCustNotes('');
              setShowAddCustomerModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عميل</span>
          </button>
        )}
      </div>

      {/* Quick Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === 'invoices' ? 'بحث برقم الفاتورة أو اسم العميل...' : 'بحث باسم العميل أو رقم الهاتف...'}
          className="w-full ps-9 pe-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* INVOICES LIST */}
      {activeTab === 'invoices' && (
        <div className="space-y-2.5">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              لا توجد فواتير مبيعات مسجلة
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {inv.customerName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{inv.date}</span>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">الكمية: </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{inv.quantity}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">الإجمالي: </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400" dir="ltr">
                      {formatNumber(inv.total)} ج.م
                    </span>
                  </div>
                </div>

                {inv.notes && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    ملاحظات: {inv.notes}
                  </div>
                )}

                {/* Actions: View, Preview, Share, Delete with confirmation */}
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setPreviewInvoice(inv)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    title="معاينة الفاتورة"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>معاينة</span>
                  </button>
                  <button
                    onClick={() => handleShareInvoice(inv)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                    title="مشاركة الفاتورة عبر أندرويد"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>مشاركة</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmInvoice(inv)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 transition cursor-pointer"
                    title="حذف الفاتورة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CUSTOMERS LIST */}
      {activeTab === 'customers' && (
        <div className="space-y-2.5">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              لا يوجد عملاء مسجلين
            </div>
          ) : (
            filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{cust.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>الهاتف: {cust.phone}</span>
                    {cust.address && <span>• العنوان: {cust.address}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditingCustomer(cust);
                      setCustName(cust.name);
                      setCustPhone(cust.phone);
                      setCustAddress(cust.address || '');
                      setCustNotes(cust.notes || '');
                      setShowAddCustomerModal(true);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => setDeleteConfirmCustomer(cust)}
                    className="p-1.5 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ADD SALES INVOICE MODAL */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl my-6 p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>إنشاء فاتورة مبيعات جديدة</span>
              </h3>
              <button onClick={() => setShowAddInvoiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    العميل *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    required
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    التاريخ *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    بنود الفاتورة (الأصناف والكميات)
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {invoiceLineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="col-span-12 sm:col-span-4">
                        <label className="block text-[10px] text-slate-500 mb-0.5">الصنف</label>
                        {inventoryItems.length > 0 ? (
                          <select
                            value={item.itemId}
                            onChange={(e) => handleItemSelect(idx, e.target.value)}
                            className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <option value="">-- اختر صنف أو اكتب --</option>
                            {inventoryItems.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} (متوفر: {inv.quantity}) - {inv.price} ر.س
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => handleLineChange(idx, 'itemName', e.target.value)}
                          placeholder="اسم الصنف"
                          className="w-full p-2 mt-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                          required
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] text-slate-500 mb-0.5">الكمية</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                          className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-center"
                          required
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-3">
                        <label className="block text-[10px] text-slate-500 mb-0.5">السعر (ر.س)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleLineChange(idx, 'price', e.target.value)}
                          className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-center"
                          required
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-2 text-center">
                        <label className="block text-[10px] text-slate-500 mb-0.5">الإجمالي</label>
                        <div className="font-bold text-slate-800 dark:text-slate-100 py-1.5" dir="ltr">
                          {item.total}
                        </div>
                      </div>

                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          disabled={invoiceLineItems.length <= 1}
                          className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total calculations preview */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">إجمالي الكميات: </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{totalInvoiceQty}</span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">الإجمالي النهائي: </span>
                  <span className="font-black text-sm text-blue-700 dark:text-blue-300" dir="ltr">
                    {formatNumber(totalInvoiceAmount)} ج.م
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات
                </label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  حفظ الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW INVOICE MODAL */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">معاينة فاتورة مبيعات</h3>
              <button onClick={() => setPreviewInvoice(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3 font-mono text-xs">
              <div className="text-center font-bold text-sm">=== Power H ===</div>
              <div className="text-center font-semibold text-blue-600">فاتورة مبيعات: {previewInvoice.invoiceNumber}</div>
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-700">
                <span>التاريخ: {previewInvoice.date}</span>
                <span>العميل: {previewInvoice.customerName}</span>
              </div>
              <div className="space-y-1">
                {previewInvoice.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {idx + 1}. {i.itemName} ({i.quantity} × {i.price} ج.م)
                    </span>
                    <span dir="ltr">{formatNumber(i.total)} ج.م</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 border-slate-200 dark:border-slate-700 flex justify-between font-bold">
                <span>الإجمالي النهائي</span>
                <span dir="ltr">{formatNumber(previewInvoice.total)} ج.م</span>
              </div>
              {previewInvoice.notes && (
                <div className="text-[10px] text-slate-500 font-sans pt-1">
                  ملاحظات: {previewInvoice.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleShareInvoice(previewInvoice)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة الفاتورة</span>
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE INVOICE CONFIRM */}
      {deleteConfirmInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="font-bold text-sm">تأكيد حذف الفاتورة</h4>
            <p className="text-xs text-slate-500">
              هل أنت متأكد من حذف الفاتورة رقم {deleteConfirmInvoice.invoiceNumber}؟ سيتم إعادة الكميات إلى المخزن وتعديل الحسابات تلقائياً.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmInvoice(null)}
                className="flex-1 py-2 rounded-xl border text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteInvoice}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                حذف الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER ADD/EDIT MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل مبيعات جديد'}
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">اسم العميل *</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">رقم الهاتف *</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">العنوان</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                >
                  حفظ العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRM */}
      {deleteConfirmCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="font-bold text-sm">تأكيد حذف العميل</h4>
            <p className="text-xs text-slate-500">
              هل أنت متأكد من حذف العميل {deleteConfirmCustomer.name}؟
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmCustomer(null)}
                className="flex-1 py-2 rounded-xl border text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteCustomer}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
