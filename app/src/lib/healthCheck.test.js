import { test } from 'node:test';
import assert from 'node:assert';
import { checkLiveness, checkReadiness, handleHealthProbe } from './healthCheck.js';

test('checkLiveness returns HTTP 200 status and liveness type without external dependencies', () => {
    const result = checkLiveness();
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.type, 'liveness');
    assert.ok(typeof result.timestamp === 'string');
    assert.ok(!Number.isNaN(Date.parse(result.timestamp)));
});

test('checkReadiness returns status ready and latencyMs when database query succeeds', async () => {
    const mockClient = {
        from: (table) => {
            assert.strictEqual(table, 'villages');
            return {
                select: () => ({
                    limit: () => Promise.resolve({ data: [{ id: '00000000-0000-0000-0000-000000000001' }], error: null })
                })
            };
        }
    };

    const result = await checkReadiness(mockClient);
    assert.strictEqual(result.status, 'ready');
    assert.strictEqual(result.type, 'readiness');
    assert.strictEqual(result.database, 'connected');
    assert.ok(typeof result.latencyMs === 'number');
    assert.ok(result.latencyMs >= 0);
});

test('checkReadiness returns degraded status when database query fails without leaking sensitive data', async () => {
    const mockClient = {
        from: () => ({
            select: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'Database connection terminated', code: '57P01' } })
            })
        })
    };

    const result = await checkReadiness(mockClient);
    assert.strictEqual(result.status, 'degraded');
    assert.strictEqual(result.type, 'readiness');
    assert.strictEqual(result.database, 'unreachable');
    assert.ok(result.error.includes('57P01'));
    // Ensure no password, token, or secret is leaked in error
    assert.strictEqual(result.error.includes('password'), false);
    assert.strictEqual(result.error.includes('postgres://'), false);
});

test('checkReadiness returns degraded when probe times out', async () => {
    const mockClient = {
        from: () => ({
            select: () => ({
                limit: () => new Promise(resolve => setTimeout(resolve, 200))
            })
        })
    };

    const result = await checkReadiness(mockClient, { timeoutMs: 50 });
    assert.strictEqual(result.status, 'degraded');
    assert.strictEqual(result.type, 'readiness');
    assert.strictEqual(result.database, 'unreachable');
    assert.ok(result.error.includes('timed out after 50ms'));
});

test('checkReadiness returns degraded when client is null or unconfigured', async () => {
    const result = await checkReadiness(null);
    assert.strictEqual(result.status, 'degraded');
    assert.strictEqual(result.type, 'readiness');
    assert.strictEqual(result.database, 'unreachable');
    assert.ok(result.error.includes('unconfigured'));
});

test('handleHealthProbe routes liveness and readiness correctly with proper HTTP status codes', async () => {
    // 1. Liveness probe
    const liveRes = await handleHealthProbe({ probe: 'liveness' });
    assert.strictEqual(liveRes.statusCode, 200);
    assert.strictEqual(liveRes.body.type, 'liveness');
    assert.strictEqual(liveRes.body.status, 'ok');

    // 2. Readiness probe success
    const mockHealthyClient = {
        from: () => ({
            select: () => ({
                limit: () => Promise.resolve({ data: [{}], error: null })
            })
        })
    };
    const readyRes = await handleHealthProbe({ probe: 'readiness' }, mockHealthyClient);
    assert.strictEqual(readyRes.statusCode, 200);
    assert.strictEqual(readyRes.body.type, 'readiness');
    assert.strictEqual(readyRes.body.status, 'ready');

    // 3. Readiness probe failure
    const mockFailingClient = {
        from: () => ({
            select: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'Connection refused', code: '08006' } })
            })
        })
    };
    const degradedRes = await handleHealthProbe({ probe: 'readiness' }, mockFailingClient);
    assert.strictEqual(degradedRes.statusCode, 503);
    assert.strictEqual(degradedRes.body.type, 'readiness');
    assert.strictEqual(degradedRes.body.status, 'degraded');
});
