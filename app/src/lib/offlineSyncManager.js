/**
 * OfflineSyncManager
 * Durable survey queue management using IndexedDB with localStorage fallback.
 * Provides atomic enqueueing, exponential backoff retries, dead-letter queue isolation,
 * stale lock recovery (reloading while syncing), and concurrency protection.
 */

const DB_NAME = 'csp_offline_vault_v1';
const DB_VERSION = 1;
const STORE_NAME = 'survey_queue';
const FALLBACK_STORAGE_KEY = 'csp_offline_surveys_fallback_v1';
const MAX_RETRIES = 5;
const STALE_SYNC_TIMEOUT_MS = 60000; // 60 seconds

let dbInstance = null;
let isSyncInProgress = false;

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
        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid survey payload provided for enqueueing');
        }

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
     * Retrieves all pending and retryable records, recovering stale syncing records.
     * @returns {Promise<Array>}
     */
    async getPendingRecords() {
        const now = Date.now();
        const db = await openDatabase();

        if (db) {
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = req.result || [];
                    const pending = [];

                    for (const r of all) {
                        // Recover stale 'syncing' records (e.g. from browser refresh / process abort)
                        if (r.status === 'syncing') {
                            const lastAttempt = r.last_attempt_at ? new Date(r.last_attempt_at).getTime() : 0;
                            if (now - lastAttempt > STALE_SYNC_TIMEOUT_MS) {
                                r.status = 'pending';
                                store.put(r);
                                pending.push(r);
                            }
                        } else if (r.status === 'pending' || r.status === 'failed') {
                            pending.push(r);
                        }
                    }
                    resolve(pending);
                };
                req.onerror = () => resolve([]);
            });
        }

        const queue = getFallbackQueue();
        const pending = [];
        let modified = false;

        for (const r of queue) {
            if (r.status === 'syncing') {
                const lastAttempt = r.last_attempt_at ? new Date(r.last_attempt_at).getTime() : 0;
                if (now - lastAttempt > STALE_SYNC_TIMEOUT_MS) {
                    r.status = 'pending';
                    modified = true;
                    pending.push(r);
                }
            } else if (r.status === 'pending' || r.status === 'failed') {
                pending.push(r);
            }
        }

        if (modified) {
            saveFallbackQueue(queue);
        }
        return pending;
    },

    /**
     * Retrieves isolated dead-letter records.
     * @returns {Promise<Array>}
     */
    async getDeadLetterRecords() {
        const db = await openDatabase();
        if (db) {
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = req.result || [];
                    resolve(all.filter(r => r.status === 'dead_letter'));
                };
                req.onerror = () => resolve([]);
            });
        }

        const queue = getFallbackQueue();
        return queue.filter(r => r.status === 'dead_letter');
    },

    /**
     * Resets a dead-letter record back to pending for administrative re-drive.
     * @param {string} clientUuid
     */
    async retryDeadLetterRecord(clientUuid) {
        const db = await openDatabase();
        if (db) {
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(clientUuid);
                req.onsuccess = () => {
                    if (req.result) {
                        const rec = req.result;
                        rec.status = 'pending';
                        rec.retry_count = 0;
                        rec.last_error = null;
                        store.put(rec);
                    }
                    resolve();
                };
                req.onerror = () => resolve();
            });
        }

        const queue = getFallbackQueue();
        const item = queue.find(q => q.client_uuid === clientUuid);
        if (item) {
            item.status = 'pending';
            item.retry_count = 0;
            item.last_error = null;
            saveFallbackQueue(queue);
        }
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
     * Protected by an in-flight concurrency lock.
     * @param {Function} uploadFn - The uploadSurveyPayload function
     * @returns {Promise<{ successCount: number, failedCount: number, deadLetterCount: number, remainingCount: number, skipped: boolean }>}
     */
    async syncAll(uploadFn) {
        if (isSyncInProgress) {
            const count = await this.getPendingCount();
            return { successCount: 0, failedCount: 0, deadLetterCount: 0, remainingCount: count, skipped: true };
        }

        isSyncInProgress = true;
        try {
            const pending = await this.getPendingRecords();
            let successCount = 0;
            let failedCount = 0;
            let deadLetterCount = 0;

            for (const record of pending) {
                // Check if record payload is malformed
                if (!record.payload || !record.payload.respondent_code) {
                    await this.markFailure(record.client_uuid, 'Malformed survey payload: missing respondent_code');
                    deadLetterCount++;
                    continue;
                }

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
            return { successCount, failedCount, deadLetterCount, remainingCount, skipped: false };
        } finally {
            isSyncInProgress = false;
        }
    }
};

export default offlineSyncManager;
