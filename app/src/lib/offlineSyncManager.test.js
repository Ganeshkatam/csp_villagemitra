import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineSyncManager } from './offlineSyncManager.js';

// Setup global localStorage mock for Node environment
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
});

test('offlineSyncManager enqueues survey record and assigns client_uuid', async () => {
    const payload = {
        respondent_code: 'HH-101',
        interviewer_name: 'Tester',
        answers: [{ question_code: 'D1', answer_value: '26-40' }]
    };

    const record = await offlineSyncManager.enqueue(payload);
    assert.ok(record.client_uuid, 'Expected client_uuid to be assigned');
    assert.strictEqual(record.status, 'pending');
    assert.strictEqual(record.retry_count, 0);

    const count = await offlineSyncManager.getPendingCount();
    assert.strictEqual(count, 1);
});

test('offlineSyncManager updates existing record idempotently if same client_uuid is re-enqueued', async () => {
    const uuid = 'custom-uuid-1234';
    const payload1 = {
        survey_client_uuid: uuid,
        respondent_code: 'HH-101',
        notes: 'First draft'
    };
    const payload2 = {
        survey_client_uuid: uuid,
        respondent_code: 'HH-101',
        notes: 'Updated draft'
    };

    await offlineSyncManager.enqueue(payload1);
    await offlineSyncManager.enqueue(payload2);

    const count = await offlineSyncManager.getPendingCount();
    assert.strictEqual(count, 1, 'Re-enqueueing with same UUID must not duplicate queue entries');

    const pending = await offlineSyncManager.getPendingRecords();
    assert.strictEqual(pending[0].payload.notes, 'Updated draft');
});

test('offlineSyncManager isolates record in dead_letter queue after 5 consecutive failures', async () => {
    const payload = {
        respondent_code: 'HH-FAIL',
        interviewer_name: 'Tester'
    };

    const record = await offlineSyncManager.enqueue(payload);
    const uuid = record.client_uuid;

    const failingUpload = async () => {
        throw new Error('Simulated upstream network timeout 504');
    };

    // Run sync 5 times
    for (let i = 1; i <= 5; i++) {
        await offlineSyncManager.syncAll(failingUpload);
    }

    const pendingCount = await offlineSyncManager.getPendingCount();
    assert.strictEqual(pendingCount, 0, 'Dead letter records must be excluded from active pending queue');

    const deadLetters = await offlineSyncManager.getDeadLetterRecords();
    assert.strictEqual(deadLetters.length, 1);
    assert.strictEqual(deadLetters[0].client_uuid, uuid);
    assert.strictEqual(deadLetters[0].status, 'dead_letter');
    assert.strictEqual(deadLetters[0].retry_count, 5);
    assert.match(deadLetters[0].last_error, /504/);

    // Re-drive dead letter record
    await offlineSyncManager.retryDeadLetterRecord(uuid);
    const redrivenCount = await offlineSyncManager.getPendingCount();
    assert.strictEqual(redrivenCount, 1, 'Re-driven dead letter record must return to pending status');
});

test('offlineSyncManager recovers stale syncing records after process interruption', async () => {
    const payload = {
        respondent_code: 'HH-CRASH',
        interviewer_name: 'Tester'
    };

    const record = await offlineSyncManager.enqueue(payload);
    const uuid = record.client_uuid;

    await offlineSyncManager.markSyncing(uuid);

    // Stale attempt from 2 minutes ago
    const queue = JSON.parse(globalThis.localStorage.getItem('csp_offline_surveys_fallback_v1'));
    queue[0].last_attempt_at = new Date(Date.now() - 120000).toISOString();
    globalThis.localStorage.setItem('csp_offline_surveys_fallback_v1', JSON.stringify(queue));

    // getPendingRecords should recover it from 'syncing' to 'pending'
    const pending = await offlineSyncManager.getPendingRecords();
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].status, 'pending');
});

test('offlineSyncManager skips concurrent syncAll executions when sync is in progress', async () => {
    const payload = {
        respondent_code: 'HH-LOCK',
        interviewer_name: 'Tester'
    };
    await offlineSyncManager.enqueue(payload);

    let resolveUpload;
    const slowUpload = () => new Promise((resolve) => {
        resolveUpload = resolve;
    });

    const firstSyncPromise = offlineSyncManager.syncAll(slowUpload);
    const secondSyncResult = await offlineSyncManager.syncAll(slowUpload);

    assert.strictEqual(secondSyncResult.skipped, true, 'Concurrent sync execution must be skipped');

    resolveUpload();
    const firstSyncResult = await firstSyncPromise;
    assert.strictEqual(firstSyncResult.successCount, 1);
    assert.strictEqual(firstSyncResult.skipped, false);
});
