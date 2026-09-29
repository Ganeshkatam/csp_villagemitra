import { useState, useEffect, useRef, useCallback } from 'react';
import { searchService } from '../api/search';

/**
 * Custom React hook for debounced, cancellation-safe global civic search.
 * 
 * @param {string} [initialQuery=''] Initial search query
 * @param {Object} [options]
 * @param {number} [options.debounceMs=300] Debounce delay in milliseconds
 * @param {number} [options.limit=20] Max results
 * @param {string} [options.villageId] Target village UUID
 */
export function useGlobalSearch(initialQuery = '', options = {}) {
    const { debounceMs = 300, limit = 20, villageId } = options;

    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'results' | 'empty' | 'error'
    const [error, setError] = useState(null);

    const abortControllerRef = useRef(null);
    const timeoutRef = useRef(null);

    const executeSearch = useCallback(async (searchTerms) => {
        const clean = searchTerms ? searchTerms.trim() : '';

        // If query is empty, reset to idle
        if (!clean) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            setResults([]);
            setState('idle');
            setError(null);
            return;
        }

        // Cancel previous pending network request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setState('loading');
        setError(null);

        try {
            const data = await searchService.search(clean, {
                villageId,
                limit,
                signal: controller.signal
            });

            // Prevent state update if request was aborted
            if (controller.signal.aborted) {
                return;
            }

            setResults(data);
            setState(data.length > 0 ? 'results' : 'empty');
        } catch (err) {
            if (err.name === 'AbortError' || controller.signal.aborted) {
                return; // Ignored safely
            }
            console.error('Global search hook error:', err);
            setError(err.message || 'Unable to complete search request');
            setState('error');
        }
    }, [villageId, limit]);

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (!query.trim()) {
            executeSearch('');
            return;
        }

        timeoutRef.current = setTimeout(() => {
            executeSearch(query);
        }, debounceMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [query, debounceMs, executeSearch]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setResults([]);
        setState('idle');
        setError(null);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    const searchNow = useCallback((instantQuery) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setQuery(instantQuery);
        executeSearch(instantQuery);
    }, [executeSearch]);

    return {
        query,
        setQuery,
        results,
        state,
        error,
        searchNow,
        clearSearch
    };
}

export default useGlobalSearch;
