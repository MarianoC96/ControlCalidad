/**
 * IndexedDB Service for Temporal (Offline) Module
 * Stores products/parametros cache and offline registration records.
 */

const DB_NAME = 'TemporalDB';
const DB_VERSION = 2;
const PRODUCTS_STORE = 'products';
const RECORDS_STORE = 'offlineRecords';

export interface OfflineRecord {
    id?: number;
    formData: {
        loteInterno: string;
        loteProducto: string;
        guia: string;
        marca: string;
        cantidad: string;
        productoId: string;
        observacionesGenerales: string;
    };
    productoNombre: string;
    controles: {
        parametroNombre: string;
        rangoCompleto: string;
        valorControl: number | null;
        textoControl: string | null;
        parametroTipo: string;
        observacion: string;
        fueraDeRango: boolean;
        mensajeAlerta: string;
    }[];
    fotos: string[];           // base64 previews
    verificadoPor: string;
    userId: number | null;
    timestamp: string;         // ISO date
    synced: boolean;
    syncedAt?: string;
}

export interface CachedProduct {
    id: number;
    nombre: string;
    parametros?: unknown[];
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
                db.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains(RECORDS_STORE)) {
                const store = db.createObjectStore(RECORDS_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('synced', 'synced', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ─── Products Cache ──────────────────────────────────────

export async function cacheProducts(products: CachedProduct[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);

    // Clear old cache
    store.clear();

    for (const product of products) {
        store.put(product);
    }

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getCachedProducts(): Promise<CachedProduct[]> {
    const db = await openDB();
    const tx = db.transaction(PRODUCTS_STORE, 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ─── Offline Records ─────────────────────────────────────

export async function saveOfflineRecord(record: Omit<OfflineRecord, 'id'>): Promise<number> {
    const db = await openDB();
    const tx = db.transaction(RECORDS_STORE, 'readwrite');
    const store = tx.objectStore(RECORDS_STORE);

    return new Promise((resolve, reject) => {
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
    });
}

export async function getAllOfflineRecords(): Promise<OfflineRecord[]> {
    const db = await openDB();
    const tx = db.transaction(RECORDS_STORE, 'readonly');
    const store = tx.objectStore(RECORDS_STORE);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getPendingRecords(): Promise<OfflineRecord[]> {
    const db = await openDB();
    const tx = db.transaction(RECORDS_STORE, 'readonly');
    const store = tx.objectStore(RECORDS_STORE);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const all = request.result as OfflineRecord[];
            resolve(all.filter(r => !r.synced));
        };
        request.onerror = () => reject(request.error);
    });
}

export async function markRecordSynced(id: number): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(RECORDS_STORE, 'readwrite');
    const store = tx.objectStore(RECORDS_STORE);

    return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const record = getReq.result;
            if (record) {
                record.synced = true;
                record.syncedAt = new Date().toISOString();
                store.put(record);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

export async function deleteOfflineRecord(id: number): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(RECORDS_STORE, 'readwrite');
    const store = tx.objectStore(RECORDS_STORE);

    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function getPendingCount(): Promise<number> {
    const records = await getPendingRecords();
    return records.length;
}
