import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';
export const DEFAULT_VILLAGE_ID = env.VITE_DEFAULT_VILLAGE_ID || '00000000-0000-0000-0000-000000000001';

export function validateSupabaseConfig(url, anonKey) {
    if (!url || typeof url !== 'string' || !url.trim()) {
        return { valid: false, reason: 'missing_url', message: 'VITE_SUPABASE_URL environment variable is missing.' };
    }
    if (!anonKey || typeof anonKey !== 'string' || !anonKey.trim()) {
        return { valid: false, reason: 'missing_anon_key', message: 'VITE_SUPABASE_ANON_KEY environment variable is missing.' };
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { valid: false, reason: 'malformed_url', message: 'VITE_SUPABASE_URL must use http or https protocol.' };
        }
    } catch {
        return { valid: false, reason: 'malformed_url', message: 'VITE_SUPABASE_URL is not a valid URL.' };
    }
    return { valid: true, reason: null, message: null };
}

export const supabaseConfigValidation = validateSupabaseConfig(SUPABASE_URL, SUPABASE_ANON_KEY);
export const isSupabaseConfigured = supabaseConfigValidation.valid;

function createUnconfiguredClient(validation) {
    const throwConfigError = () => {
        const error = new Error(`Database connection unavailable: ${validation.message}`);
        error.name = 'SupabaseConfigurationError';
        return Promise.reject(error);
    };

    const emptyResult = () => Promise.resolve({ data: null, error: { message: validation.message } });

    return {
        from: () => ({
            select: () => ({
                limit: () => ({ then: (resolve) => resolve({ data: [], error: { message: validation.message } }) }),
                order: () => ({ then: (resolve) => resolve({ data: [], error: { message: validation.message } }) }),
                eq: () => ({ maybeSingle: emptyResult, then: emptyResult }),
                then: (resolve) => resolve({ data: [], error: { message: validation.message } })
            }),
            insert: emptyResult,
            update: emptyResult,
            delete: emptyResult
        }),
        rpc: emptyResult,
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithPassword: throwConfigError,
            signOut: async () => ({ error: null }),
            updateUser: throwConfigError
        }
    };
}

if (!isSupabaseConfigured) {
    console.warn(`Supabase environment note: ${supabaseConfigValidation.message}`);
}

export const supabase = isSupabaseConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : createUnconfiguredClient(supabaseConfigValidation);

