import React, { useState, useEffect } from 'react';
import { FakeCustomer } from '../types';
import { localDB } from '../services/db';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import { Search, UserCheck, Plus, Trash2, Edit, X, Phone, MapPin, AlertCircle, ShieldAlert } from 'lucide-react';

export const SearchView: React.FC = () => {
  const [fakeCustomers, setFakeCustomers] = useState<FakeCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<FakeCustomer | null>(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<FakeCustomer | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');

  const loadData = async () => {
    const list = await localDB.getAll<FakeCustomer>('fakeCustomers');
    list.sort((a, b) => b.createdAt - a.createdAt);
    setFakeCustomers(list);
  };

  useEffect(() => {
    loadData();
    const unsub = syncManager.subscribeData(loadData);
    return () => unsub();
  }, []);

  // Search Fake Customers by: Name, First phone number, Second phone number
  const filteredCustomers = fakeCustomers.filter((fc) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const matchName = fc.name.toLowerCase().includes(q);
    const matchPhone1 = fc.phone.toLowerCase().includes(q);
    const matchPhone2 = fc.phone2 ? fc.phone2.toLowerCase().includes(q) : false;
    const matchAddress = fc.address ? fc.address.toLowerCase().includes(q) : false;
    return matchName || matchPhone1 || matchPhone2 || matchAddress;
  });

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('يرجى إدخال اسم العميل ورقم الهاتف الرئيسي');
      return;
    }

    if (editingCustomer) {
      await businessService.updateFakeCustomer(editingCustomer.id, {
        name,
        phone,
        phone2,
        address,
      });
    } else {
      await businessService.createFakeCustomer({
        name,
        phone,
        phone2,
        address,
      });
    }

    setShowAddModal(false);
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setPhone2('');
    setAddress('');
    await loadData();
  };

  const handleDeleteCustomer = async () => {
    if (!deleteConfirmCustomer) return;
    await businessService.deleteFakeCustomer(deleteConfirmCustomer.id);
    setDeleteConfirmCustomer(null);
    await loadData();
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Informative Header Banner */}
      <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-600 text-white">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-teal-950 dark:text-teal-200">
              البحث: عملاء وهميون (Fake Customers)
            </h3>
            <p className="text-xs text-teal-700 dark:text-teal-400">
              كيان مستقل تماماً ومفصول كلياً عن عملاء المبيعات الحقيقيين
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setName('');
            setPhone('');
            setPhone2('');
            setAddress('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عميل وهمي</span>
        </button>
      </div>

      {/* Search Input: Name, First phone number, Second phone number */}
      <div className="relative">
        <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث بالاسم، أو برقم الهاتف الأول، أو الثاني..."
          className="w-full ps-9 pe-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
        />
      </div>

      {/* FAKE CUSTOMERS LIST */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>نتائج البحث ({filteredCustomers.length})</span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-teal-600 font-bold hover:underline">
              مسح البحث
            </button>
          )}
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا يوجد عملاء وهميون مسجلين حتى الآن'}
          </div>
        ) : (
          filteredCustomers.map((fc) => (
            <div
              key={fc.id}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-600" />
                  <span>{fc.name}</span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>الهاتف 1: {fc.phone}</span>
                  </span>
                  {fc.phone2 && (
                    <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400 font-medium">
                      <Phone className="w-3.5 h-3.5" />
                      <span>الهاتف 2: {fc.phone2}</span>
                    </span>
                  )}
                  {fc.address && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{fc.address}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setEditingCustomer(fc);
                    setName(fc.name);
                    setPhone(fc.phone);
                    setPhone2(fc.phone2 || '');
                    setAddress(fc.address || '');
                    setShowAddModal(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
                  title="تعديل"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirmCustomer(fc)}
                  className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm">
                {editingCustomer ? 'تعديل العميل الوهمي' : 'إضافة عميل وهمي جديد'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">الاسم (مطلوب) *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم العميل..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">رقم الهاتف الأول (مطلوب) *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxx"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">رقم الهاتف الثاني (اختياري)</label>
                <input
                  type="text"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                  placeholder="رقم إضافي اختياري..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">العنوان (اختياري)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="المدينة، الحي..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

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
                  className="px-5 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs"
                >
                  حفظ العميل الوهمي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirmCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center border border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="font-bold text-sm">تأكيد حذف العميل الوهمي</h4>
            <p className="text-xs text-slate-500">
              هل أنت متأكد من حذف ({deleteConfirmCustomer.name})؟
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
