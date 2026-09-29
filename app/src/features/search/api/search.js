import { supabase, DEFAULT_VILLAGE_ID } from '../../../lib/supabase.js';

/**
 * Normalizes input search query strings by trimming and truncating to maximum 100 characters.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeQuery(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.trim().slice(0, 100);
}

/**
 * Server-authoritative global civic search querying the PostgreSQL search_portal() RPC.
 * Returns a bounded array of canonical SearchResult DTOs.
 * 
 * @param {string} query Search terms (English or Telugu)
 * @param {Object} [options]
 * @param {string} [options.villageId] Target village scope
 * @param {number} [options.limit=20] Max results (capped server-side at 50)
 * @param {AbortSignal} [options.signal] AbortSignal for request cancellation
 * @returns {Promise<Array<import('../index').SearchResult>>}
 */
export async function searchPortal(query, options = {}) {
    const cleanQuery = normalizeQuery(query);
    if (!cleanQuery) {
        return [];
    }

    const {
        villageId = DEFAULT_VILLAGE_ID,
        limit = 20,
        signal
    } = options;

    if (signal?.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError');
    }

    let queryBuilder = supabase.rpc('search_portal', {
        p_query: cleanQuery,
        p_village_id: villageId,
        p_limit: Math.min(Math.max(limit, 1), 50)
    });

    if (signal && typeof queryBuilder.abortSignal === 'function') {
        queryBuilder = queryBuilder.abortSignal(signal);
    }

    let result;
    try {
        result = await queryBuilder;
    } catch (err) {
        if (err?.name === 'AbortError' || signal?.aborted) {
            throw new DOMException('This operation was aborted', 'AbortError');
        }
        throw err;
    }

    const { data, error } = result;

    if (error) {
        if (signal?.aborted || error?.message?.includes('aborted') || error?.name === 'AbortError') {
            throw new DOMException('This operation was aborted', 'AbortError');
        }
        console.error('search_portal RPC error:', error);
        throw error;
    }

    return (data || []).map(item => ({
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        title: item.title,
        title_te: item.title_te,
        subtitle: item.subtitle,
        category: item.category,
        url: item.url,
        score: Number(item.score || 0),
        verified_at: item.verified_at,
        phone: item.phone || null
    }));
}

export const searchService = {
    search: searchPortal,
    normalizeQuery
};

export default searchService;
