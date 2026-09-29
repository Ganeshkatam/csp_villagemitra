import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { feedbackService } from '../api/feedback';

export function FeedbackForm({ villageId, t }) {
    const [fbName, setFbName] = useState('');
    const [fbPhone, setFbPhone] = useState('');
    const [fbType, setFbType] = useState('Correction');
    const [fbMessage, setFbMessage] = useState('');
    const [fbStatus, setFbStatus] = useState(null); // 'submitting' | 'success' | 'error' | 'offline'
    const [generatedRefId, setGeneratedRefId] = useState(null);
    const [copiedRef, setCopiedRef] = useState(false);
    const [pendingCount, setPendingCount] = useState(() => feedbackService.getPendingFeedbackCount());
    const [isSyncingOffline, setIsSyncingOffline] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);

    React.useEffect(() => {
        const updateCount = () => {
            setPendingCount(feedbackService.getPendingFeedbackCount());
        };

        const handleOnline = async () => {
            updateCount();
            if (feedbackService.getPendingFeedbackCount() > 0) {
                setIsSyncingOffline(true);
                try {
                    const res = await feedbackService.syncOfflineFeedback();
                    if (res?.synced > 0) {
                        setSyncMessage(`Synchronized ${res.synced} offline feedback submission(s).`);
                        setTimeout(() => setSyncMessage(null), 4000);
                    }
                } catch (e) {
                    console.warn('Auto-sync feedback note:', e);
                } finally {
                    setIsSyncingOffline(false);
                    updateCount();
                }
            }
        };

        window.addEventListener('online', handleOnline);
        if (navigator.onLine && feedbackService.getPendingFeedbackCount() > 0) {
            handleOnline();
        }

        return () => window.removeEventListener('online', handleOnline);
    }, []);

    const handleManualSync = async () => {
        setIsSyncingOffline(true);
        setSyncMessage(null);
        try {
            const res = await feedbackService.syncOfflineFeedback();
            if (res?.synced > 0) {
                setSyncMessage(`Successfully synchronized ${res.synced} submission(s).`);
                setTimeout(() => setSyncMessage(null), 4000);
            } else if (res?.skipped) {
                setSyncMessage('Synchronization already in progress.');
            } else {
                setSyncMessage('No submissions to synchronize.');
                setTimeout(() => setSyncMessage(null), 3000);
            }
        } catch (e) {
            console.error('Manual feedback sync error:', e);
            setSyncMessage('Failed to synchronize offline feedback. Please verify your connection.');
        } finally {
            setIsSyncingOffline(false);
            setPendingCount(feedbackService.getPendingFeedbackCount());
        }
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setFbStatus('submitting');
        setGeneratedRefId(null);
        try {
            const result = await feedbackService.submitFeedback({
                village_id: villageId,
                name: fbName,
                phone: fbPhone,
                category: fbType,
                message: fbMessage
            });

            if (result.reference_id) {
                setGeneratedRefId(result.reference_id);
            }

            if (result.offline) {
                setFbStatus('offline');
            } else {
                setFbStatus('success');
            }
            setPendingCount(feedbackService.getPendingFeedbackCount());
            setFbName('');
            setFbPhone('');
            setFbMessage('');
        } catch (err) {
            console.error('Feedback error:', err);
            setFbStatus('error');
        }
    }

    const handleCopyRef = () => {
        if (generatedRefId) {
            navigator.clipboard.writeText(generatedRefId);
            setCopiedRef(true);
            setTimeout(() => setCopiedRef(false), 2500);
        }
    };

    return (
        <div className="civic-card" style={{ padding: '1.75rem' }}>
            {syncMessage && (
                <div className="alert alert-info" role="status" style={{ marginBottom: '1rem' }}>
                    {syncMessage}
                </div>
            )}
            {pendingCount > 0 && (
                <div className="alert alert-warning" role="status" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.875rem' }}>
                        <strong>Offline Queue:</strong> {pendingCount} feedback submission(s) cached locally awaiting database synchronization.
                    </div>
                    {typeof navigator !== 'undefined' && navigator.onLine && (
                        <button
                            type="button"
                            onClick={handleManualSync}
                            disabled={isSyncingOffline}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                        >
                            {isSyncingOffline ? 'Synchronizing...' : 'Sync Now'}
                        </button>
                    )}
                </div>
            )}
            {fbStatus === 'success' && (
                <div className="alert alert-success" role="status" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>{t?.feedbackSuccess || 'Thank you. Your submission has been recorded securely.'}</div>
                    {generatedRefId && (
                        <div style={{ background: 'rgba(255,255,255,0.85)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-emerald-300)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-emerald-800)', textTransform: 'uppercase' }}>Tracking Reference ID</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-950)', fontFamily: 'var(--font-mono)' }}>{generatedRefId}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-slate-500)', marginTop: '2px' }}>Please note this ID. Public lookup only reveals verification status; your personal data is kept confidential.</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyRef}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            >
                                {copiedRef ? 'Copied' : 'Copy ID'}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {fbStatus === 'offline' && (
                <div className="alert alert-info" role="status">
                    You appear to be offline. Your feedback has been saved locally with Reference ID {generatedRefId || ''} and will synchronize when connection restores.
                </div>
            )}
            {fbStatus === 'error' && (
                <div className="alert alert-danger" role="alert">
                    {t?.feedbackError || 'Failed to submit feedback. Please try again.'}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="choice-grid columns-2">
                    <div className="form-group">
                        <label className="form-label">{t?.yourName || 'Your Name (Optional)'}</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={fbName}
                            onChange={(e) => setFbName(e.target.value)}
                            placeholder="Resident Name" 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t?.yourPhone || 'Phone Number (Optional)'}</label>
                        <input 
                            type="tel" 
                            className="form-control" 
                            value={fbPhone}
                            onChange={(e) => setFbPhone(e.target.value)}
                            placeholder="+91 98765 43210" 
                        />
                    </div>
                </div>

                <div className="form-group">
                    <Select
                        label={t?.feedbackCategory || 'Feedback Category'}
                        value={fbType}
                        onChange={setFbType}
                        options={[
                            { value: 'Correction', label: 'Phone Number / Information Correction' },
                            { value: 'New Listing Request', label: 'Request New Business / Artisan Listing' },
                            { value: 'Scheme Inquiry', label: 'Scheme Information Inquiry' },
                            { value: 'General', label: 'General Village Suggestion' }
                        ]}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{t?.description || 'Details / Description *'}</label>
                    <textarea 
                        className="form-control" 
                        rows="4" 
                        value={fbMessage}
                        onChange={(e) => setFbMessage(e.target.value)}
                        placeholder="Please specify the business or facility name, updated phone number, or details..."
                        required
                    />
                </div>

                <Button 
                    type="submit" 
                    variant="primary" 
                    loading={fbStatus === 'submitting'}
                    style={{ minHeight: '44px' }}
                >
                    {t?.submitBtn || 'Submit Feedback & Information'}
                </Button>
            </form>
        </div>
    );
}

export default FeedbackForm;
