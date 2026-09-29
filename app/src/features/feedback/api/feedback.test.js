import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackService } from './feedback.js';

test('feedbackService rejects messages shorter than 10 characters', async () => {
    await assert.rejects(
        () => feedbackService.submitFeedback({ message: 'too short' }),
        /Please provide at least 10 characters/
    );

    await assert.rejects(
        () => feedbackService.submitFeedback({ message: '         ' }),
        /Please provide at least 10 characters/
    );

    await assert.rejects(
        () => feedbackService.submitFeedback(null),
        /Feedback data is required/
    );
});

test('feedbackService rejects messages longer than 2000 characters', async () => {
    const longMessage = 'A'.repeat(2001);
    await assert.rejects(
        () => feedbackService.submitFeedback({ message: longMessage }),
        /Feedback message cannot exceed 2000 characters/
    );
});

test('feedbackService rejects invalid reference IDs for status check', async () => {
    await assert.rejects(
        () => feedbackService.checkFeedbackStatus(''),
        /Please enter a valid Reference ID/
    );

    await assert.rejects(
        () => feedbackService.checkFeedbackStatus(null),
        /Please enter a valid Reference ID/
    );
});

function setMockOnline(online) {
    if (typeof globalThis.navigator === 'undefined') {
        globalThis.navigator = { onLine: online };
    } else {
        Object.defineProperty(globalThis.navigator, 'onLine', {
            value: online,
            configurable: true,
            writable: true
        });
    }
}

test('feedbackService submits offline and enqueues to durable queue', async () => {
    setMockOnline(false);

    try {
        const result = await feedbackService.submitFeedback({
            name: 'K. Ramu',
            phone: '9848022338',
            category: 'Correction',
            message: 'Primary Health Centre doctor timing changed from 9am to 8:30am.'
        });

        assert.strictEqual(result.offline, true);
        assert.strictEqual(result.success, true);
        assert.match(result.reference_id, /^VM-FB-\d{4}-\d{5}$/);
        assert.ok(feedbackService.getPendingFeedbackCount() >= 1);
    } finally {
        setMockOnline(true);
    }
});

test('feedbackService drains and synchronizes offline submissions', async () => {
    // Ensure an item is enqueued
    setMockOnline(false);
    try {
        await feedbackService.submitFeedback({
            name: 'Sync Test User',
            message: 'Draining offline queue successfully test message.'
        });
    } finally {
        setMockOnline(true);
    }

    const insertedRecords = [];
    const mockSupabase = {
        from: (table) => ({
            insert: async (rows) => {
                assert.strictEqual(table, 'citizen_feedback');
                insertedRecords.push(...rows);
                return { data: rows, error: null };
            }
        })
    };

    const syncResult = await feedbackService.syncOfflineFeedback(mockSupabase);
    assert.ok(syncResult.synced >= 1, 'Expected at least one synced record');
    assert.strictEqual(syncResult.failed, 0);
    assert.strictEqual(feedbackService.getPendingFeedbackCount(), 0);
});

test('feedbackService handles duplicate reference_id during sync as already synced', async () => {
    setMockOnline(false);

    try {
        await feedbackService.submitFeedback({
            name: 'Duplicate Test',
            message: 'This record tests 23505 unique collision handling during sync.'
        });
    } finally {
        setMockOnline(true);
    }

    const mockDuplicateSupabase = {
        from: (table) => ({
            insert: async () => ({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' }
            })
        })
    };

    const syncResult = await feedbackService.syncOfflineFeedback(mockDuplicateSupabase);
    assert.strictEqual(syncResult.synced, 1, 'Duplicate key must be treated as successfully synchronized');
    assert.strictEqual(syncResult.failed, 0);
    assert.strictEqual(feedbackService.getPendingFeedbackCount(), 0);
});
