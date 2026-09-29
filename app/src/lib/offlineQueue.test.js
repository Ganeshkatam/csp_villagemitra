import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineQueue } from './offlineQueue.js';

// Setup global localStorage mock for Node environment if not present
if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
}

test.beforeEach(() => {
    globalThis.localStorage.clear();
    offlineQueue.clear();
});

test('offlineQueue enqueues feedback and assigns tracking metadata', () => {
    const payload = {
        type: 'feedback',
        data: {
            reference_id: 'VM-FB-2026-99999',
            message: 'Road repairs needed near primary school.'
        }
    };

    const item = offlineQueue.enqueue(payload);
    assert.ok(item.id, 'Expected queue item ID to be generated');
    assert.strictEqual(item.status, 'pending');
    assert.strictEqual(item.retryCount, 0);
    assert.strictEqual(offlineQueue.getPendingCount('feedback'), 1);
});

test('offlineQueue prevents duplicate enqueuing with identical reference_id', () => {
    const payload1 = {
        type: 'feedback',
        data: {
            reference_id: 'VM-FB-2026-11111',
            message: 'Original message text here.'
        }
    };

    const payload2 = {
        type: 'feedback',
        data: {
            reference_id: 'VM-FB-2026-11111',
            message: 'Updated message text.'
        }
    };

    offlineQueue.enqueue(payload1);
    offlineQueue.enqueue(payload2);

    assert.strictEqual(offlineQueue.getPendingCount('feedback'), 1, 'Queue must not contain duplicates with same reference_id');
    const items = offlineQueue.getPendingItems('feedback');
    assert.strictEqual(items[0].data.message, 'Updated message text.');
});

test('offlineQueue transitions to dead_letter after 5 consecutive failures', async () => {
    offlineQueue.enqueue({
        type: 'feedback',
        data: { reference_id: 'VM-FB-2026-FAIL1', message: 'Failing record test.' }
    });

    const failingUpload = async () => {
        throw new Error('Database connection refused');
    };

    // Attempt 5 flushes
    for (let i = 0; i < 5; i++) {
        await offlineQueue.flushQueue('feedback', failingUpload);
    }

    assert.strictEqual(offlineQueue.getPendingCount('feedback'), 0, 'No records should remain pending after 5 failures');
    const deadLetters = offlineQueue.getDeadLetterItems('feedback');
    assert.strictEqual(deadLetters.length, 1);
    assert.strictEqual(deadLetters[0].status, 'dead_letter');
    assert.strictEqual(deadLetters[0].retryCount, 5);

    // Redrive dead letter
    offlineQueue.retryDeadLetter(deadLetters[0].id);
    assert.strictEqual(offlineQueue.getPendingCount('feedback'), 1);
});

test('offlineQueue recovers stale syncing items after timeout', () => {
    const item = offlineQueue.enqueue({
        type: 'feedback',
        data: { reference_id: 'VM-FB-2026-STALE', message: 'Stale lock test.' }
    });

    offlineQueue.markSyncing(item.id);
    assert.strictEqual(offlineQueue.getPendingItems('feedback')[0].status, 'syncing');

    // Simulate stale lastAttemptAt older than 60 seconds
    const queue = offlineQueue.getQueue();
    queue[0].lastAttemptAt = new Date(Date.now() - 120000).toISOString();
    offlineQueue.saveQueue(queue);

    offlineQueue.recoverStaleSyncing(60000);
    assert.strictEqual(offlineQueue.getPendingItems('feedback')[0].status, 'pending');
});

test('offlineQueue flushes successfully and removes synchronized items', async () => {
    offlineQueue.enqueue({
        type: 'feedback',
        data: { reference_id: 'VM-FB-2026-SYNC1', message: 'First feedback message.' }
    });
    offlineQueue.enqueue({
        type: 'feedback',
        data: { reference_id: 'VM-FB-2026-SYNC2', message: 'Second feedback message.' }
    });

    assert.strictEqual(offlineQueue.getPendingCount('feedback'), 2);

    const uploaded = [];
    const mockUpload = async (data) => {
        uploaded.push(data.reference_id);
    };

    const res = await offlineQueue.flushQueue('feedback', mockUpload);
    assert.strictEqual(res.synced, 2);
    assert.strictEqual(res.failed, 0);
    assert.strictEqual(offlineQueue.getPendingCount('feedback'), 0);
    assert.deepStrictEqual(uploaded, ['VM-FB-2026-SYNC1', 'VM-FB-2026-SYNC2']);
});
