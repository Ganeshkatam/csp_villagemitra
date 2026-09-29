const STORAGE_KEY = 'csp_offline_queue_v1';
const MAX_RETRIES = 5;
const STALE_SYNC_TIMEOUT_MS = 60000; // 1 minute

let memoryFallback = [];
let isFlushing = false;

function getStorage() {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        return globalThis.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
        return localStorage;
    }
    return null;
}

export const offlineQueue = {
    getQueue() {
        const storage = getStorage();
        if (!storage) return [...memoryFallback];

        try {
            const raw = storage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [...memoryFallback];
        }
    },

    saveQueue(queue) {
        const storage = getStorage();
        if (storage) {
            try {
                storage.setItem(STORAGE_KEY, JSON.stringify(queue));
                return;
            } catch (err) {
                console.error('Failed to save offline queue to storage:', err);
            }
        }
        memoryFallback = [...queue];
    },

    enqueue(item) {
        if (!item || !item.data) {
            throw new Error('Offline queue item must contain a data payload.');
        }

        const queue = this.getQueue();
        const incomingRefId = item.data?.reference_id;
        const incomingId = item.id;

        // Idempotency: Prevent duplicate submissions by reference_id or id
        const existingIdx = queue.findIndex(q => 
            (incomingRefId && q.data?.reference_id === incomingRefId) ||
            (incomingId && q.id === incomingId)
        );

        if (existingIdx !== -1) {
            // Already queued: update timestamp and return existing entry without duplicating
            const existing = queue[existingIdx];
            existing.data = { ...existing.data, ...item.data };
            if (existing.status === 'dead_letter') {
                existing.status = 'pending';
                existing.retryCount = 0;
            }
            this.saveQueue(queue);
            return existing;
        }

        const payload = {
            id: item.id || `offline-${item.type || 'gen'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: item.type || 'feedback',
            data: item.data,
            status: 'pending', // 'pending' | 'syncing' | 'dead_letter'
            retryCount: 0,
            enqueuedAt: new Date().toISOString(),
            lastAttemptAt: null,
            error: null
        };

        queue.push(payload);
        this.saveQueue(queue);
        return payload;
    },

    dequeue(id) {
        const queue = this.getQueue().filter(item => item.id !== id);
        this.saveQueue(queue);
    },

    getPendingItems(type = null) {
        return this.getQueue().filter(item => 
            item.status !== 'dead_letter' && (!type || item.type === type)
        );
    },

    getDeadLetterItems(type = null) {
        return this.getQueue().filter(item => 
            item.status === 'dead_letter' && (!type || item.type === type)
        );
    },

    getPendingCount(type = null) {
        return this.getPendingItems(type).length;
    },

    markSyncing(id) {
        const queue = this.getQueue();
        const item = queue.find(q => q.id === id);
        if (item) {
            item.status = 'syncing';
            item.lastAttemptAt = new Date().toISOString();
            this.saveQueue(queue);
        }
    },

    markFailed(id, errorMessage) {
        const queue = this.getQueue();
        const item = queue.find(q => q.id === id);
        if (item) {
            item.retryCount = (item.retryCount || 0) + 1;
            item.lastAttemptAt = new Date().toISOString();
            item.error = errorMessage || 'Upload failed';

            if (item.retryCount >= MAX_RETRIES) {
                item.status = 'dead_letter';
            } else {
                item.status = 'pending';
            }
            this.saveQueue(queue);
        }
    },

    retryDeadLetter(id) {
        const queue = this.getQueue();
        const item = queue.find(q => q.id === id);
        if (item) {
            item.status = 'pending';
            item.retryCount = 0;
            item.error = null;
            this.saveQueue(queue);
        }
    },

    recoverStaleSyncing(timeoutMs = STALE_SYNC_TIMEOUT_MS) {
        const queue = this.getQueue();
        const now = Date.now();
        let modified = false;

        for (const item of queue) {
            if (item.status === 'syncing' && item.lastAttemptAt) {
                const elapsed = now - new Date(item.lastAttemptAt).getTime();
                if (elapsed > timeoutMs) {
                    item.status = 'pending';
                    modified = true;
                }
            }
        }

        if (modified) {
            this.saveQueue(queue);
        }
    },

    async flushQueue(type, uploadFn) {
        if (typeof uploadFn !== 'function') {
            throw new Error('uploadFn must be an asynchronous function.');
        }

        if (isFlushing) {
            return {
                skipped: true,
                reason: 'sync_in_progress',
                pending: this.getPendingCount(type)
            };
        }

        isFlushing = true;
        let synced = 0;
        let failed = 0;
        let deadLettered = 0;

        try {
            this.recoverStaleSyncing();
            const pendingItems = this.getPendingItems(type);

            for (const item of pendingItems) {
                this.markSyncing(item.id);
                try {
                    await uploadFn(item.data);
                    this.dequeue(item.id);
                    synced++;
                } catch (err) {
                    failed++;
                    this.markFailed(item.id, err?.message || 'Synchronization failed');
                    // Check if it transitioned to dead letter
                    const refreshed = this.getQueue().find(q => q.id === item.id);
                    if (refreshed?.status === 'dead_letter') {
                        deadLettered++;
                    }
                }
            }

            return {
                synced,
                failed,
                deadLettered,
                remaining: this.getPendingCount(type)
            };
        } finally {
            isFlushing = false;
        }
    },

    clear() {
        memoryFallback = [];
        const storage = getStorage();
        if (storage) {
            try {
                storage.removeItem(STORAGE_KEY);
            } catch (err) {
                console.error('Failed to clear offline queue:', err);
            }
        }
    }
};

export default offlineQueue;
