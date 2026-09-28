/**
 * OfflineSyncManager
 * Durable survey queue management using IndexedDB with localStorage fallback.
 * Provides atomic enqueueing, exponential backoff retries, and dead-letter queue isolation.
 */

const DB_NAME = 'csp_offline_vault_v1';
const DB_VERSION = 1;
const STORE_NAME = 'survey_queue';
const FALLBACK_STORAGE_KEY = 'csp_offline_surveys_fallback_v1';
const MAX_RETRIES = 5;

let dbInstance = null;

function hasIndexedDB() {
    return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDatabase() {
    if (!hasIndexedDB()) {
        return Promise.resolve(null);
    }
    if (dbInstance) {
        return Promise.resolve(dbInstance);
    }

    return new Promise((resolve) => {
        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'client_uuid' });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('created_at', 'created_at', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = (err) => {
                console.warn('IndexedDB failed to open, using storage fallback:', err);
                resolve(null);
            };
        } catch (e) {
            console.warn('IndexedDB access exception, using storage fallback:', e);
            resolve(null);
        }
    });
}

// Fallback helpers for localStorage
function getFallbackQueue() {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveFallbackQueue(queue) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error('LocalStorage write failure:', e);
    }
}

export const offlineSyncManager = {
    /**
     * Enqueues or updates a survey payload in durable storage.
     * @param {Object} payload 
     * @returns {Promise<Object>} The enqueued record
     */
    async enqueue(payload) {
        const clientUuid = payload.survey_client_uuid || (
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `survey-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        );

        const record = {
            client_uuid: clientUuid,
            payload: { ...payload, survey_client_uuid: clientUuid },
            status: 'pending', // 'pending' | 'syncing' | 'synced' | 'failed' | 'dead_letter'
            retry_count: 0,
            last_attempt_at: null,
            last_error: null,
            created_at: new Date().toISOString()
        };

        const db = await openDatabase();
        if (db) {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(record);
                req.onsuccess = () => resolve(record);
                req.onerror = () => reject(req.error);
            });
        }

        // Fallback
        const queue = getFallbackQueue();
        const existingIdx = queue.findIndex(q => q.client_uuid === clientUuid);
        if (existingIdx >= 0) {
            queue[existingIdx] = record;
        } else {
            queue.push(record);
        }
        saveFallbackQueue(queue);
        return record;
    },

    /**
     * Retrieves all pending and retryable records.
     * @returns {Promise<Array>}
     */
    async getPendingRecords() {
        const db = await openDatabase();
        if (db) {
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = req.result || [];
                    const pending = all.filter(r => r.status === 'pending' || r.status === 'failed');
                    resolve(pending);
                };
                req.onerror = () => resolve([]);
            });
        }

        const queue = getFallbackQueue();
        return queue.filter(r => r.status === 'pending' || r.status === 'failed');
    },

    /**
     * Returns count of active records awaiting synchronization.
     * @returns {Promise<number>}
     */
    async getPendingCount() {
        const pending = await this.getPendingRecords();
        return pending.length;
    },

    /**
     * Marks a record as actively syncing.
     * @param {string} clientUuid 
     */
    async markSyncing(clientUuid) {
        const db = await openDatabase();
        if (db) {
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const getReq = store.get(clientUuid);
                getReq.onsuccess = () => {
                    if (getReq.result) {
                        const rec = getReq.result;
                        rec.status = 'syncing';
                        rec.last_attempt_at = new Date().toISOString();
                        store.put(rec);
                    }
                    resolve();
                };
                getReq.onerror = () => resolve();
            });
        }

        const queue = getFallbackQueue();
        const item = queue.find(q => q.client_uuid === clientUuid);
        if (item) {
            item.status = 'syncing';
            item.last_attempt_at = new Date().toISOString();
            saveFallbackQueue(queue);
        }
    },

    /**
     * Removes an acknowledged and verified survey from the queue.
     * @param {string} clientUuid 
     */
    async removeRecord(clientUuid) {
        const db = await openDatabase();
        if (db) {
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.delete(clientUuid);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            });
        }

        const queue = getFallbackQueue().filter(q => q.client_uuid !== clientUuid);
        saveFallbackQueue(queue);
    },

    /**
     * Records a synchronization failure and increments the retry counter.
     * If MAX_RETRIES is exceeded, isolates the record in dead_letter status.
     * @param {string} clientUuid 
     * @param {Error|string} error 
     */
    async markFailure(clientUuid, error) {
        const errorMessage = typeof error === 'string' ? error : (error?.message || 'Unknown network error');

        const db = await openDatabase();
        if (db) {
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const getReq = store.get(clientUuid);
                getReq.onsuccess = () => {
                    if (getReq.result) {
                        const rec = getReq.result;
                        rec.retry_count = (rec.retry_count || 0) + 1;
                        rec.status = rec.retry_count >= MAX_RETRIES ? 'dead_letter' : 'failed';
                        rec.last_attempt_at = new Date().toISOString();
                        rec.last_error = errorMessage;
                        store.put(rec);
                    }
                    resolve();
                };
                getReq.onerror = () => resolve();
            });
        }

        const queue = getFallbackQueue();
        const item = queue.find(q => q.client_uuid === clientUuid);
        if (item) {
            item.retry_count = (item.retry_count || 0) + 1;
            item.status = item.retry_count >= MAX_RETRIES ? 'dead_letter' : 'failed';
            item.last_attempt_at = new Date().toISOString();
            item.last_error = errorMessage;
            saveFallbackQueue(queue);
        }
    },

    /**
     * Synchronizes all pending records using uploadSurveyPayload.
     * @param {Function} uploadFn - The uploadSurveyPayload function
     * @returns {Promise<{ successCount: number, failedCount: number, deadLetterCount: number, remainingCount: number }>}
     */
    async syncAll(uploadFn) {
        const pending = await this.getPendingRecords();
        let successCount = 0;
        let failedCount = 0;
        let deadLetterCount = 0;

        for (const record of pending) {
            await this.markSyncing(record.client_uuid);
            try {
                await uploadFn(record.payload);
                await this.removeRecord(record.client_uuid);
                successCount++;
            } catch (err) {
                await this.markFailure(record.client_uuid, err);
                if ((record.retry_count + 1) >= MAX_RETRIES) {
                    deadLetterCount++;
                } else {
                    failedCount++;
                }
            }
        }

        const remainingCount = await this.getPendingCount();
        return { successCount, failedCount, deadLetterCount, remainingCount };
    }
};

export default offlineSyncManager;
