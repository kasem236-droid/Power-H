export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

export type ConnectionState = 'connected' | 'disconnected';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface FakeCustomer {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  address?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  price: number; // Selling price
  costPrice?: number;
  quantity: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export type MovementType = 'PURCHASE' | 'SALE' | 'SALES_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT';

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: MovementType;
  quantity: number; // positive = added, negative = removed
  unitPrice: number;
  referenceId: string; // invoice or return id
  referenceType: 'sales_invoice' | 'purchase_invoice' | 'sales_return' | 'purchase_return' | 'manual';
  date: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface InvoiceItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  items: InvoiceItem[];
  quantity: number;
  price: number;
  total: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: InvoiceItem[];
  quantity: number;
  price: number;
  total: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  originalInvoiceId?: string;
  customerId: string;
  customerName: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  originalInvoiceId?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Deposit {
  id: string;
  amount: number;
  description: string;
  date: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export type TransferType = 'SUPPLIER' | 'MODI' | 'QASIM';

export interface Transfer {
  id: string;
  type: TransferType;
  targetId?: string; // Supplier ID if type === 'SUPPLIER'
  targetName: string; // Supplier Name, or 'مودي' or 'قاسم'
  amount: number;
  date: string;
  description: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export type TransactionType =
  | 'DEPOSIT'
  | 'EXPENSE'
  | 'TRANSFER_SUPPLIER'
  | 'TRANSFER_MODI'
  | 'TRANSFER_QASIM'
  | 'PURCHASE_PAYABLE'
  | 'PURCHASE_RETURN_ADJUST'
  | 'SALE_RECEIVABLE'
  | 'SALE_RETURN_ADJUST';

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  relatedEntityType?: 'supplier' | 'customer' | 'modi' | 'qasim' | 'treasury';
  relatedEntityId?: string;
  direction: 'IN' | 'OUT' | 'NEUTRAL'; // IN: adds to treasury, OUT: removes from treasury
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface OperationLog {
  id: string;
  timestamp: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC' | 'RETURN' | 'TRANSFER' | 'RESTORE' | 'CLEAR';
  entityType: string;
  entityId: string;
  details: string;
  deviceId?: string;
}

export interface SyncOperation {
  opId: string;
  collection: string;
  action: 'UPSERT' | 'DELETE';
  entity: any;
  timestamp: number;
  state: SyncState;
  retryCount: number;
  lastError?: string;
}

export interface AppStateData {
  customers: Customer[];
  suppliers: Supplier[];
  fakeCustomers: FakeCustomer[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  salesInvoices: SalesInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  salesReturns: SalesReturn[];
  purchaseReturns: PurchaseReturn[];
  deposits: Deposit[];
  expenses: Expense[];
  transfers: Transfer[];
  financialTransactions: FinancialTransaction[];
  operationLogs: OperationLog[];
}
