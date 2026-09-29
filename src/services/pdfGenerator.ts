import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { CURRENCY_SYMBOL, formatCurrency } from './formatters';

export interface PDFStatementRow {
  description: string;
  date: string;
  amount: number | string;
  extra?: string;
}

export interface PDFStatementOptions {
  title: string;
  subtitle?: string;
  entityName: string;
  dateStr?: string;
  columns?: string[];
  rows: PDFStatementRow[];
  totalLabel: string;
  totalValue: string | number;
  fileName?: string;
}

/**
 * Generates a clean, professional Arabic PDF statement and shares it
 * via Android's native file sharing system (navigator.share with files),
 * falling back to browser download if files sharing isn't supported.
 */
export async function generateAndShareStatementPDF(options: PDFStatementOptions): Promise<{
  success: boolean;
  method: 'shared' | 'downloaded' | 'cancelled';
  error?: string;
}> {
  try {
    // 1. Create temporary off-screen container for rendering
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '750px';
    container.style.padding = '35px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = "'Cairo', sans-serif";
    container.style.direction = 'rtl';
    container.style.boxSizing = 'border-box';
    container.style.zIndex = '-9999';

    const dateToday = options.dateStr || new Date().toISOString().split('T')[0];
    const columns = options.columns || ['البيان / السبب', 'التاريخ', 'المبلغ'];

    // Build HTML representation
    container.innerHTML = `
      <div style="border: 2px solid #2563eb; border-radius: 12px; padding: 25px; background: #ffffff;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="background: #2563eb; color: #ffffff; font-weight: 900; font-size: 18px; padding: 6px 12px; border-radius: 8px;">
                PH
              </div>
              <div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #1e293b;">Power H</h1>
                <p style="margin: 0; font-size: 11px; color: #64748b;">نظام إدارة الأعمال السحابية</p>
              </div>
            </div>
          </div>
          <div style="text-align: left; font-size: 12px; color: #64748b;">
            <div><strong>تاريخ الإصدار:</strong> ${dateToday}</div>
            <div style="color: #2563eb; font-weight: bold; margin-top: 3px;">وثيقة رسمية معتمدة</div>
          </div>
        </div>

        <!-- Title & Entity Name -->
        <div style="text-align: center; margin-bottom: 22px; background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 6px 0; font-size: 19px; font-weight: 800; color: #1e3a8a;">
            ${options.title}
          </h2>
          <div style="font-size: 14px; font-weight: 700; color: #334155;">
            الحساب: <span style="color: #2563eb;">${options.entityName}</span>
          </div>
          ${options.subtitle ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${options.subtitle}</div>` : ''}
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; text-align: right;">
          <thead>
            <tr style="background: #f1f5f9; color: #1e293b; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; font-weight: 700; width: 45%;">
                ${columns[0]}
              </th>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; font-weight: 700; width: 25%; text-align: center;">
                ${columns[1]}
              </th>
              <th style="padding: 10px 12px; border: 1px solid #cbd5e1; font-weight: 700; width: 30%; text-align: left;">
                ${columns[2]}
              </th>
            </tr>
          </thead>
          <tbody>
            ${
              options.rows.length === 0
                ? `<tr><td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8;">لا توجد حركات مسجلة</td></tr>`
                : options.rows
                    .map((row, index) => {
                      const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      const amtStr =
                        typeof row.amount === 'number'
                          ? formatCurrency(row.amount)
                          : `${row.amount} ${CURRENCY_SYMBOL}`;
                      return `
                        <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
                          <td style="padding: 9px 12px; border: 1px solid #e2e8f0; color: #1e293b; font-weight: 500;">
                            ${row.description}
                            ${row.extra ? `<div style="font-size: 10px; color: #64748b;">${row.extra}</div>` : ''}
                          </td>
                          <td style="padding: 9px 12px; border: 1px solid #e2e8f0; text-align: center; color: #475569;">
                            ${row.date}
                          </td>
                          <td style="padding: 9px 12px; border: 1px solid #e2e8f0; text-align: left; font-weight: 700; color: #0f172a;" dir="ltr">
                            ${amtStr}
                          </td>
                        </tr>
                      `;
                    })
                    .join('')
            }
          </tbody>
        </table>

        <!-- Total Box at the bottom -->
        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
          <span style="font-size: 14px; font-weight: 700; color: #1e3a8a;">
            ${options.totalLabel}
          </span>
          <span style="font-size: 18px; font-weight: 900; color: #1d4ed8;" dir="ltr">
            ${
              typeof options.totalValue === 'number'
                ? formatCurrency(options.totalValue)
                : `${options.totalValue}`
            }
          </span>
        </div>

        <!-- Footer Notice -->
        <div style="margin-top: 25px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b;">
          <span>تم توليد هذا الكشف عبر تطبيق Power H المعتمد لإدارة الأعمال.</span>
          <span>صفحة 1 من 1</span>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // 2. Render to high-DPI canvas (supporting modern oklch colors)
    const renderFn = typeof html2canvas === 'function' ? html2canvas : (html2canvas as any).default;
    const canvas = await renderFn(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    document.body.removeChild(container);

    // 3. Convert to PDF using jsPDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, pdf.internal.pageSize.getHeight()));
    const pdfBlob = pdf.output('blob');

    const cleanFileName = (options.fileName || `statement_${Date.now()}`).replace(/[^\w\u0600-\u06FF-]/g, '_');
    const fullFileName = `${cleanFileName}.pdf`;

    // 4. Android Native File Sharing (navigator.share with files)
    const pdfFile = new File([pdfBlob], fullFileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: options.title,
          text: `مرفق ${options.title} (${options.entityName}) بصيغة PDF من تطبيق Power H`,
        });
        return { success: true, method: 'shared' };
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          return { success: false, method: 'cancelled' };
        }
      }
    }

    // 5. Fallback: Automatically download the PDF file directly to device
    const downloadUrl = URL.createObjectURL(pdfBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = fullFileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

    return { success: true, method: 'downloaded' };
  } catch (error: any) {
    console.error('Error generating PDF statement:', error);
    return { success: false, method: 'downloaded', error: error.message };
  }
}
