import React, { useState, useEffect } from 'react';
import { InventoryItem, InventoryMovement } from '../types';
import { localDB } from '../services/db';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit,
  History,
  AlertCircle,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'items' | 'movements'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InventoryItem | null>(null);
  const [viewItemMovements, setViewItemMovements] = useState<InventoryItem | null>(null);

  // Form fields
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');

  const loadData = async () => {
    const invItems = await localDB.getAll<InventoryItem>('inventoryItems');
    invItems.sort((a, b) => b.createdAt - a.createdAt);
    setItems(invItems);

    const movs = await localDB.getAll<InventoryMovement>('inventoryMovements');
    movs.sort((a, b) => b.createdAt - a.createdAt);
    setMovements(movs);
  };

  useEffect(() => {
    loadData();
    const unsub = syncManager.subscribeData(loadData);
    return () => unsub();
  }, []);

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMovements = movements.filter(
    (m) =>
      m.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      alert('يرجى إدخال اسم الصنف');
      return;
    }

    if (editingItem) {
      await businessService.updateInventoryItem(editingItem.id, {
        name: itemName,
        price: Number(itemPrice) || 0,
      });
    } else {
      await businessService.createInventoryItem({
        name: itemName,
        price: Number(itemPrice) || 0,
        initialQuantity: Number(itemQuantity) || 0,
      });
    }

    setShowAddModal(false);
    setEditingItem(null);
    setItemName('');
    setItemPrice('');
    setItemQuantity('');
    await loadData();
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    await businessService.deleteInventoryItem(deleteConfirmItem.id);
    setDeleteConfirmItem(null);
    await loadData();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeTab === 'items'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>الأصناف المخزنية ({items.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeTab === 'movements'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل الحركات ({movements.length})</span>
          </button>
        </div>

        <button
          onClick={() => {
            setEditingItem(null);
            setItemName('');
            setItemPrice('');
            setItemQuantity('0');
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة صنف</span>
        </button>
      </div>

      {/* Quick Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === 'items' ? 'بحث سريع عن صنف...' : 'بحث في حركات المخزن...'}
          className="w-full ps-9 pe-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
      </div>

      {/* ITEMS LIST */}
      {activeTab === 'items' && (
        <div className="space-y-2.5">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              لا توجد أصناف مسجلة في المخزن
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{item.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-0.5">
                    <span>
                      السعر:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">{item.price} ج.م</strong>
                    </span>
                    <span>
                      الكمية المتوفرة:{' '}
                      <strong
                        className={`font-black ${
                          item.quantity <= 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {item.quantity}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewItemMovements(item)}
                    className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition cursor-pointer"
                    title="عرض حركات الصنف"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setItemName(item.name);
                      setItemPrice(String(item.price));
                      setItemQuantity(String(item.quantity));
                      setShowAddModal(true);
                    }}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
                    title="تعديل الصنف"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmItem(item)}
                    className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                    title="حذف الصنف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MOVEMENTS LIST */}
      {activeTab === 'movements' && (
        <div className="space-y-2">
          {filteredMovements.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              لا توجد حركات مخزنية مسجلة
            </div>
          ) : (
            filteredMovements.map((mov) => {
              const isPositive = mov.quantity > 0;
              return (
                <div
                  key={mov.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        isPositive
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{mov.itemName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {mov.notes} • التاريخ: {mov.date}
                      </div>
                    </div>
                  </div>

                  <div className="text-left">
                    <span
                      className={`font-black text-sm ${
                        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                      dir="ltr"
                    >
                      {isPositive ? `+${mov.quantity}` : `${mov.quantity}`}
                    </span>
                    <div className="text-[10px] text-slate-400">{mov.type}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ITEM MOVEMENTS MODAL */}
      {viewItemMovements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm">حركات الصنف: {viewItemMovements.name}</h3>
              <button onClick={() => setViewItemMovements(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {movements
                .filter((m) => m.itemId === viewItemMovements.id)
                .map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-semibold">{m.notes}</span>
                      <div className="text-[10px] text-slate-400">{m.date}</div>
                    </div>
                    <span
                      className={`font-black ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                      dir="ltr"
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`}
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewItemMovements(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT ITEM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm">
                {editingItem ? 'تعديل الصنف' : 'إضافة صنف جديد إلى المخزن'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">اسم الصنف *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="مثال: شاحن سريع، كابل بيانات..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">سعر البيع (ج.م) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              {!editingItem && (
                <div>
                  <label className="block font-semibold mb-1">الرصيد الافتتاحي (الكمية الأولية)</label>
                  <input
                    type="number"
                    min="0"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="font-bold text-sm">تأكيد حذف الصنف</h4>
            <p className="text-xs text-slate-500">
              هل أنت متأكد من حذف الصنف ({deleteConfirmItem.name}) من المخزن؟
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2 rounded-xl border text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteItem}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                حذف الصنف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
