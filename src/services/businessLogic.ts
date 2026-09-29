import { apiUrl } from './api';
import {
  Customer,
  Deposit,
  Expense,
  FakeCustomer,
  FinancialTransaction,
  InventoryItem,
  InventoryMovement,
  InvoiceItem,
  OperationLog,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
  Supplier,
  Transfer,
  TransferType,
} from '../types';
import { localDB, StoreName } from './db';
import { syncManager } from './syncManager';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// Generate human-friendly invoice numbers: e.g. S-1001, P-1001, RS-1001, RP-1001
export async function getNextNumber(prefix: string, store: StoreName): Promise<string> {
  const items = await localDB.getAll<any>(store, true);
  const count = items.length + 1;
  const pad = String(count).padStart(4, '0');
  return `${prefix}-${pad}`;
}

export class BusinessService {
  // ----------------------------------------------------
  // LOGGING HELPER
  // ----------------------------------------------------
  private async logOperation(
    action: OperationLog['action'],
    entityType: string,
    entityId: string,
    details: string
  ) {
    const log: OperationLog = {
      id: generateUUID(),
      timestamp: Date.now(),
      action,
      entityType,
      entityId,
      details,
      deviceId: syncManager.getDeviceId(),
    };
    await localDB.put('operationLogs', log);
    await syncManager.queueOperation('operationLogs', 'UPSERT', log);
  }

  // ----------------------------------------------------
  // TREASURY CALCULATIONS
  // Cash Balance = Deposits - Expenses - Outgoing Transfers
  // ----------------------------------------------------
  async getTreasurySummary() {
    const deposits = await localDB.getAll<Deposit>('deposits');
    const expenses = await localDB.getAll<Expense>('expenses');
    const transfers = await localDB.getAll<Transfer>('transfers');

    const totalDeposits = deposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalTransfers = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const cashBalance = totalDeposits - totalExpenses - totalTransfers;

    return {
      cashBalance,
      totalDeposits,
      totalExpenses,
      totalTransfers,
    };
  }

  // ----------------------------------------------------
  // DEPOSITS (إيداعات الخزينة)
  // ----------------------------------------------------
  async createDeposit(data: { amount: number; description: string; date: string; notes?: string }): Promise<Deposit> {
    const deposit: Deposit = {
      id: generateUUID(),
      amount: Number(data.amount) || 0,
      description: data.description.trim(),
      date: data.date,
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    // Financial Transaction
    const finTx: FinancialTransaction = {
      id: generateUUID(),
      type: 'DEPOSIT',
      amount: deposit.amount,
      date: deposit.date,
      description: `إيداع نقدي: ${deposit.description}`,
      relatedEntityType: 'treasury',
      relatedEntityId: deposit.id,
      direction: 'IN',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('deposits', deposit);
    await localDB.put('financialTransactions', finTx);

    await syncManager.queueOperation('deposits', 'UPSERT', deposit);
    await syncManager.queueOperation('financialTransactions', 'UPSERT', finTx);
    await this.logOperation('CREATE', 'deposit', deposit.id, `إيداع مبلغ ${deposit.amount} - ${deposit.description}`);

    return deposit;
  }

  async deleteDeposit(id: string): Promise<void> {
    const deposit = await localDB.getById<Deposit>('deposits', id);
    if (!deposit) return;

    deposit.deleted = true;
    deposit.updatedAt = Date.now();
    await localDB.put('deposits', deposit);
    await syncManager.queueOperation('deposits', 'DELETE', deposit);

    // Soft delete associated financial transaction
    const finTxs = await localDB.getAll<FinancialTransaction>('financialTransactions');
    const matched = finTxs.find((f) => f.relatedEntityId === id);
    if (matched) {
      matched.deleted = true;
      matched.updatedAt = Date.now();
      await localDB.put('financialTransactions', matched);
      await syncManager.queueOperation('financialTransactions', 'DELETE', matched);
    }

    await this.logOperation('DELETE', 'deposit', id, `حذف إيداع بمبلغ ${deposit.amount}`);
  }

  // ----------------------------------------------------
  // EXPENSES (مصروفات الخزينة)
  // ----------------------------------------------------
  async createExpense(data: { description: string; amount: number; date: string; notes?: string }): Promise<Expense> {
    const expense: Expense = {
      id: generateUUID(),
      description: data.description.trim(),
      amount: Number(data.amount) || 0,
      date: data.date,
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    // Financial Transaction
    const finTx: FinancialTransaction = {
      id: generateUUID(),
      type: 'EXPENSE',
      amount: expense.amount,
      date: expense.date,
      description: `مصروف: ${expense.description}`,
      relatedEntityType: 'treasury',
      relatedEntityId: expense.id,
      direction: 'OUT',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('expenses', expense);
    await localDB.put('financialTransactions', finTx);

    await syncManager.queueOperation('expenses', 'UPSERT', expense);
    await syncManager.queueOperation('financialTransactions', 'UPSERT', finTx);
    await this.logOperation('CREATE', 'expense', expense.id, `تسجيل مصروف ${expense.amount} - ${expense.description}`);

    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    const expense = await localDB.getById<Expense>('expenses', id);
    if (!expense) return;

    expense.deleted = true;
    expense.updatedAt = Date.now();
    await localDB.put('expenses', expense);
    await syncManager.queueOperation('expenses', 'DELETE', expense);

    const finTxs = await localDB.getAll<FinancialTransaction>('financialTransactions');
    const matched = finTxs.find((f) => f.relatedEntityId === id);
    if (matched) {
      matched.deleted = true;
      matched.updatedAt = Date.now();
      await localDB.put('financialTransactions', matched);
      await syncManager.queueOperation('financialTransactions', 'DELETE', matched);
    }

    await this.logOperation('DELETE', 'expense', id, `حذف مصروف بمبلغ ${expense.amount}`);
  }

  // ----------------------------------------------------
  // TRANSFERS (تحويلات الخزينة: موردين / مودي / قاسم)
  // ----------------------------------------------------
  async createTransfer(data: {
    type: TransferType;
    targetId?: string;
    targetName: string;
    amount: number;
    date: string;
    description: string;
    notes?: string;
  }): Promise<Transfer> {
    const transfer: Transfer = {
      id: generateUUID(),
      type: data.type,
      targetId: data.targetId,
      targetName: data.targetName.trim(),
      amount: Number(data.amount) || 0,
      date: data.date,
      description: data.description.trim(),
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    const finTxType =
      data.type === 'SUPPLIER'
        ? 'TRANSFER_SUPPLIER'
        : data.type === 'MODI'
        ? 'TRANSFER_MODI'
        : 'TRANSFER_QASIM';

    const relatedType =
      data.type === 'SUPPLIER' ? 'supplier' : data.type === 'MODI' ? 'modi' : 'qasim';

    const finTx: FinancialTransaction = {
      id: generateUUID(),
      type: finTxType,
      amount: transfer.amount,
      date: transfer.date,
      description: `تحويل إلى ${transfer.targetName}: ${transfer.description}`,
      relatedEntityType: relatedType,
      relatedEntityId: data.type === 'SUPPLIER' ? data.targetId : transfer.id,
      direction: 'OUT',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('transfers', transfer);
    await localDB.put('financialTransactions', finTx);

    await syncManager.queueOperation('transfers', 'UPSERT', transfer);
    await syncManager.queueOperation('financialTransactions', 'UPSERT', finTx);
    await this.logOperation('TRANSFER', 'transfer', transfer.id, `تحويل ${transfer.amount} إلى ${transfer.targetName}`);

    return transfer;
  }

  async deleteTransfer(id: string): Promise<void> {
    const transfer = await localDB.getById<Transfer>('transfers', id);
    if (!transfer) return;

    transfer.deleted = true;
    transfer.updatedAt = Date.now();
    await localDB.put('transfers', transfer);
    await syncManager.queueOperation('transfers', 'DELETE', transfer);

    const finTxs = await localDB.getAll<FinancialTransaction>('financialTransactions');
    const matched = finTxs.find((f) => f.relatedEntityId === id || (transfer.targetId && f.relatedEntityId === transfer.targetId && f.amount === transfer.amount && f.date === transfer.date));
    if (matched) {
      matched.deleted = true;
      matched.updatedAt = Date.now();
      await localDB.put('financialTransactions', matched);
      await syncManager.queueOperation('financialTransactions', 'DELETE', matched);
    }

    await this.logOperation('DELETE', 'transfer', id, `حذف تحويل إلى ${transfer.targetName}`);
  }

  // ----------------------------------------------------
  // INVENTORY ITEMS & MOVEMENTS
  // ----------------------------------------------------
  async createInventoryItem(data: { name: string; price: number; initialQuantity?: number }): Promise<InventoryItem> {
    const item: InventoryItem = {
      id: generateUUID(),
      name: data.name.trim(),
      price: Number(data.price) || 0,
      quantity: Number(data.initialQuantity) || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('inventoryItems', item);
    await syncManager.queueOperation('inventoryItems', 'UPSERT', item);

    if (item.quantity > 0) {
      const movement: InventoryMovement = {
        id: generateUUID(),
        itemId: item.id,
        itemName: item.name,
        type: 'ADJUSTMENT',
        quantity: item.quantity,
        unitPrice: item.price,
        referenceId: item.id,
        referenceType: 'manual',
        date: new Date().toISOString().split('T')[0],
        notes: 'رصيد افتتاحي',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false,
      };
      await localDB.put('inventoryMovements', movement);
      await syncManager.queueOperation('inventoryMovements', 'UPSERT', movement);
    }

    await this.logOperation('CREATE', 'inventoryItem', item.id, `إضافة صنف جديد: ${item.name} بسعر ${item.price}`);
    return item;
  }

  async updateInventoryItem(id: string, data: Partial<InventoryItem>): Promise<InventoryItem | null> {
    const item = await localDB.getById<InventoryItem>('inventoryItems', id);
    if (!item) return null;

    Object.assign(item, data, { updatedAt: Date.now() });
    await localDB.put('inventoryItems', item);
    await syncManager.queueOperation('inventoryItems', 'UPSERT', item);
    await this.logOperation('UPDATE', 'inventoryItem', item.id, `تعديل صنف: ${item.name}`);
    return item;
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const item = await localDB.getById<InventoryItem>('inventoryItems', id);
    if (!item) return;

    item.deleted = true;
    item.updatedAt = Date.now();
    await localDB.put('inventoryItems', item);
    await syncManager.queueOperation('inventoryItems', 'DELETE', item);
    await this.logOperation('DELETE', 'inventoryItem', id, `حذف صنف: ${item.name}`);
  }

  // ----------------------------------------------------
  // SALES INVOICES (فواتير المبيعات)
  // When saved:
  // - Inventory decreases by item quantities
  // - Creates inventory movements (type: 'SALE', negative quantity)
  // - Creates financial transaction
  // ----------------------------------------------------
  async createSalesInvoice(data: {
    customerId: string;
    customerName: string;
    date: string;
    items: InvoiceItem[];
    notes?: string;
  }): Promise<SalesInvoice> {
    const invoiceNumber = await getNextNumber('INV-S', 'salesInvoices');
    const totalQty = data.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const grandTotal = data.items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const avgPrice = totalQty > 0 ? grandTotal / totalQty : 0;

    const invoice: SalesInvoice = {
      id: generateUUID(),
      invoiceNumber,
      customerId: data.customerId,
      customerName: data.customerName.trim(),
      date: data.date,
      items: data.items,
      quantity: totalQty,
      price: avgPrice,
      total: grandTotal,
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('salesInvoices', invoice);
    await syncManager.queueOperation('salesInvoices', 'UPSERT', invoice);

    // Apply inventory deductions and record movements
    for (const item of data.items) {
      const invItem = await localDB.getById<InventoryItem>('inventoryItems', item.itemId);
      if (invItem) {
        invItem.quantity = (Number(invItem.quantity) || 0) - Number(item.quantity);
        invItem.updatedAt = Date.now();
        await localDB.put('inventoryItems', invItem);
        await syncManager.queueOperation('inventoryItems', 'UPSERT', invItem);
      }

      const movement: InventoryMovement = {
        id: generateUUID(),
        itemId: item.itemId,
        itemName: item.itemName,
        type: 'SALE',
        quantity: -Math.abs(Number(item.quantity)),
        unitPrice: Number(item.price),
        referenceId: invoice.id,
        referenceType: 'sales_invoice',
        date: invoice.date,
        notes: `فاتورة مبيعات ${invoice.invoiceNumber}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false,
      };
      await localDB.put('inventoryMovements', movement);
      await syncManager.queueOperation('inventoryMovements', 'UPSERT', movement);
    }

    // Financial Transaction
    const finTx: FinancialTransaction = {
      id: generateUUID(),
      type: 'SALE_RECEIVABLE',
      amount: invoice.total,
      date: invoice.date,
      description: `فاتورة مبيعات ${invoice.invoiceNumber} للعميل ${invoice.customerName}`,
      relatedEntityType: 'customer',
      relatedEntityId: invoice.customerId,
      direction: 'NEUTRAL', // Accounts receivable tracking
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await localDB.put('financialTransactions', finTx);
    await syncManager.queueOperation('financialTransactions', 'UPSERT', finTx);

    await this.logOperation('CREATE', 'salesInvoice', invoice.id, `إنشاء فاتورة مبيعات ${invoice.invoiceNumber} بقيمة ${invoice.total}`);
    return invoice;
  }

  async deleteSalesInvoice(id: string): Promise<void> {
    const invoice = await localDB.getById<SalesInvoice>('salesInvoices', id);
    if (!invoice) return;

    invoice.deleted = true;
    invoice.updatedAt = Date.now();
    await localDB.put('salesInvoices', invoice);
    await syncManager.queueOperation('salesInvoices', 'DELETE', invoice);

    // Revert inventory deductions
    for (const item of invoice.items) {
      const invItem = await localDB.getById<InventoryItem>('inventoryItems', item.itemId);
      if (invItem) {
        invItem.quantity = (Number(invItem.quantity) || 0) + Number(item.quantity);
        invItem.updatedAt = Date.now();
        await localDB.put('inventoryItems', invItem);
        await syncManager.queueOperation('inventoryItems', 'UPSERT', invItem);
      }
    }

    // Soft delete movements
    const movements = await localDB.getAll<InventoryMovement>('inventoryMovements');
    for (const m of movements.filter((m) => m.referenceId === id)) {
      m.deleted = true;
      m.updatedAt = Date.now();
      await localDB.put('inventoryMovements', m);
      await syncManager.queueOperation('inventoryMovements', 'DELETE', m);
    }

    // Soft delete financial transaction
    const finTxs = await localDB.getAll<FinancialTransaction>('financialTransactions');
    const matched = finTxs.find((f) => f.description.includes(invoice.invoiceNumber));
    if (matched) {
      matched.deleted = true;
      matched.updatedAt = Date.now();
      await localDB.put('financialTransactions', matched);
      await syncManager.queueOperation('financialTransactions', 'DELETE', matched);
    }

    await this.logOperation('DELETE', 'salesInvoice', id, `حذف فاتورة مبيعات ${invoice.invoiceNumber}`);
  }

  // ----------------------------------------------------
  // PURCHASE INVOICES (فواتير المشتريات)
  // When saved:
  // - Increase inventory quantities
  // - Create appropriate inventory movement
  // - Increase supplier's account according to purchase value
  // - Record financial effect safely
  // - Applied exactly once during synchronization
  // ----------------------------------------------------
  async createPurchaseInvoice(data: {
    supplierId: string;
    supplierName: string;
    date: string;
    items: InvoiceItem[];
    notes?: string;
  }): Promise<PurchaseInvoice> {
    const invoiceNumber = await getNextNumber('INV-P', 'purchaseInvoices');
    const totalQty = data.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const grandTotal = data.items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const avgPrice = totalQty > 0 ? grandTotal / totalQty : 0;

    const invoice: PurchaseInvoice = {
      id: generateUUID(),
      invoiceNumber,
      supplierId: data.supplierId,
      supplierName: data.supplierName.trim(),
      date: data.date,
      items: data.items,
      quantity: totalQty,
      price: avgPrice,
      total: grandTotal,
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('purchaseInvoices', invoice);
    await syncManager.queueOperation('purchaseInvoices', 'UPSERT', invoice);

    // 1. Increase inventory quantities and create movements
    for (const item of data.items) {
      let invItem = await localDB.getById<InventoryItem>('inventoryItems', item.itemId);
      if (!invItem) {
        // Automatically create item if not existing
        invItem = {
          id: item.itemId || generateUUID(),
          name: item.itemName,
          price: Number(item.price) * 1.25, // default markup selling price
          quantity: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deleted: false,
        };
      }
      invItem.quantity = (Number(invItem.quantity) || 0) + Number(item.quantity);
      invItem.updatedAt = Date.now();
      await localDB.put('inventoryItems', invItem);
      await syncManager.queueOperation('inventoryItems', 'UPSERT', invItem);

      const movement: InventoryMovement = {
        id: generateUUID(),
        itemId: invItem.id,
        itemName: invItem.name,
        type: 'PURCHASE',
        quantity: Math.abs(Number(item.quantity)),
        unitPrice: Number(item.price),
        referenceId: invoice.id,
        referenceType: 'purchase_invoice',
        date: invoice.date,
        notes: `فاتورة مشتريات ${invoice.invoiceNumber}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false,
      };
      await localDB.put('inventoryMovements', movement);
      await syncManager.queueOperation('inventoryMovements', 'UPSERT', movement);
    }

    // 2. Increase supplier's account according to purchase value
    const finTx: FinancialTransaction = {
      id: generateUUID(),
      type: 'PURCHASE_PAYABLE',
      amount: invoice.total,
      date: invoice.date,
      description: `فاتورة مشتريات ${invoice.invoiceNumber} من المورد ${invoice.supplierName}`,
      relatedEntityType: 'supplier',
      relatedEntityId: invoice.supplierId,
      direction: 'NEUTRAL',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await localDB.put('financialTransactions', finTx);
    await syncManager.queueOperation('financialTransactions', 'UPSERT', finTx);

    await this.logOperation('CREATE', 'purchaseInvoice', invoice.id, `فاتورة مشتريات ${invoice.invoiceNumber} من ${invoice.supplierName} بمبلغ ${invoice.total}`);
    return invoice;
  }

  async deletePurchaseInvoice(id: string): Promise<void> {
    const invoice = await localDB.getById<PurchaseInvoice>('purchaseInvoices', id);
    if (!invoice) return;

    invoice.deleted = true;
    invoice.updatedAt = Date.now();
    await localDB.put('purchaseInvoices', invoice);
    await syncManager.queueOperation('purchaseInvoices', 'DELETE', invoice);

    // Revert inventory increase
    for (const item of invoice.items) {
      const invItem = await localDB.getById<InventoryItem>('inventoryItems', item.itemId);
      if (invItem) {
        invItem.quantity = (Number(invItem.quantity) || 0) - Number(item.quantity);
        invItem.updatedAt = Date.now();
        await localDB.put('inventoryItems', invItem);
        await syncManager.queueOperation('inventoryItems', 'UPSERT', invItem);
      }
    }

    // Soft delete movements
    const movements = await localDB.getAll<InventoryMovement>('inventoryMovements');
    for (const m of movements.filter((m) => m.referenceId === id)) {
      m.deleted = true;
      m.updatedAt = Date.now();
      await localDB.put('inventoryMovements', m);
      await syncManager.queueOperation('inventoryMovements', 'DELETE', m);
    }

    // Soft delete financial transaction
    const finTxs = await localDB.getAll<FinancialTransaction>('financialTransactions');
    const matched = finTxs.find((f) => f.description.includes(invoice.invoiceNumber));
    if (matched) {
      matched.deleted = true;
      matched.updatedAt = Date.now();
      await localDB.put('financialTransactions', matched);
      await syncManager.queueOperation('financialTransactions', 'DELETE', matched);
    }

    await this.logOperation('DELETE', 'purchaseInvoice', id, `حذف فاتورة مشتريات ${invoice.invoiceNumber}`);
  }

  // ----------------------------------------------------
  // RETURNS (المرتجعات: مبيعات ومشتريات)
  // ----------------------------------------------------
  // Sales Return:
  // - Increase inventory by returned quantity (+qty)
  // - Record sales return transaction
  // - Adjust customer account
  // ----------------------------------------------------
  async createSalesReturn(data: {
    customerId: string;
    customerName: string;
    originalInvoiceId?: string;
    date: string;
    items: InvoiceItem[];
    notes?: string;
  }): Promise<SalesReturn> {
    const returnNumber = await getNextNumber('RET-S', 'salesReturns');
    const totalAmount = data.items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

    const salesReturn: SalesReturn = {
      id: generateUUID(),
      returnNumber,
      originalInvoiceId: data.originalInvoiceId,
      customerId: data.customerId,
      customerName: data.customerName.trim(),
      date: data.date,
      items: data.items,
      total: totalAmount,
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('salesReturns', salesReturn);
    await syncManager.queueOperation('salesReturns', 'UPSERT', salesReturn);

    // Increase inventory and record return movement
    for (const item of data.items) {
      const invItem = await localDB.getById<InventoryItem>('inventoryItems', item.itemId);
      if (invItem) {
        invItem.quantity = (Number(invItem.quantity) || 0) + Number(item.quantity);
        invItem.updatedAt = Date.now();
        await localDB.put('inventoryItems', invItem);
        await syncManager.queueOperation('inventoryItems', 'UPSERT', invItem);
      }

      const movement: InventoryMovement = {
        id: generateUUID(),
        itemId: item.itemId,
        itemName: item.itemName,
        type: 'SALES_RETURN',
        quantity: Math.abs(Number(item.quantity)),
        unitPrice: Number(item.price),
        referenceId: salesReturn.id,
        referenceType: 'sales_return',
        date: salesReturn.date,
        notes: `مرتجع مبيعات ${salesReturn.returnNumber}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false,
      };
      await localDB.put('inventoryMovements', movement);
      await syncManager.queueOperation('inventoryMovements', 'UPSERT', movement);
    }

    // Financial movement
    const finTx: FinancialTransaction = {
      id: generateUUID(),
      type: 'SALE_RETURN_ADJUST',
      amount: totalAmount,
      date: salesReturn.date,
      description: `تسوية مرتجع مبيعات ${salesReturn.returnNumber} للعميل ${salesReturn.customerName}`,
      relatedEntityType: 'customer',
      relatedEntityId: salesReturn.customerId,
      direction: 'NEUTRAL',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await localDB.put('financialTransactions', finTx);
    await syncManager.queueOperation('financialTransactions', 'UPSERT', finTx);

    await this.logOperation('RETURN', 'salesReturn', salesReturn.id, `مرتجع مبيعات ${salesReturn.returnNumber} بقيمة ${salesReturn.total}`);
    return salesReturn;
  }

  // Purchase Return:
  // - Decrease inventory by returned quantity (-qty)
  // - Record purchase return transaction
  // - Reduce supplier's account
  // ----------------------------------------------------
  async createPurchaseReturn(data: {
    supplierId: string;
    supplierName: string;
    originalInvoiceId?: string;
    date: string;
    items: InvoiceItem[];
    notes?: string;
  }): Promise<PurchaseReturn> {
    const returnNumber = await getNextNumber('RET-P', 'purchaseReturns');
    const totalAmount = data.items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

    const purchaseReturn: PurchaseReturn = {
      id: generateUUID(),
      returnNumber,
      originalInvoiceId: data.originalInvoiceId,
      supplierId: data.supplierId,
      supplierName: data.supplierName.trim(),
      date: data.date,
      items: data.items,
      total: totalAmount,
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };

    await localDB.put('purchaseReturns', purchaseReturn);
    await syncManager.queueOperation('purchaseReturns', 'UPSERT', purchaseReturn);

    // Decrease inventory and record return movement
    for (const item of data.items) {
      const invItem = await localDB.getById<InventoryItem>('inventoryItems', item.itemId);
      if (invItem) {
        invItem.quantity = (Number(invItem.quantity) || 0) - Number(item.quantity);
        invItem.updatedAt = Date.now();
        await localDB.put('inventoryItems', invItem);
        await syncManager.queueOperation('inventoryItems', 'UPSERT', invItem);
      }

      const movement: InventoryMovement = {
        id: generateUUID(),
        itemId: item.itemId,
        itemName: item.itemName,
        type: 'PURCHASE_RETURN',
        quantity: -Math.abs(Number(item.quantity)),
        unitPrice: Number(item.price),
        referenceId: purchaseReturn.id,
        referenceType: 'purchase_return',
        date: purchaseReturn.date,
        notes: `مرتجع مشتريات ${purchaseReturn.returnNumber}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deleted: false,
      };
      await localDB.put('inventoryMovements', movement);
      await syncManager.queueOperation('inventoryMovements', 'UPSERT', movement);
    }

    // Reduce supplier's account
    const finTx: FinancialTransaction = {
      id: generateUUID(),
      type: 'PURCHASE_RETURN_ADJUST',
      amount: totalAmount,
      date: purchaseReturn.date,
      description: `خصم مرتجع مشتريات ${purchaseReturn.returnNumber} من حساب المورد ${purchaseReturn.supplierName}`,
      relatedEntityType: 'supplier',
      relatedEntityId: purchaseReturn.supplierId,
      direction: 'NEUTRAL',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await localDB.put('financialTransactions', finTx);
    await syncManager.queueOperation('financialTransactions', 'UPSERT', finTx);

    await this.logOperation('RETURN', 'purchaseReturn', purchaseReturn.id, `مرتجع مشتريات ${purchaseReturn.returnNumber} للمورد ${purchaseReturn.supplierName} بقيمة ${purchaseReturn.total}`);
    return purchaseReturn;
  }

  // ----------------------------------------------------
  // SUPPLIER ACCOUNTS (كشف حساب الموردين)
  // Balance owed to supplier = Purchases - Payments/Transfers - Purchase Returns
  // ----------------------------------------------------
  async getSupplierStatement(supplierId: string) {
    const supplier = await localDB.getById<Supplier>('suppliers', supplierId);
    const purchases = (await localDB.getAll<PurchaseInvoice>('purchaseInvoices')).filter((p) => p.supplierId === supplierId);
    const transfers = (await localDB.getAll<Transfer>('transfers')).filter((t) => t.type === 'SUPPLIER' && t.targetId === supplierId);
    const returns = (await localDB.getAll<PurchaseReturn>('purchaseReturns')).filter((r) => r.supplierId === supplierId);

    const movements: Array<{
      id: string;
      date: string;
      type: 'PURCHASE' | 'TRANSFER' | 'RETURN';
      title: string;
      debit: number; // Payments / Returns (reduces owed)
      credit: number; // Purchases (increases owed)
      runningBalance: number;
    }> = [];

    // Combine all events
    purchases.forEach((p) => {
      movements.push({
        id: p.id,
        date: p.date,
        type: 'PURCHASE',
        title: `فاتورة شراء ${p.invoiceNumber}`,
        debit: 0,
        credit: p.total,
        runningBalance: 0,
      });
    });

    transfers.forEach((t) => {
      movements.push({
        id: t.id,
        date: t.date,
        type: 'TRANSFER',
        title: `دفعة / سداد: ${t.description || 'تحويل مالي'}`,
        debit: t.amount,
        credit: 0,
        runningBalance: 0,
      });
    });

    returns.forEach((r) => {
      movements.push({
        id: r.id,
        date: r.date,
        type: 'RETURN',
        title: `مرتجع مشتريات ${r.returnNumber}`,
        debit: r.total,
        credit: 0,
        runningBalance: 0,
      });
    });

    movements.sort((a, b) => (a.date > b.date ? 1 : -1));

    let balance = 0;
    movements.forEach((m) => {
      balance += m.credit - m.debit;
      m.runningBalance = balance;
    });

    const totalPurchases = purchases.reduce((s, p) => s + p.total, 0);
    const totalPayments = transfers.reduce((s, t) => s + t.amount, 0);
    const totalReturns = returns.reduce((s, r) => s + r.total, 0);

    return {
      supplier,
      movements,
      totalPurchases,
      totalPayments,
      totalReturns,
      currentBalance: balance, // positive = we owe supplier, negative = supplier owes us
    };
  }

  // ----------------------------------------------------
  // CUSTOMER ACCOUNTS (كشف حساب العملاء)
  // Balance customer owes = Sales - Sales Returns
  // ----------------------------------------------------
  async getCustomerStatement(customerId: string) {
    const customer = await localDB.getById<Customer>('customers', customerId);
    const sales = (await localDB.getAll<SalesInvoice>('salesInvoices')).filter((s) => s.customerId === customerId);
    const returns = (await localDB.getAll<SalesReturn>('salesReturns')).filter((r) => r.customerId === customerId);

    const movements: Array<{
      id: string;
      date: string;
      type: 'SALE' | 'RETURN';
      title: string;
      debit: number; // Sales (increases receivable)
      credit: number; // Returns (reduces receivable)
      runningBalance: number;
    }> = [];

    sales.forEach((s) => {
      movements.push({
        id: s.id,
        date: s.date,
        type: 'SALE',
        title: `فاتورة مبيعات ${s.invoiceNumber}`,
        debit: s.total,
        credit: 0,
        runningBalance: 0,
      });
    });

    returns.forEach((r) => {
      movements.push({
        id: r.id,
        date: r.date,
        type: 'RETURN',
        title: `مرتجع مبيعات ${r.returnNumber}`,
        debit: 0,
        credit: r.total,
        runningBalance: 0,
      });
    });

    movements.sort((a, b) => (a.date > b.date ? 1 : -1));

    let balance = 0;
    movements.forEach((m) => {
      balance += m.debit - m.credit;
      m.runningBalance = balance;
    });

    const totalSales = sales.reduce((s, inv) => s + inv.total, 0);
    const totalReturns = returns.reduce((s, ret) => s + ret.total, 0);

    return {
      customer,
      movements,
      totalSales,
      totalReturns,
      currentBalance: balance,
    };
  }

  // ----------------------------------------------------
  // INDEPENDENT ACCOUNTS (حساب مودي & حساب قاسم)
  // Completely independent from suppliers!
  // ----------------------------------------------------
  async getSpecialAccountStatement(type: 'MODI' | 'QASIM') {
    const name = type === 'MODI' ? 'مودي' : 'قاسم';
    const transfers = (await localDB.getAll<Transfer>('transfers')).filter((t) => t.type === type);

    const movements = transfers.map((t) => ({
      id: t.id,
      date: t.date,
      type: 'TRANSFER',
      title: `تحويل نقدي: ${t.description || 'دفعة'}`,
      amount: t.amount,
      notes: t.notes,
    }));

    movements.sort((a, b) => (a.date > b.date ? 1 : -1));
    const totalAmount = movements.reduce((s, m) => s + m.amount, 0);

    return {
      accountName: name,
      accountType: type,
      totalTransfers: totalAmount,
      transactionCount: movements.length,
      movements,
    };
  }

  // ----------------------------------------------------
  // ENTITY CRUD: Customers, Suppliers, Fake Customers
  // ----------------------------------------------------
  async createCustomer(data: { name: string; phone: string; address?: string; notes?: string }): Promise<Customer> {
    const customer: Customer = {
      id: generateUUID(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || '',
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await localDB.put('customers', customer);
    await syncManager.queueOperation('customers', 'UPSERT', customer);
    await this.logOperation('CREATE', 'customer', customer.id, `إضافة عميل: ${customer.name}`);
    return customer;
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer | null> {
    const customer = await localDB.getById<Customer>('customers', id);
    if (!customer) return null;
    Object.assign(customer, data, { updatedAt: Date.now() });
    await localDB.put('customers', customer);
    await syncManager.queueOperation('customers', 'UPSERT', customer);
    await this.logOperation('UPDATE', 'customer', customer.id, `تعديل بيانات عميل: ${customer.name}`);
    return customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    const customer = await localDB.getById<Customer>('customers', id);
    if (!customer) return;
    customer.deleted = true;
    customer.updatedAt = Date.now();
    await localDB.put('customers', customer);
    await syncManager.queueOperation('customers', 'DELETE', customer);
    await this.logOperation('DELETE', 'customer', id, `حذف عميل: ${customer.name}`);
  }

  async createSupplier(data: { name: string; phone: string; address?: string; notes?: string }): Promise<Supplier> {
    const supplier: Supplier = {
      id: generateUUID(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || '',
      notes: data.notes?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await localDB.put('suppliers', supplier);
    await syncManager.queueOperation('suppliers', 'UPSERT', supplier);
    await this.logOperation('CREATE', 'supplier', supplier.id, `إضافة مورد: ${supplier.name}`);
    return supplier;
  }

  async updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier | null> {
    const supplier = await localDB.getById<Supplier>('suppliers', id);
    if (!supplier) return null;
    Object.assign(supplier, data, { updatedAt: Date.now() });
    await localDB.put('suppliers', supplier);
    await syncManager.queueOperation('suppliers', 'UPSERT', supplier);
    await this.logOperation('UPDATE', 'supplier', supplier.id, `تعديل بيانات مورد: ${supplier.name}`);
    return supplier;
  }

  async deleteSupplier(id: string): Promise<void> {
    const supplier = await localDB.getById<Supplier>('suppliers', id);
    if (!supplier) return;
    supplier.deleted = true;
    supplier.updatedAt = Date.now();
    await localDB.put('suppliers', supplier);
    await syncManager.queueOperation('suppliers', 'DELETE', supplier);
    await this.logOperation('DELETE', 'supplier', id, `حذف مورد: ${supplier.name}`);
  }

  // FAKE CUSTOMERS (عملاء وهميون - Completely separate from Sales Customers)
  async createFakeCustomer(data: { name: string; phone: string; phone2?: string; address?: string }): Promise<FakeCustomer> {
    const fakeCustomer: FakeCustomer = {
      id: generateUUID(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      phone2: data.phone2?.trim() || '',
      address: data.address?.trim() || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await localDB.put('fakeCustomers', fakeCustomer);
    await syncManager.queueOperation('fakeCustomers', 'UPSERT', fakeCustomer);
    await this.logOperation('CREATE', 'fakeCustomer', fakeCustomer.id, `إضافة عميل وهمي: ${fakeCustomer.name}`);
    return fakeCustomer;
  }

  async updateFakeCustomer(id: string, data: Partial<FakeCustomer>): Promise<FakeCustomer | null> {
    const fakeCustomer = await localDB.getById<FakeCustomer>('fakeCustomers', id);
    if (!fakeCustomer) return null;
    Object.assign(fakeCustomer, data, { updatedAt: Date.now() });
    await localDB.put('fakeCustomers', fakeCustomer);
    await syncManager.queueOperation('fakeCustomers', 'UPSERT', fakeCustomer);
    await this.logOperation('UPDATE', 'fakeCustomer', fakeCustomer.id, `تعديل عميل وهمي: ${fakeCustomer.name}`);
    return fakeCustomer;
  }

  async deleteFakeCustomer(id: string): Promise<void> {
    const fakeCustomer = await localDB.getById<FakeCustomer>('fakeCustomers', id);
    if (!fakeCustomer) return;
    fakeCustomer.deleted = true;
    fakeCustomer.updatedAt = Date.now();
    await localDB.put('fakeCustomers', fakeCustomer);
    await syncManager.queueOperation('fakeCustomers', 'DELETE', fakeCustomer);
    await this.logOperation('DELETE', 'fakeCustomer', id, `حذف عميل وهمي: ${fakeCustomer.name}`);
  }

  // ----------------------------------------------------
  // CLEAR DATA (Password 040236)
  // ----------------------------------------------------
  async clearAllDataWithPassword(password: string): Promise<boolean> {
    if (password !== '040236') {
      throw new Error('رمز الأمان غير صحيح');
    }

    // 1. Clear local IndexedDB stores
    await localDB.clearAllData();

    // 2. Clear server cloud database
    try {
      await fetch(apiUrl('/api/data/clear') , {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch (e) {
      console.warn('Server clear notice:', e);
    }

    await this.logOperation('CLEAR', 'system', 'all', 'تم تصفير جميع البيانات بنجاح باستخدام رمز الأمان');
    await syncManager.triggerSync();
    return true;
  }
}

export const businessService = new BusinessService();
