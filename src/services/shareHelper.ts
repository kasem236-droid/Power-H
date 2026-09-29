import { PurchaseInvoice, SalesInvoice } from '../types';

export async function shareContent(title: string, text: string): Promise<{ success: boolean; method: string }> {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
      });
      return { success: true, method: 'native' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'cancelled' };
      }
    }
  }

  // Fallback to Clipboard + WhatsApp
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch (e) {
    console.warn('Clipboard write failed:', e);
  }

  // Open WhatsApp with text
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
  return { success: true, method: 'whatsapp' };
}

export function formatInvoiceShare(invoice: SalesInvoice | PurchaseInvoice, isSale = true): string {
  const typeStr = isSale ? 'فاتورة مبيعات' : 'فاتورة مشتريات';
  const partyStr = isSale
    ? `العميل: ${(invoice as SalesInvoice).customerName}`
    : `المورد: ${(invoice as PurchaseInvoice).supplierName}`;

  let lines: string[] = [
    `=== Power H ===`,
    `📄 ${typeStr}`,
    `رقم الفاتورة: ${invoice.invoiceNumber}`,
    `التاريخ: ${invoice.date}`,
    partyStr,
    `--------------------------`,
    `الأصناف:`,
  ];

  invoice.items.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.itemName} | الكمية: ${item.quantity} × ${item.price} = ${item.total} ج.م`);
  });

  lines.push(`--------------------------`);
  lines.push(`إجمالي الكمية: ${invoice.quantity}`);
  lines.push(`الإجمالي النهائي: ${invoice.total} ج.م`);
  if (invoice.notes) {
    lines.push(`ملاحظات: ${invoice.notes}`);
  }
  lines.push(`\nتم الإصدار عبر نظام Power H`);

  return lines.join('\n');
}

export function formatSupplierStatementShare(supplierName: string, balance: number, movements: any[]): string {
  let lines: string[] = [
    `=== Power H ===`,
    `📋 كشف حساب مورد: ${supplierName}`,
    `التاريخ: ${new Date().toISOString().split('T')[0]}`,
    `--------------------------`,
    `الرصيد المستحق الحالي: ${balance} ج.م`,
    `--------------------------`,
    `آخر الحركات:`,
  ];

  movements.slice(-10).forEach((m, idx) => {
    const amountStr = m.credit ? `+${m.credit} (شراء)` : `-${m.debit} (سداد/مرتجع)`;
    lines.push(`${idx + 1}. [${m.date}] ${m.title} : ${amountStr} | رصيد: ${m.runningBalance} ج.م`);
  });

  lines.push(`\nتم الإصدار عبر نظام Power H`);
  return lines.join('\n');
}

export function formatSpecialAccountShare(name: string, total: number, movements: any[]): string {
  let lines: string[] = [
    `=== Power H ===`,
    `💼 كشف حساب: ${name}`,
    `التاريخ: ${new Date().toISOString().split('T')[0]}`,
    `--------------------------`,
    `إجمالي التحويلات: ${total} ج.م`,
    `--------------------------`,
    `سجل التحويلات:`,
  ];

  movements.forEach((m, idx) => {
    lines.push(`${idx + 1}. [${m.date}] مبلغ: ${m.amount} ج.م | ${m.title} ${m.notes ? `(${m.notes})` : ''}`);
  });

  lines.push(`\nتم الإصدار عبر نظام Power H`);
  return lines.join('\n');
}
