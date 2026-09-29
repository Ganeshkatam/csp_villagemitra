import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import PublicLayout from '../layouts/PublicLayout';
import SurveyLayout from '../layouts/SurveyLayout';
import AdminLayout from '../layouts/AdminLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoadingState } from '../components/feedback/LoadingState';

// Route Suspense Fallback
function RouteFallback() {
    return (
        <div className="container" style={{ padding: '3.5rem 0' }}>
            <LoadingState count={3} message="Loading requested view..." />
        </div>
    );
}

// User-friendly Route Error Boundary
function RootErrorBoundary() {
    const error = useRouteError();
    const isChunkError = error?.message?.includes?.('dynamically imported module') ||
                         error?.message?.includes?.('Failed to fetch');

    return (
        <div className="container" style={{ padding: '4rem 1rem', maxWidth: '580px', margin: '0 auto', textAlign: 'center' }}>
            <div className="civic-card" style={{ padding: '2.5rem 2rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                    <AlertCircle size={24} />
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
                    {isChunkError ? 'Application Update Available' : 'Something went wrong'}
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', lineHeight: '1.6', marginBottom: '1.75rem' }}>
                    {isChunkError 
                        ? 'A new version of the portal has just been deployed. Please reload the page to get the latest update.' 
                        : (error?.message || 'An unexpected error occurred while loading this view.')
                    }
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button 
                        type="button" 
                        onClick={() => window.location.reload()} 
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <RefreshCw size={15} /> Reload Portal
                    </button>
                    <a 
                        href="/" 
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Home size={15} /> Return Home
                    </a>
                </div>
            </div>
        </div>
    );
}

// Resilient dynamic import that reloads upon deployment chunk hash invalidation
function lazyWithRetry(componentImport) {
    return lazy(async () => {
        const pageHasAlreadyBeenForceRefreshed = JSON.parse(
            window.sessionStorage.getItem('page_has_been_force_refreshed') || 'false'
        );

        try {
            const component = await componentImport();
            window.sessionStorage.setItem('page_has_been_force_refreshed', 'false');
            return component;
        } catch (error) {
            if (!pageHasAlreadyBeenForceRefreshed) {
                window.sessionStorage.setItem('page_has_been_force_refreshed', 'true');
                window.location.reload();
                return { default: () => null };
            }
            throw error;
        }
    });
}

function withSuspense(Component) {
    return (
        <Suspense fallback={<RouteFallback />}>
            <Component />
        </Suspense>
    );
}

// Route-level code-splitting with automatic deployment chunk-stale retry
const HomePage = lazyWithRetry(() => import('../pages/home/HomePage'));
const SchemesPage = lazyWithRetry(() => import('../pages/schemes/SchemesPage'));
const SchemeDetailsPage = lazyWithRetry(() => import('../pages/schemes/SchemeDetailsPage'));
const ContactsPage = lazyWithRetry(() => import('../pages/contacts/ContactsPage'));
const HealthcarePage = lazyWithRetry(() => import('../pages/healthcare/HealthcarePage'));
const EducationPage = lazyWithRetry(() => import('../pages/education/EducationPage'));
const BusinessesPage = lazyWithRetry(() => import('../pages/businesses/BusinessesPage'));
const AnnouncementsPage = lazyWithRetry(() => import('../pages/announcements/AnnouncementsPage'));
const AnnouncementDetailsPage = lazyWithRetry(() => import('../pages/announcements/AnnouncementDetailsPage'));
const SearchPage = lazyWithRetry(() => import('../pages/search/SearchPage'));
const VillagePage = lazyWithRetry(() => import('../pages/village/VillagePage'));
const FeedbackPage = lazyWithRetry(() => import('../pages/feedback/FeedbackPage'));
const SurveyPage = lazyWithRetry(() => import('../pages/survey/SurveyPage'));
const DashboardPage = lazyWithRetry(() => import('../pages/dashboard/DashboardPage'));
const AdminPage = lazyWithRetry(() => import('../pages/admin/AdminPage'));

export const router = createBrowserRouter([
    {
        path: '/',
        element: <PublicLayout />,
        errorElement: <RootErrorBoundary />,
        children: [
            { index: true, element: withSuspense(HomePage) },
            { path: 'search', element: withSuspense(SearchPage) },
            { path: 'schemes', element: withSuspense(SchemesPage) },
            // Note: /schemes/category/:category is declared BEFORE /schemes/:schemeSlug for unambiguous routing
            { path: 'schemes/category/:category', element: withSuspense(SchemesPage) },
            { path: 'schemes/:schemeSlug', element: withSuspense(SchemeDetailsPage) },
            { path: 'contacts', element: withSuspense(ContactsPage) },
            { path: 'contacts/:category', element: withSuspense(ContactsPage) },
            { path: 'healthcare', element: withSuspense(HealthcarePage) },
            { path: 'healthcare/:institutionId', element: withSuspense(HealthcarePage) },
            { path: 'education', element: withSuspense(EducationPage) },
            { path: 'education/:institutionId', element: withSuspense(EducationPage) },
            { path: 'businesses', element: withSuspense(BusinessesPage) },
            { path: 'businesses/:businessId', element: withSuspense(BusinessesPage) },
            { path: 'announcements', element: withSuspense(AnnouncementsPage) },
            { path: 'announcements/:announcementId', element: withSuspense(AnnouncementDetailsPage) },
            { path: 'village', element: withSuspense(VillagePage) },
            { path: 'feedback', element: withSuspense(FeedbackPage) }
        ]
    },
    {
        path: '/survey',
        element: <SurveyLayout />,
        errorElement: <RootErrorBoundary />,
        children: [
            { index: true, element: withSuspense(SurveyPage) },
            { path: 'complete', element: withSuspense(SurveyPage) }
        ]
    },
    {
        path: '/dashboard',
        element: <AdminLayout />,
        errorElement: <RootErrorBoundary />,
        children: [
            { index: true, element: withSuspense(DashboardPage) },
            { path: ':subtab', element: withSuspense(DashboardPage) }
        ]
    },
    {
        path: '/admin',
        element: <AdminLayout />,
        errorElement: <RootErrorBoundary />,
        children: [
            { 
                index: true, 
                element: (
                    <ProtectedRoute requireAdmin={true}>
                        {withSuspense(AdminPage)}
                    </ProtectedRoute>
                ) 
            },
            { 
                path: ':section', 
                element: (
                    <ProtectedRoute requireAdmin={true}>
                        {withSuspense(AdminPage)}
                    </ProtectedRoute>
                ) 
            }
        ]
    },
    {
        path: '*',
        element: <Navigate to="/" replace />
    }
]);

export default router;
