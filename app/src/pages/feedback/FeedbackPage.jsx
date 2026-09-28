import React, { useState } from 'react';
import { MessageSquare, ShieldCheck, CheckCircle2, Search, Clock, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../app/providers';
import { FeedbackForm } from '../../features/feedback/components/FeedbackForm';
import { feedbackService } from '../../features/feedback/api/feedback';

export function FeedbackPage() {
    const { t } = useAppContext();
    const [searchRef, setSearchRef] = useState('');
    const [lookupResult, setLookupResult] = useState(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState(null);

    async function handleStatusLookup(e) {
        e.preventDefault();
        const trimmed = searchRef.trim();
        if (!trimmed) return;

        setLookupLoading(true);
        setLookupError(null);
        setLookupResult(null);

        try {
            const data = await feedbackService.checkFeedbackStatus(trimmed);
            if (data && data.found) {
                setLookupResult(data);
            } else {
                setLookupError(data?.message || 'No record found with this Reference ID.');
            }
        } catch (err) {
            console.error('Status lookup error:', err);
            setLookupError('Unable to check status at this time. Please verify the Reference ID format.');
        } finally {
            setLookupLoading(false);
        }
    }

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="container page-header-inner">
                    <div className="page-badge-row">
                        <span className="badge badge-civic">
                            <MessageSquare size={12} style={{ marginRight: '3px' }} /> Citizen Redressal &amp; Feedback
                        </span>
                        <span className="badge badge-verified">Direct Administrative Review</span>
                    </div>
                    <h1 className="page-title">{t?.feedbackTitle || 'Citizen Feedback & Correction Desk'}</h1>
                    <p className="page-subtitle">
                        Help ensure village records stay accurate. Request telephone corrections, report modified hospital OPD hours, or suggest local business and artisan listings.
                    </p>
                </div>
            </div>

            <div className="container" style={{ paddingBottom: '3.5rem' }}>
                <div className="feedback-grid-layout">
                    <div>
                        <FeedbackForm t={t} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Safe Privacy-Preserving Reference Status Lookup */}
                        <div className="civic-card" style={{ padding: '1.75rem' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Search size={18} style={{ color: 'var(--color-blue-600)' }} />
                                Check Submission Status
                            </h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', lineHeight: '1.5', marginBottom: '1rem' }}>
                                Enter your Reference ID to check administrative verification status. To protect citizen privacy, personal details are not displayed.
                            </p>

                            <form onSubmit={handleStatusLookup} style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={searchRef}
                                    onChange={(e) => setSearchRef(e.target.value)}
                                    placeholder="e.g. VM-FB-2026-12345"
                                    style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}
                                    aria-label="Reference ID"
                                />
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={lookupLoading || !searchRef.trim()}
                                    style={{ flexShrink: 0 }}
                                >
                                    {lookupLoading ? 'Checking...' : 'Check'}
                                </button>
                            </form>

                            {lookupError && (
                                <div className="alert alert-danger" style={{ fontSize: '0.8125rem', padding: '0.75rem', marginTop: '0.5rem' }}>
                                    <AlertCircle size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
                                    {lookupError}
                                </div>
                            )}

                            {lookupResult && (
                                <div style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-md)', padding: '1rem', marginTop: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Reference ID</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-slate-900)' }}>{lookupResult.reference_id}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Category</span>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-slate-800)' }}>{lookupResult.category}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>Status</span>
                                        <span className="badge badge-verified" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                                            {lookupResult.status}
                                        </span>
                                    </div>
                                    {lookupResult.submitted_at && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-slate-200)' }}>
                                            <span>Logged On:</span>
                                            <span>{new Date(lookupResult.submitted_at).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Resolution Process Information */}
                        <div className="civic-card" style={{ padding: '1.75rem' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldCheck size={18} style={{ color: 'var(--color-emerald-600)' }} />
                                Verification Process
                            </h3>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', listStyle: 'none', padding: 0, margin: 0, fontSize: '0.875rem', color: 'var(--color-slate-700)' }}>
                                <li style={{ display: 'flex', gap: '10px' }}>
                                    <CheckCircle2 size={16} style={{ color: 'var(--color-blue-600)', flexShrink: 0, marginTop: '2px' }} />
                                    <span><strong>1. Field Logging:</strong> Submissions are recorded securely with an encrypted reference ID.</span>
                                </li>
                                <li style={{ display: 'flex', gap: '10px' }}>
                                    <CheckCircle2 size={16} style={{ color: 'var(--color-blue-600)', flexShrink: 0, marginTop: '2px' }} />
                                    <span><strong>2. Verification:</strong> The administrative team cross-checks requested updates against official Panchayat records.</span>
                                </li>
                                <li style={{ display: 'flex', gap: '10px' }}>
                                    <CheckCircle2 size={16} style={{ color: 'var(--color-blue-600)', flexShrink: 0, marginTop: '2px' }} />
                                    <span><strong>3. Public Update:</strong> Verified corrections are published to benefit all village residents.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FeedbackPage;
