import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../app/providers';
import { authService } from '../../lib/auth';
import { LoadingState } from '../feedback/LoadingState';

/**
 * Client-side Route Guard for Administrative and Protected Views.
 * Note: This provides UX access control on the frontend.
 * The authoritative security boundary is enforced at the data layer
 * via Supabase Authentication and PostgreSQL Row Level Security (RLS) policies.
 */
export function ProtectedRoute({ children, requireAdmin = true }) {
    const { user, isAdmin, sessionLoading } = useAppContext();
    const location = useLocation();

    if (sessionLoading) {
        return (
            <div className="container" style={{ padding: '4rem 0' }}>
                <LoadingState count={2} message="Verifying authentication session..." />
            </div>
        );
    }

    if (!user) {
        // When on /admin itself, render children so unauthenticated users see the login form
        if (location.pathname === '/admin') {
            return children;
        }
        // Redirect to admin login screen, saving current location for redirect back
        return <Navigate to="/admin" state={{ from: location }} replace />;
    }

    if (requireAdmin && !isAdmin) {
        return (
            <div className="container" style={{ padding: '4rem 0' }}>
                <div className="alert alert-danger" role="alert" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
                    <h3 style={{ marginBottom: '0.5rem', fontWeight: 800 }}>Administrator Privileges Required</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', marginBottom: '1.25rem' }}>
                        Your account ({user.email}) is authenticated, but does not have administrator role authorization to access this management console.
                    </p>
                    <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={async () => {
                            await authService.signOut();
                        }}
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return children;
}

export default ProtectedRoute;

