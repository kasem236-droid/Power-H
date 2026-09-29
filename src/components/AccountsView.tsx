import React, { useState, useEffect } from 'react';
import { businessService } from '../services/businessLogic';
import { syncManager } from '../services/syncManager';
import { formatSpecialAccountShare, shareContent } from '../services/shareHelper';
import { generateAndShareStatementPDF } from '../services/pdfGenerator';
import { formatCurrency } from '../services/formatters';
import { Users2, User, Share2, FileDown, FileText, ArrowRightLeft } from 'lucide-react';

export const AccountsView: React.FC = () => {
  const [activeAccount, setActiveAccount] = useState<'MODI' | 'QASIM'>('MODI');
  const [modiData, setModiData] = useState<any>(null);
  const [qasimData, setQasimData] = useState<any>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const loadAccounts = async () => {
    const modi = await businessService.getSpecialAccountStatement('MODI');
    setModiData(modi);

    const qasim = await businessService.getSpecialAccountStatement('QASIM');
    setQasimData(qasim);
  };

  useEffect(() => {
    loadAccounts();
    const unsub = syncManager.subscribeData(loadAccounts);
    return () => unsub();
  }, []);

  const currentData = activeAccount === 'MODI' ? modiData : qasimData;
  const currentName = activeAccount === 'MODI' ? 'مودي' : 'قاسم';
  const statementTitle = activeAccount === 'MODI' ? 'كشف حساب مودي' : 'كشف حساب قاسم';

  // Calculate total strictly from the actual recorded transactions
  const totalAmount = currentData?.movements
    ? currentData.movements.reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0)
    : 0;

  // Share as Native PDF file
  const handleSharePDF = async () => {
    if (!currentData) return;
    setIsGeneratingPdf(true);
    try {
      const rows = currentData.movements.map((m: any) => ({
        description: m.title || 'تحويل مالي',
        date: m.date,
        amount: m.amount,
        extra: m.notes ? `ملاحظات: ${m.notes}` : undefined,
      }));

      await generateAndShareStatementPDF({
        title: statementTitle,
        entityName: currentName,
        columns: ['البيان / السبب', 'التاريخ', 'المبلغ'],
        rows,
        totalLabel: 'إجمالي التحويلات:',
        totalValue: totalAmount,
        fileName: `statement_${activeAccount.toLowerCase()}_${new Date().toISOString().split('T')[0]}`,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Share text fallback
  const handleShareText = async () => {
    if (!currentData) return;
    const text = formatSpecialAccountShare(currentName, totalAmount, currentData.movements);
    await shareContent(`كشف حساب ${currentName}`, text);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Informative Header Banner */}
      <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-600 text-white">
            <Users2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-purple-950 dark:text-purple-200">قسم الحسابات المستقلة</h3>
            <p className="text-xs text-purple-700 dark:text-purple-400">
              حساب مودي وحساب قاسم مستقلان تماماً وليسا موردين
            </p>
          </div>
        </div>
      </div>

      {/* Account Switcher: Modi vs Qasim */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveAccount('MODI')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeAccount === 'MODI'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>1. حساب مودي (Modi Account)</span>
        </button>

        <button
          onClick={() => setActiveAccount('QASIM')}
          className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeAccount === 'QASIM'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>2. حساب قاسم (Qasim Account)</span>
        </button>
      </div>

      {/* Account Statement Container */}
      {currentData && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          {/* Top Bar inside the Account: Title + Dedicated Sharing Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>{statementTitle}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                كشف حركات التحويلات المالية المسجلة لحساب {currentName}
              </p>
            </div>

            {/* Sharing actions inside THIS specific account */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSharePDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm shadow-purple-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                title="توليد ومشاركة كشف الحساب بصيغة PDF عبر أندرويد"
              >
                <FileDown className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'جاري إنشاء PDF...' : 'مشاركة PDF'}</span>
              </button>

              <button
                onClick={handleShareText}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition active:scale-95 cursor-pointer"
                title="مشاركة نصية سريعة"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة نصية</span>
              </button>
            </div>
          </div>

          {/* Clean, simple transaction statement table: Description | Date | Amount */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-right divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-3 w-1/2">البيان / السبب (Description / Reason)</th>
                  <th className="p-3 text-center w-1/4">التاريخ (Date)</th>
                  <th className="p-3 text-left w-1/4">المبلغ (Amount)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                {currentData.movements.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      لا توجد تحويلات مسجلة لـ {currentName} حتى الآن.
                      <div className="text-[11px] text-slate-500 mt-1">
                        (يمكنك إجراء تحويل جديد من قسم الخزينة &gt; التحويلات &gt; تحويل لـ {currentName})
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentData.movements.map((m: any, idx: number) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3 text-slate-900 dark:text-slate-100 font-medium">
                        <div>{m.title}</div>
                        {m.notes && <div className="text-[10px] text-slate-400 mt-0.5">{m.notes}</div>}
                      </td>
                      <td className="p-3 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {m.date}
                      </td>
                      <td className="p-3 text-left font-black text-purple-700 dark:text-purple-300 whitespace-nowrap" dir="ltr">
                        {formatCurrency(m.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Total Transfers Display */}
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/70 flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-200">
              إجمالي التحويلات (Total Transfers):
            </span>
            <span className="text-base sm:text-lg font-black text-purple-700 dark:text-purple-300" dir="ltr">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
