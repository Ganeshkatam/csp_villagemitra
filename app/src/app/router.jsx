import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
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

function withSuspense(Component) {
    return (
        <Suspense fallback={<RouteFallback />}>
            <Component />
        </Suspense>
    );
}

// Route-level code-splitting: each page chunk is fetched only on-demand
const HomePage = lazy(() => import('../pages/home/HomePage'));
const SchemesPage = lazy(() => import('../pages/schemes/SchemesPage'));
const SchemeDetailsPage = lazy(() => import('../pages/schemes/SchemeDetailsPage'));
const ContactsPage = lazy(() => import('../pages/contacts/ContactsPage'));
const HealthcarePage = lazy(() => import('../pages/healthcare/HealthcarePage'));
const EducationPage = lazy(() => import('../pages/education/EducationPage'));
const BusinessesPage = lazy(() => import('../pages/businesses/BusinessesPage'));
const AnnouncementsPage = lazy(() => import('../pages/announcements/AnnouncementsPage'));
const AnnouncementDetailsPage = lazy(() => import('../pages/announcements/AnnouncementDetailsPage'));
const VillagePage = lazy(() => import('../pages/village/VillagePage'));
const FeedbackPage = lazy(() => import('../pages/feedback/FeedbackPage'));
const SurveyPage = lazy(() => import('../pages/survey/SurveyPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const AdminPage = lazy(() => import('../pages/admin/AdminPage'));

export const router = createBrowserRouter([
    {
        path: '/',
        element: <PublicLayout />,
        children: [
            { index: true, element: withSuspense(HomePage) },
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
        children: [
            { index: true, element: withSuspense(SurveyPage) },
            { path: 'complete', element: withSuspense(SurveyPage) }
        ]
    },
    {
        path: '/dashboard',
        element: <AdminLayout />,
        children: [
            { index: true, element: withSuspense(DashboardPage) },
            { path: ':subtab', element: withSuspense(DashboardPage) }
        ]
    },
    {
        path: '/admin',
        element: <AdminLayout />,
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
