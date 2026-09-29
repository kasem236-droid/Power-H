import React, { useState, useEffect } from 'react';
import { InventoryItem, InvoiceItem, PurchaseInvoice, Supplier } from '../types';
import { localDB } from '../services/db';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import { formatInvoiceShare, formatSupplierStatementShare, shareContent } from '../services/shareHelper';
import { generateAndShareStatementPDF } from '../services/pdfGenerator';
import { formatCurrency, formatNumber, CURRENCY_SYMBOL } from '../services/formatters';
import {
  ShoppingBag,
  Building2,
  Plus,
  Search,
  Share2,
  FileDown,
  Trash2,
  Eye,
  FileText,
  DollarSign,
  AlertCircle,
  X,
  CreditCard,
  Send,
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'suppliers'>('invoices');
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] = useState<PurchaseInvoice | null>(null);

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<Supplier | null>(null);

  // Supplier Statement Modal
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementData, setStatementData] = useState<any>(null);

  // Quick Pay Supplier Modal
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('سداد دفعة للمورد');
  const [payNotes, setPayNotes] = useState('');

  // New Invoice form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceLineItems, setInvoiceLineItems] = useState<InvoiceItem[]>([
    { itemId: '', itemName: '', quantity: 1, price: 0, total: 0 },
  ]);

  // Supplier form state
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supNotes, setSupNotes] = useState('');

  const loadData = async () => {
    const invs = await localDB.getAll<PurchaseInvoice>('purchaseInvoices');
    invs.sort((a, b) => b.createdAt - a.createdAt);
    setInvoices(invs);

    const sups = await localDB.getAll<Supplier>('suppliers');
    setSuppliers(sups);

    const items = await localDB.getAll<InventoryItem>('inventoryItems');
    setInventoryItems(items);
  };

  useEffect(() => {
    loadData();
    const unsub = syncManager.subscribeData(loadData);
    return () => unsub();
  }, []);

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Line item handlers
  const handleItemSelect = (index: number, itemId: string) => {
    const found = inventoryItems.find((i) => i.id === itemId);
    const updated = [...invoiceLineItems];
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
    if (!selectedSupplierId) {
      alert('يرجى اختيار المورد');
      return;
    }

    const validItems = invoiceLineItems.filter((i) => i.itemName.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل مع تحديد الاسم والكمية والسعر');
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) return;

    try {
      await businessService.createPurchaseInvoice({
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: invoiceDate,
        items: validItems,
        notes: invoiceNotes,
      });

      setShowAddInvoiceModal(false);
      setInvoiceLineItems([{ itemId: '', itemName: '', quantity: 1, price: 0, total: 0 }]);
      setInvoiceNotes('');
      await loadData();
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ فاتورة الشراء: ' + err.message);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteConfirmInvoice) return;
    try {
      await businessService.deletePurchaseInvoice(deleteConfirmInvoice.id);
      setDeleteConfirmInvoice(null);
      await loadData();
    } catch (err: any) {
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  const handleShareInvoice = async (invoice: PurchaseInvoice) => {
    const text = formatInvoiceShare(invoice, false);
    await shareContent(`فاتورة مشتريات ${invoice.invoiceNumber}`, text);
  };

  // Supplier Statement Handler
  const openSupplierStatement = async (supplier: Supplier) => {
    setStatementSupplier(supplier);
    const stmt = await businessService.getSupplierStatement(supplier.id);
    setStatementData(stmt);
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleSharePDFStatement = async () => {
    if (!statementSupplier || !statementData) return;
    setIsGeneratingPdf(true);
    try {
      const rows = statementData.movements.map((m: any) => ({
        description: m.title,
        date: m.date,
        amount: m.credit > 0 ? `+${formatNumber(m.credit)} (شراء)` : `-${formatNumber(m.debit)} (سداد/مرتجع)`,
        extra: `الرصيد: ${formatCurrency(m.runningBalance)}`,
      }));

      await generateAndShareStatementPDF({
        title: `كشف حساب مورد`,
        entityName: statementSupplier.name,
        subtitle: `هاتف: ${statementSupplier.phone} ${statementSupplier.address ? `• ${statementSupplier.address}` : ''}`,
        columns: ['البيان / الحركة', 'التاريخ', 'القيمة'],
        rows,
        totalLabel: 'الرصيد المستحق الحالي:',
        totalValue: formatCurrency(statementData.currentBalance),
        fileName: `supplier_statement_${statementSupplier.name}_${new Date().toISOString().split('T')[0]}`,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareStatement = async () => {
    if (!statementSupplier || !statementData) return;
    const text = formatSupplierStatementShare(
      statementSupplier.name,
      statementData.currentBalance,
      statementData.movements
    );
    await shareContent(`كشف حساب مورد ${statementSupplier.name}`, text);
  };

  // Supplier Payment/Transfer
  const handlePaySupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplier || !Number(payAmount)) {
      alert('يرجى كتابة مبلغ السداد');
      return;
    }

    await businessService.createTransfer({
      type: 'SUPPLIER',
      targetId: paySupplier.id,
      targetName: paySupplier.name,
      amount: Number(payAmount),
      date: new Date().toISOString().split('T')[0],
      description: payDescription,
      notes: payNotes,
    });

    setPaySupplier(null);
    setPayAmount('');
    setPayNotes('');
    await loadData();
    if (statementSupplier && statementSupplier.id === paySupplier.id) {
      await openSupplierStatement(paySupplier);
    }
  };

  // Supplier Add/Edit
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim() || !supPhone.trim()) {
      alert('يرجى كتابة اسم المورد ورقم الهاتف');
      return;
    }

    if (editingSupplier) {
      await businessService.updateSupplier(editingSupplier.id, {
        name: supName,
        phone: supPhone,
        address: supAddress,
        notes: supNotes,
      });
    } else {
      await businessService.createSupplier({
        name: supName,
        phone: supPhone,
        address: supAddress,
        notes: supNotes,
      });
    }

    setShowAddSupplierModal(false);
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupAddress('');
    setSupNotes('');
    await loadData();
  };

  const handleDeleteSupplier = async () => {
    if (!deleteConfirmSupplier) return;
    await businessService.deleteSupplier(deleteConfirmSupplier.id);
    setDeleteConfirmSupplier(null);
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
            <ShoppingBag className="w-4 h-4" />
            <span>فواتير المشتريات ({invoices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>الموردين ({suppliers.length})</span>
          </button>
        </div>

        {activeTab === 'invoices' ? (
          <button
            onClick={() => {
              if (suppliers.length === 0) {
                alert('يرجى إضافة مورد أولاً قبل إنشاء فاتورة مشتريات');
                setActiveTab('suppliers');
                setShowAddSupplierModal(true);
                return;
              }
              setSelectedSupplierId(suppliers[0]?.id || '');
              setShowAddInvoiceModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>فاتورة شراء جديدة</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setEditingSupplier(null);
              setSupName('');
              setSupPhone('');
              setSupAddress('');
              setSupNotes('');
              setShowAddSupplierModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مورد</span>
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
          placeholder={activeTab === 'invoices' ? 'بحث برقم فاتورة الشراء أو اسم المورد...' : 'بحث باسم المورد أو الهاتف...'}
          className="w-full ps-9 pe-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* PURCHASE INVOICES LIST */}
      {activeTab === 'invoices' && (
        <div className="space-y-2.5">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              لا توجد فواتير مشتريات مسجلة
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      المورد: {inv.supplierName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{inv.date}</span>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">إجمالي الكمية: </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{inv.quantity}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">الإجمالي: </span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400" dir="ltr">
                      {formatNumber(inv.total)} ج.م
                    </span>
                  </div>
                </div>

                {inv.notes && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    ملاحظات: {inv.notes}
                  </div>
                )}

                {/* Actions: View, Preview, Share, Delete */}
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setPreviewInvoice(inv)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>معاينة</span>
                  </button>
                  <button
                    onClick={() => handleShareInvoice(inv)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>مشاركة</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmInvoice(inv)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 transition cursor-pointer"
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

      {/* SUPPLIERS LIST */}
      {activeTab === 'suppliers' && (
        <div className="space-y-2.5">
          {filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              لا يوجد موردين مسجلين
            </div>
          ) : (
            filteredSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>{sup.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      الهاتف: {sup.phone} {sup.address ? `• العنوان: ${sup.address}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openSupplierStatement(sup)}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>كشف الحساب</span>
                    </button>
                    <button
                      onClick={() => setPaySupplier(sup)}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>سداد للمورد</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingSupplier(sup);
                        setSupName(sup.name);
                        setSupPhone(sup.phone);
                        setSupAddress(sup.address || '');
                        setSupNotes(sup.notes || '');
                        setShowAddSupplierModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => setDeleteConfirmSupplier(sup)}
                      className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ADD PURCHASE INVOICE MODAL */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl my-6 p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                <span>إنشاء فاتورة مشتريات جديدة</span>
              </h3>
              <button onClick={() => setShowAddInvoiceModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Supplier Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    المورد *
                  </label>
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

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    التاريخ *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                    required
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    الأصناف المشتراة
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صنف</span>
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
                            <option value="">-- اختر صنف موجود أو أكتب اسماً جديداً --</option>
                            {inventoryItems.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} (حالياً: {inv.quantity})
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
                        <label className="block text-[10px] text-slate-500 mb-0.5">سعر الشراء (ج.م)</label>
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
                          className="p-1.5 text-rose-500 hover:text-rose-700 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total calculations */}
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">إجمالي الكميات: </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{totalInvoiceQty}</span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">الإجمالي النهائي: </span>
                  <span className="font-black text-sm text-indigo-700 dark:text-indigo-300" dir="ltr">
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
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddInvoiceModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  حفظ الفاتورة وتحديث المخزن والحسابات
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
            <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm">معاينة فاتورة مشتريات</h3>
              <button onClick={() => setPreviewInvoice(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3 font-mono text-xs">
              <div className="text-center font-bold text-sm">=== Power H ===</div>
              <div className="text-center font-semibold text-indigo-600">فاتورة مشتريات: {previewInvoice.invoiceNumber}</div>
              <div className="flex justify-between border-b pb-1 border-slate-200 dark:border-slate-700">
                <span>التاريخ: {previewInvoice.date}</span>
                <span>المورد: {previewInvoice.supplierName}</span>
              </div>
              <div className="space-y-1">
                {previewInvoice.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {idx + 1}. {i.itemName} ({i.quantity} × {i.price})
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
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة الفاتورة</span>
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER STATEMENT MODAL */}
      {statementSupplier && statementData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl my-6 p-4 sm:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>كشف حساب المورد: {statementSupplier.name}</span>
                </h3>
                <p className="text-xs text-slate-500">رقم الهاتف: {statementSupplier.phone}</p>
              </div>
              <button onClick={() => setStatementSupplier(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Statement Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border">
                <div className="text-slate-500">إجمالي المشتريات</div>
                <div className="font-black text-indigo-600 dark:text-indigo-400 mt-1" dir="ltr">
                  {formatNumber(statementData.totalPurchases)} ج.م
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border">
                <div className="text-slate-500">إجمالي السدادات</div>
                <div className="font-black text-emerald-600 dark:text-emerald-400 mt-1" dir="ltr">
                  {formatNumber(statementData.totalPayments)} ج.م
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border">
                <div className="text-slate-500">إجمالي المرتجعات</div>
                <div className="font-black text-rose-600 dark:text-rose-400 mt-1" dir="ltr">
                  {formatNumber(statementData.totalReturns)} ج.م
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                <div className="text-blue-700 dark:text-blue-300 font-semibold">الرصيد المستحق الحالي</div>
                <div className="font-black text-sm text-blue-800 dark:text-blue-200 mt-1" dir="ltr">
                  {formatNumber(statementData.currentBalance)} ج.م
                </div>
              </div>
            </div>

            {/* Statement Movements Table */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">سجل حركات الحساب:</h4>
              {statementData.movements.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  لا توجد حركات مسجلة لهذا المورد
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-right divide-y divide-slate-200 dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2">التاريخ</th>
                        <th className="p-2">البيان</th>
                        <th className="p-2">سداد / مرتجع (-)</th>
                        <th className="p-2">مشتريات (+)</th>
                        <th className="p-2">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {statementData.movements.map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2 whitespace-nowrap text-slate-500">{m.date}</td>
                          <td className="p-2 font-medium">{m.title}</td>
                          <td className="p-2 font-semibold text-emerald-600" dir="ltr">
                            {m.debit > 0 ? `-${m.debit}` : '-'}
                          </td>
                          <td className="p-2 font-semibold text-indigo-600" dir="ltr">
                            {m.credit > 0 ? `+${m.credit}` : '-'}
                          </td>
                          <td className="p-2 font-bold" dir="ltr">
                            {formatNumber(m.runningBalance)} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setPaySupplier(statementSupplier)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>سداد دفعة جديدة</span>
              </button>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={handleSharePDFStatement}
                  disabled={isGeneratingPdf}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="مشاركة كشف الحساب بصيغة PDF عبر أندرويد"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{isGeneratingPdf ? 'جاري إنشاء PDF...' : 'مشاركة PDF'}</span>
                </button>
                <button
                  onClick={handleShareStatement}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة نصية</span>
                </button>
                <button
                  onClick={() => setStatementSupplier(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PAY SUPPLIER MODAL */}
      {paySupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <Send className="w-4 h-4 text-purple-600" />
                <span>سداد دفعة إلى المورد: {paySupplier.name}</span>
              </h3>
              <button onClick={() => setPaySupplier(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplierSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">المبلغ (ج.م) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">البيان / الوصف</label>
                <input
                  type="text"
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="رقم الحوالة أو السند..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-[11px]">
                سيتم خصم المبلغ من رصيد الخزينة النقدي، وخصم نفس القيمة من حساب المورد في كشف الحساب.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaySupplier(null)}
                  className="px-4 py-2 rounded-xl border text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs"
                >
                  تأكيد السداد والخصم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER ADD/EDIT MODAL */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm">
                {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">اسم المورد *</label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">رقم الهاتف *</label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">العنوان</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">ملاحظات</label>
                <input
                  type="text"
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                >
                  حفظ المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SUPPLIER CONFIRM */}
      {deleteConfirmSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="font-bold text-sm">تأكيد حذف المورد</h4>
            <p className="text-xs text-slate-500">
              هل أنت متأكد من حذف المورد {deleteConfirmSupplier.name}؟
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmSupplier(null)}
                className="flex-1 py-2 rounded-xl border text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteSupplier}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                حذف
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
            <h4 className="font-bold text-sm">تأكيد حذف فاتورة الشراء</h4>
            <p className="text-xs text-slate-500">
              هل أنت متأكد من حذف الفاتورة رقم {deleteConfirmInvoice.invoiceNumber}؟ سيتم خصم الكميات من المخزن وإلغاء القيمة من حساب المورد.
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
    </div>
  );
};
