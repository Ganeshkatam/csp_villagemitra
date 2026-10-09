import { supabase as defaultClient } from './supabase.js';

/**
 * Executes a lightweight liveness probe confirming that the hosting process is active.
 * Does not depend on external services or databases.
 * 
 * @returns {{ status: 'ok', type: 'liveness', timestamp: string, uptimeSeconds: number | null }}
 */
export function checkLiveness() {
    const uptime = typeof process !== 'undefined' && typeof process.uptime === 'function'
        ? Math.floor(process.uptime())
        : null;

    return {
        status: 'ok',
        type: 'liveness',
        timestamp: new Date().toISOString(),
        uptimeSeconds: uptime
    };
}

/**
 * Executes an active database readiness probe against Supabase.
 * Strictly separates liveness from readiness and protects against sensitive data exposure.
 * 
 * @param {Object} [client] - Supabase client instance (defaults to app singleton)
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=3000] - Probe timeout in milliseconds
 * @returns {Promise<{
 *   status: 'ready' | 'degraded',
 *   type: 'readiness',
 *   database: 'connected' | 'unreachable',
 *   latencyMs?: number,
 *   error?: string,
 *   timestamp: string
 * }>}
 */
export async function checkReadiness(client = defaultClient, options = {}) {
    const { timeoutMs = 3000 } = options;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (!client || typeof client.from !== 'function') {
        return {
            status: 'degraded',
            type: 'readiness',
            database: 'unreachable',
            error: 'Database client is unconfigured or unavailable.',
            timestamp
        };
    }

    try {
        let timerId;
        const timeoutPromise = new Promise((_, reject) => {
            timerId = setTimeout(() => {
                reject(new Error('Database probe timed out'));
            }, timeoutMs);
        });

        const probePromise = client
            .from('villages')
            .select('id')
            .limit(1)
            .then(res => {
                clearTimeout(timerId);
                return res;
            });

        const result = await Promise.race([probePromise, timeoutPromise]);
        const latencyMs = Date.now() - startTime;

        if (result?.error) {
            return {
                status: 'degraded',
                type: 'readiness',
                database: 'unreachable',
                error: 'Database query rejected: ' + (result.error.code || 'CONNECTION_ERROR'),
                latencyMs,
                timestamp
            };
        }

        return {
            status: 'ready',
            type: 'readiness',
            database: 'connected',
            latencyMs,
            timestamp
        };
    } catch (err) {
        const latencyMs = Date.now() - startTime;
        const isTimeout = err?.message?.includes('timed out');

        return {
            status: 'degraded',
            type: 'readiness',
            database: 'unreachable',
            error: isTimeout ? 'Database probe timed out after ' + timeoutMs + 'ms' : 'Database connection failed',
            latencyMs,
            timestamp
        };
    }
}

/**
 * Dispatches a health request to either liveness or readiness probe.
 * Returns HTTP-friendly payload with status code.
 * 
 * @param {{ probe?: string }} query - Query parameters (e.g. { probe: 'liveness' | 'readiness' })
 * @param {Object} [client] - Supabase client instance
 * @param {Object} [options]
 * @returns {Promise<{ statusCode: number, headers: Record<string, string>, body: Object }>}
 */
export async function handleHealthProbe(query = {}, client = defaultClient, options = {}) {
    const probeType = (query.probe || 'readiness').toLowerCase().trim();

    if (probeType === 'liveness' || probeType === 'live') {
        const body = checkLiveness();
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            },
            body
        };
    }

    const body = await checkReadiness(client, options);
    const statusCode = body.status === 'ready' ? 200 : 503;

    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
        },
        body
    };
}
