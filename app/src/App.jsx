import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProvider } from './app/providers';
import { router } from './app/router';
import { isSupabaseConfigured, supabaseConfigValidation } from './lib/supabase';
import { ErrorState } from './components/feedback/ErrorState';

export default function App() {
    if (!isSupabaseConfigured) {
        return (
            <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '640px', margin: '0 auto' }}>
                <ErrorState
                    title="Backend Configuration Missing"
                    message={supabaseConfigValidation.message || "Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) must be provided in .env or hosting environment."}
                />
            </div>
        );
    }

    return (
        <AppProvider>
            <RouterProvider router={router} />
        </AppProvider>
    );
}

