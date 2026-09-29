import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = path.resolve(process.cwd(), 'cloud-database.json');

app.use(express.json({ limit: '50mb' }));

interface ServerDB {
  version: number;
  lastUpdated: number;
  data: {
    customers: any[];
    suppliers: any[];
    fakeCustomers: any[];
    inventoryItems: any[];
    inventoryMovements: any[];
    salesInvoices: any[];
    purchaseInvoices: any[];
    salesReturns: any[];
    purchaseReturns: any[];
    deposits: any[];
    expenses: any[];
    transfers: any[];
    financialTransactions: any[];
    operationLogs: any[];
  };
  processedOpIds: string[];
}

function getInitialDB(): ServerDB {
  return {
    version: 1,
    lastUpdated: Date.now(),
    data: {
      customers: [],
      suppliers: [],
      fakeCustomers: [],
      inventoryItems: [],
      inventoryMovements: [],
      salesInvoices: [],
      purchaseInvoices: [],
      salesReturns: [],
      purchaseReturns: [],
      deposits: [],
      expenses: [],
      transfers: [],
      financialTransactions: [],
      operationLogs: [],
    },
    processedOpIds: [],
  };
}

function loadDB(): ServerDB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading database file, initializing fresh:', err);
  }
  const initial = getInitialDB();
  saveDB(initial);
  return initial;
}

function saveDB(db: ServerDB) {
  try {
    db.lastUpdated = Date.now();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

let db = loadDB();

// Server-Sent Events subscribers for instant real-time synchronization between devices
interface SSEClient {
  id: string;
  res: express.Response;
  deviceId?: string;
}
let sseClients: SSEClient[] = [];

function broadcastChange(originDeviceId: string, eventType: string, payload: any) {
  const message = `data: ${JSON.stringify({ type: eventType, originDeviceId, timestamp: Date.now(), payload })}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(message);
    } catch {
      // Ignore write errors; dead clients will be cleaned up
    }
  });
}

// SSE endpoint for live updates
app.get('/api/sync/events', (req, res) => {
  const deviceId = (req.query.deviceId as string) || 'unknown';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const client: SSEClient = { id: clientId, res, deviceId };
  sseClients.push(client);

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, serverTime: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Sync pull endpoint
app.get('/api/sync/pull', (req, res) => {
  const since = parseInt((req.query.since as string) || '0', 10);
  const changes: Record<string, any[]> = {};

  const collections = Object.keys(db.data) as (keyof ServerDB['data'])[];
  for (const col of collections) {
    changes[col] = db.data[col].filter((item) => (item.updatedAt || 0) > since);
  }

  res.json({
    success: true,
    serverTime: Date.now(),
    changes,
    totalRecords: Object.values(db.data).reduce((acc, curr) => acc + curr.length, 0),
  });
});

// Sync push endpoint: idempotent batch merge
app.post('/api/sync/push', (req, res) => {
  const { deviceId, operations } = req.body;

  if (!Array.isArray(operations)) {
    return res.status(400).json({ success: false, error: 'operations array is required' });
  }

  const serverTime = Date.now();
  const syncedOpIds: string[] = [];
  let updatedAny = false;

  for (const op of operations) {
    const { opId, collection, action, entity } = op;
    if (!opId || !collection || !entity || !entity.id) {
      continue;
    }

    // Idempotency check: if operation ID was already processed, confirm without duplicating
    if (db.processedOpIds.includes(opId)) {
      syncedOpIds.push(opId);
      continue;
    }

    const colName = collection as keyof ServerDB['data'];
    if (!db.data[colName]) {
      db.data[colName] = [];
    }

    const existingIndex = db.data[colName].findIndex((item: any) => item.id === entity.id);

    if (action === 'DELETE') {
      // Tombstone soft delete for reliable multi-device sync
      const tombstone = {
        ...entity,
        deleted: true,
        updatedAt: serverTime,
        deletedAt: serverTime,
        deletedByDeviceId: deviceId,
      };

      if (existingIndex >= 0) {
        db.data[colName][existingIndex] = tombstone;
      } else {
        db.data[colName].push(tombstone);
      }
      updatedAny = true;
    } else {
      // Upsert / Merge logic: Last-Write-Wins based on updatedAt
      const updatedEntity = {
        ...entity,
        updatedAt: Math.max(entity.updatedAt || 0, serverTime),
        lastSyncDeviceId: deviceId,
      };

      if (existingIndex >= 0) {
        const existing = db.data[colName][existingIndex];
        // Only update if incoming is newer or equal
        if ((updatedEntity.updatedAt || 0) >= (existing.updatedAt || 0)) {
          db.data[colName][existingIndex] = updatedEntity;
          updatedAny = true;
        }
      } else {
        db.data[colName].push(updatedEntity);
        updatedAny = true;
      }
    }

    // Mark operation as processed
    db.processedOpIds.push(opId);
    if (db.processedOpIds.length > 5000) {
      db.processedOpIds = db.processedOpIds.slice(-5000);
    }
    syncedOpIds.push(opId);
  }

  if (updatedAny) {
    saveDB(db);
    broadcastChange(deviceId || 'unknown', 'REMOTE_UPDATE', { serverTime });
  }

  res.json({
    success: true,
    serverTime,
    syncedOpIds,
  });
});

// Status endpoint
app.get('/api/sync/status', (req, res) => {
  const counts: Record<string, number> = {};
  for (const [key, list] of Object.entries(db.data)) {
    counts[key] = list.filter((i) => !i.deleted).length;
  }
  res.json({
    success: true,
    serverTime: Date.now(),
    lastUpdated: db.lastUpdated,
    connectedDevices: sseClients.length,
    counts,
  });
});

// Backup export endpoint
app.get('/api/backup/export', (req, res) => {
  res.json({
    version: db.version,
    exportDate: new Date().toISOString(),
    appName: 'Power H',
    data: db.data,
  });
});

// Backup restore endpoint (safe merge by ID)
app.post('/api/backup/restore', (req, res) => {
  const backup = req.body;
  if (!backup || !backup.data) {
    return res.status(400).json({ success: false, error: 'Invalid backup structure' });
  }

  const collections = Object.keys(backup.data) as (keyof ServerDB['data'])[];
  let restoredCount = 0;

  for (const col of collections) {
    if (!Array.isArray(backup.data[col])) continue;
    if (!db.data[col]) db.data[col] = [];

    for (const item of backup.data[col]) {
      if (!item.id) continue;
      const existingIdx = db.data[col].findIndex((e: any) => e.id === item.id);
      if (existingIdx >= 0) {
        db.data[col][existingIdx] = { ...item, updatedAt: Date.now() };
      } else {
        db.data[col].push({ ...item, updatedAt: Date.now() });
      }
      restoredCount++;
    }
  }

  saveDB(db);
  broadcastChange('system', 'RESTORE_COMPLETE', { restoredCount });

  res.json({ success: true, restoredCount, serverTime: Date.now() });
});

// Clear Data endpoint protected with password '040236'
app.post('/api/data/clear', (req, res) => {
  const { password } = req.body;
  if (password !== '040236') {
    return res.status(403).json({ success: false, error: 'كلمة المرور غير صحيحة' });
  }

  db = getInitialDB();
  saveDB(db);
  broadcastChange('system', 'DATABASE_CLEARED', { timestamp: Date.now() });

  res.json({ success: true, message: 'تم تصفير قاعدة البيانات بنجاح' });
});

// Mount Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Power H Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
