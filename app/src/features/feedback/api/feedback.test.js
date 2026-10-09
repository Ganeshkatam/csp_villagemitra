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

test('feedbackService propagates database rate-limit rejections without queuing false success', async () => {
    const { supabase } = await import('../../../lib/supabase.js');
    const originalFrom = supabase.from;

    supabase.from = () => ({
        insert: async () => ({
            data: null,
            error: { code: 'P0001', message: 'Rate limit exceeded: only one feedback submission allowed per phone number per minute.' }
        })
    });

    try {
        await assert.rejects(
            () => feedbackService.submitFeedback({
                name: 'Rate Limit Test',
                phone: '9848011223',
                message: 'This feedback will be rejected by database triggers.'
            }),
            /Rate limit exceeded/
        );
        assert.strictEqual(feedbackService.getPendingFeedbackCount(), 0, 'Rate-limited submissions must not be queued offline');
    } finally {
        supabase.from = originalFrom;
    }
});

test('feedbackService propagates PostgreSQL constraint violations without queuing offline', async () => {
    const { supabase } = await import('../../../lib/supabase.js');
    const originalFrom = supabase.from;

    supabase.from = () => ({
        insert: async () => ({
            data: null,
            error: { code: '23514', message: 'new row for relation "citizen_feedback" violates check constraint "chk_citizen_feedback_message_length"' }
        })
    });

    try {
        await assert.rejects(
            () => feedbackService.submitFeedback({
                name: 'Constraint Test',
                message: 'Violating length constraint at database level.'
            }),
            /chk_citizen_feedback_message_length/
        );
        assert.strictEqual(feedbackService.getPendingFeedbackCount(), 0, 'Constraint-violating submissions must not be queued offline');
    } finally {
        supabase.from = originalFrom;
    }
});

test('feedbackService propagates RLS authorization denials without queuing offline', async () => {
    const { supabase } = await import('../../../lib/supabase.js');
    const originalFrom = supabase.from;

    supabase.from = () => ({
        insert: async () => ({
            data: null,
            error: { code: '42501', message: 'new row violates row-level security policy for table citizen_feedback' }
        })
    });

    try {
        await assert.rejects(
            () => feedbackService.submitFeedback({
                name: 'RLS Test',
                message: 'Anonymous user blocked by row-level security policy.'
            }),
            /row-level security policy/
        );
        assert.strictEqual(feedbackService.getPendingFeedbackCount(), 0, 'RLS-denied submissions must not be queued offline');
    } finally {
        supabase.from = originalFrom;
    }
});

test('feedbackService catches genuine network failure and enqueues to offline queue', async () => {
    const { supabase } = await import('../../../lib/supabase.js');
    const originalFrom = supabase.from;

    // Simulate fetch network failure (TypeError: Failed to fetch)
    supabase.from = () => ({
        insert: async () => {
            const err = new TypeError('Failed to fetch');
            throw err;
        }
    });

    try {
        const initialCount = feedbackService.getPendingFeedbackCount();
        const res = await feedbackService.submitFeedback({
            name: 'Network Disconnected Resident',
            message: 'Submitting feedback when device has intermittent connection.'
        });

        assert.strictEqual(res.offline, true);
        assert.strictEqual(res.success, true);
        assert.match(res.reference_id, /^VM-FB-\d{4}-\d{5}$/);
        assert.strictEqual(feedbackService.getPendingFeedbackCount(), initialCount + 1, 'Network failures must be queued offline');

        // Drain the queue to clean up
        const mockSupabase = {
            from: () => ({
                insert: async (rows) => ({ data: rows, error: null })
            })
        };
        await feedbackService.syncOfflineFeedback(mockSupabase);
        assert.strictEqual(feedbackService.getPendingFeedbackCount(), 0);
    } finally {
        supabase.from = originalFrom;
    }
});

test('feedbackService records successful insert directly without queuing', async () => {
    const { supabase } = await import('../../../lib/supabase.js');
    const originalFrom = supabase.from;

    supabase.from = () => ({
        insert: async (rows) => ({
            data: rows,
            error: null
        })
    });

    try {
        const res = await feedbackService.submitFeedback({
            name: 'P. Appala Naidu',
            phone: '9848011222',
            message: 'Water supply pipeline repair request for Ward 2.'
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.offline, undefined);
        assert.match(res.reference_id, /^VM-FB-\d{4}-\d{5}$/);
        assert.strictEqual(feedbackService.getPendingFeedbackCount(), 0, 'Successful direct insert must not touch offline queue');
    } finally {
        supabase.from = originalFrom;
    }
});


