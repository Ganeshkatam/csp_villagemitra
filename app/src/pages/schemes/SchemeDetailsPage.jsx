import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ExternalLink, CheckCircle2, UserCheck, ShieldCheck,
    FileCheck, Layers, ArrowLeft, HelpCircle,
    AlertCircle, FileText, Check, Landmark, Printer
} from 'lucide-react';
import { useAppContext } from '../../app/providers';
import { schemeService } from '../../features/schemes';
import { getLocalized } from '../../i18n';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { sanitizeUrl } from '../../utils/validation';


export function SchemeDetailsPage() {
    const { schemeSlug } = useParams();
    const { lang, t } = useAppContext();
    const [scheme, setScheme] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        schemeService.getSchemeBySlugOrId(schemeSlug)
            .then(data => {
                setScheme(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching scheme record:', err);
                setError(err.message || 'Unable to connect to government welfare records database.');
                setLoading(false);
            });
    }, [schemeSlug]);

    if (loading) {
        return (
            <div className="container" style={{ padding: '3.5rem 0' }}>
                <LoadingState count={1} message="Retrieving authoritative civic scheme record..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container" style={{ padding: '3.5rem 0' }}>
                <ErrorState
                    message={error}
                    onRetry={() => window.location.reload()}
                />
            </div>
        );
    }

    if (!scheme) {
        return (
            <div className="container" style={{ padding: '3.5rem 0' }}>
                <EmptyState
                    title="Scheme Record Unavailable"
                    description={`No published welfare scheme record found matching "${schemeSlug}". The record may have been archived or is pending periodic re-verification.`}
                    action={
                        <Link to="/schemes" className="btn btn-primary btn-sm">
                            <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Return to Schemes Catalogue
                        </Link>
                    }
                />
            </div>
        );
    }

    const docStr = scheme.documents_required || scheme.documents || '';
    const docs = docStr.split(',').map(d => d.trim()).filter(Boolean);
    const sanitized = sanitizeUrl(scheme.official_url);
    const portalUrl = sanitized !== '#' ? sanitized : null;


    return (
        <div>
            {/* Civic Record Header */}
            <div className="page-header" style={{ padding: '2rem 0 1.5rem', background: '#ffffff', borderBottom: '1px solid var(--color-border)' }}>
                <div className="container">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--color-slate-500)', marginBottom: '0.75rem' }}>
                        <Link to="/" style={{ color: 'inherit' }}>Home</Link>
                        <span>/</span>
                        <Link to="/schemes" style={{ color: 'inherit' }}>Schemes</Link>
                        {scheme.category && (
                            <>
                                <span>/</span>
                                <Link
                                    to={`/schemes/category/${scheme.category.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-')}`}
                                    style={{ color: 'inherit' }}
                                >
                                    {scheme.category}
                                </Link>
                            </>
                        )}
                        <span>/</span>
                        <span style={{ color: 'var(--color-slate-900)', fontWeight: 600 }}>{scheme.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <span className="badge badge-civic">
                                    <Layers size={12} style={{ marginRight: '3px' }} /> {scheme.category}
                                </span>
                                <span className="badge badge-verified">
                                    <ShieldCheck size={12} style={{ marginRight: '3px' }} /> Verified Civic Record
                                </span>
                            </div>

                            <h1 className="page-title" style={{ fontSize: '2.1rem', margin: '0 0 0.35rem' }}>
                                {getLocalized(scheme, 'name', lang)}
                            </h1>

                            {scheme.name_te && lang === 'en' && (
                                <div style={{ fontSize: '1.05rem', color: 'var(--color-slate-600)', fontWeight: 500, marginBottom: '0.5rem' }}>
                                    {scheme.name_te}
                                </div>
                            )}

                            {scheme.department && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--color-slate-600)', fontWeight: 600 }}>
                                    <Landmark size={15} style={{ color: 'var(--color-blue-600)' }} />
                                    <span>Department: <strong>{scheme.department}</strong></span>
                                </div>
                            )}
                        </div>

                        <Link to="/schemes" className="btn btn-secondary btn-sm">
                            <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Back to All Schemes
                        </Link>
                    </div>
                </div>
            </div>

            {/* Information-First Record Body */}
            <div className="container" style={{ padding: '2rem 0 3.5rem' }}>
                <div className="detail-page-grid">
                    {/* Main Civic Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* 1. Overview */}
                        <div className="civic-card" style={{ padding: '1.75rem' }}>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} style={{ color: 'var(--color-blue-600)' }} />
                                Overview
                            </h2>
                            <p style={{ fontSize: '0.95rem', color: 'var(--color-slate-700)', lineHeight: '1.7', margin: 0 }}>
                                {getLocalized(scheme, 'description', lang)}
                            </p>
                        </div>

                        {/* 2. Key Benefits */}
                        <div className="civic-card" style={{ padding: '1.75rem' }}>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={18} style={{ color: 'var(--color-emerald-600)' }} />
                                Entitlements &amp; Benefits
                            </h2>
                            <p style={{ fontSize: '0.95rem', color: 'var(--color-slate-700)', lineHeight: '1.7', margin: 0 }}>
                                {scheme.benefits || scheme.description || 'Provides direct benefit transfers, financial support, or institutional service coverage as determined by official guidelines.'}
                            </p>
                        </div>

                        {/* 3. Eligibility & Exclusions */}
                        <div className="civic-card" style={{ padding: '1.75rem' }}>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserCheck size={18} style={{ color: 'var(--color-blue-600)' }} />
                                Eligibility Criteria &amp; Exclusions
                            </h2>
                            <div style={{ background: 'var(--color-blue-50)', border: '1px solid var(--color-blue-100)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-blue-800)', marginBottom: '0.35rem' }}>
                                    Who is Eligible?
                                </h4>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-800)', lineHeight: '1.6', margin: 0 }}>
                                    {getLocalized(scheme, 'eligibility', lang)}
                                </p>
                            </div>

                            <div style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-slate-700)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={15} style={{ color: 'var(--color-amber-600)' }} />
                                    Who is Excluded?
                                </h4>
                                {scheme.exclusions ? (
                                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--color-slate-600)', lineHeight: '1.6', margin: 0 }}>
                                        {scheme.exclusions.split(';').map((ex, i) => (
                                            <li key={i}>{ex.trim()}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--color-slate-600)', lineHeight: '1.6', margin: 0 }}>
                                        <li>Institutional landholders or agricultural income tax payees.</li>
                                        <li>Individuals holding regular public office or central/state government employment.</li>
                                        <li>Households failing biometric e-KYC or mandatory bank account Aadhaar seeding.</li>
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* 4. Required Documents Checklist */}
                        <div className="civic-card" style={{ padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileCheck size={18} style={{ color: 'var(--color-emerald-600)' }} />
                                    Required Documents / Verification Checklist
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    aria-label="Print document checklist"
                                >
                                    <Printer size={14} />
                                    <span>Print Checklist</span>
                                </button>
                            </div>
                            {docs.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                                    {docs.map((doc, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                                            <Check size={15} style={{ color: 'var(--color-emerald-600)', flexShrink: 0 }} />
                                            <span>{doc}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', margin: 0 }}>
                                    Aadhaar Card, Rice/Ration Card, and active Bank Passbook linked to Aadhaar.
                                </p>
                            )}
                        </div>

                        {/* 5. How to Apply */}
                        <div className="civic-card" style={{ padding: '1.75rem' }}>
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HelpCircle size={18} style={{ color: 'var(--color-indigo-600)' }} />
                                How to Apply
                            </h2>
                            {scheme.application_process ? (
                                <ol style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--color-slate-700)', lineHeight: '1.7', margin: 0 }}>
                                    {scheme.application_process.split(';').map((step, i) => (
                                        <li key={i}>{step.trim()}</li>
                                    ))}
                                </ol>
                            ) : (
                                <ol style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--color-slate-700)', lineHeight: '1.7', margin: 0 }}>
                                    <li>Visit the local Grama Sachivalayam (Village Secretariat) or designated MeeSeva center.</li>
                                    <li>Submit self-attested photocopies of the required documents listed in the checklist above.</li>
                                    <li>Complete mandatory biometric e-KYC authentication with the Village Revenue Officer (VRO) or Welfare Assistant.</li>
                                    <li>Verify status using your Application ID or Aadhaar number through the official portal.</li>
                                </ol>
                            )}
                        </div>
                    </div>

                    {/* Right Sidebar: Gateway & Verification */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Official Portal Gateway */}
                        <div className="civic-card" style={{ padding: '1.5rem', background: '#ffffff', border: '1.5px solid var(--color-blue-200)' }}>
                            <span className="badge badge-civic" style={{ marginBottom: '0.75rem' }}>Official Citizen Portal</span>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-slate-950)' }}>
                                Citizen Portal Gateway
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                                Access the official government portal to check beneficiary list, enrollment status, or official notifications.
                            </p>

                            {portalUrl ? (
                                <a
                                    href={portalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary btn-block"
                                    title={`Open official portal for ${scheme.name}`}
                                >
                                    <span>Visit Official Website</span>
                                    <ExternalLink size={15} />
                                </a>
                            ) : (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', background: 'var(--color-slate-100)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                    In-person submission at Grama Sachivalayam
                                </div>
                            )}
                        </div>

                        {/* Authoritative Audit & Metadata */}
                        <div className="civic-card" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-slate-500)', marginBottom: '0.85rem' }}>
                                Verification &amp; Source
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.825rem' }}>
                                <div>
                                    <span style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem' }}>Verification Source:</span>
                                    <span style={{ color: 'var(--color-slate-900)', fontWeight: 600 }}>{scheme.source || 'Official Department Circular'}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem' }}>Last Verified Date:</span>
                                    <span style={{ color: 'var(--color-slate-900)', fontWeight: 600 }}>{scheme.verified_on || 'Current Audit Cycle'}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-slate-500)', display: 'block', fontSize: '0.75rem' }}>Publication Status:</span>
                                    <span style={{ color: 'var(--color-emerald-700)', fontWeight: 700 }}>Published (Public Record)</span>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-100)', fontSize: '0.75rem', color: 'var(--color-slate-500)', lineHeight: '1.4' }}>
                                Published government information is periodically verified against official government gazettes and departmental circulars.
                            </div>
                        </div>

                        {/* Secretariat Assistance */}
                        <div className="civic-card" style={{ padding: '1.25rem', background: 'var(--color-slate-50)' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.35rem' }}>
                                Need In-Person Help?
                            </div>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', margin: '0 0 0.75rem', lineHeight: '1.4' }}>
                                Contact your designated Ward/Village Volunteer or visit the Grama Sachivalayam during public grievance hours (10:00 AM - 5:00 PM).
                            </p>
                            <Link to="/contacts" className="btn btn-secondary btn-sm btn-block">
                                View Village Contacts
                            </Link>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default SchemeDetailsPage;
