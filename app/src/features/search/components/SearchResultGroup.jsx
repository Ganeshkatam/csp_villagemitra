import React from 'react';
import { Link } from 'react-router-dom';
import { 
    Activity, Phone, FileText, GraduationCap, 
    Store, Bell, ShieldCheck, ChevronRight, Stethoscope, Syringe, FlaskConical
} from 'lucide-react';
import { createTelLink } from '../../../utils/phone';

const ENTITY_ICONS = {
    scheme: FileText,
    contact: Phone,
    healthcare: Activity,
    education: GraduationCap,
    business: Store,
    announcement: Bell,
    clinical_schedule: Stethoscope,
    immunization_schedule: Syringe,
    diagnostic_service: FlaskConical
};

const ENTITY_BADGES = {
    scheme: { labelEn: 'Welfare Scheme', labelTe: 'సంక్షేమ పథకం', color: 'badge-blue' },
    contact: { labelEn: 'Civic Contact', labelTe: 'అత్యవసర సంప్రదింపు', color: 'badge-emerald' },
    healthcare: { labelEn: 'PHC Facility', labelTe: 'ఆరోగ్య కేంద్రం', color: 'badge-emerald' },
    education: { labelEn: 'School / Anganwadi', labelTe: 'పాఠశాల / అంగన్‌వాడీ', color: 'badge-indigo' },
    business: { labelEn: 'Local Trade / SHG', labelTe: 'స్థానిక వ్యాపారం / సంఘం', color: 'badge-warning' },
    announcement: { labelEn: 'Public Notice', labelTe: 'ప్రకటన', color: 'badge-alert' },
    clinical_schedule: { labelEn: 'Doctor Duty Roster', labelTe: 'వైద్యుల డ్యూటీ', color: 'badge-blue' },
    immunization_schedule: { labelEn: 'Vaccine Schedule', labelTe: 'టీకా షెడ్యూల్', color: 'badge-indigo' },
    diagnostic_service: { labelEn: 'Lab Diagnostic', labelTe: 'ల్యాబ్ పరీక్ష', color: 'badge-emerald' }
};

export function SearchResultGroup({ groupTitle, groupIcon: Icon, items = [], lang = 'en' }) {
    if (!items || items.length === 0) return null;

    return (
        <section className="search-result-group" aria-label={groupTitle}>
            <div className="search-group-header">
                <div className="search-group-title-wrap">
                    {Icon && <Icon size={18} className="search-group-icon" aria-hidden="true" />}
                    <h3 className="search-group-title">{groupTitle}</h3>
                </div>
                <span className="search-group-count">{items.length} {items.length === 1 ? 'match' : 'matches'}</span>
            </div>

            <div className="search-cards-grid">
                {items.map(item => {
                    const badgeInfo = ENTITY_BADGES[item.entity_type] || { labelEn: item.category, labelTe: item.category, color: 'badge-civic' };
                    const ItemIcon = ENTITY_ICONS[item.entity_type] || FileText;
                    const displayTitle = lang === 'te' && item.title_te ? item.title_te : item.title;

                    return (
                        <div key={`${item.entity_type}-${item.entity_id}`} className="civic-card search-card">
                            <div className="search-card-top">
                                <div className="search-card-meta">
                                    <span className={`badge ${badgeInfo.color}`}>
                                        <ItemIcon size={12} style={{ marginRight: '4px' }} aria-hidden="true" />
                                        {lang === 'te' ? badgeInfo.labelTe : badgeInfo.labelEn}
                                    </span>
                                    {item.verified_at && (
                                        <span className="badge badge-verified" title={`Verified on ${item.verified_at}`}>
                                            <ShieldCheck size={11} style={{ marginRight: '3px' }} aria-hidden="true" />
                                            {item.verified_at}
                                        </span>
                                    )}
                                </div>
                                {item.score >= 0.85 && (
                                    <span className="search-score-pill" title={`Relevance score: ${item.score}`}>
                                        High Match
                                    </span>
                                )}
                            </div>

                            <h4 className="search-card-title">
                                <Link to={item.url} className="search-card-link">
                                    {displayTitle}
                                </Link>
                            </h4>

                            {item.subtitle && (
                                <p className="search-card-subtitle">
                                    {item.subtitle}
                                </p>
                            )}

                            <div className="search-card-footer">
                                {item.phone ? (
                                    <a 
                                        href={createTelLink(item.phone)} 
                                        className="search-phone-link"
                                        title={`Call ${item.phone}`}
                                    >
                                        <Phone size={13} style={{ marginRight: '4px' }} aria-hidden="true" />
                                        <span>{item.phone}</span>
                                    </a>
                                ) : (
                                    <span className="search-category-tag">{item.category}</span>
                                )}

                                <Link to={item.url} className="search-action-btn" aria-label={`View details for ${displayTitle}`}>
                                    <span>{lang === 'te' ? 'వివరాలు చూడండి' : 'View Details'}</span>
                                    <ChevronRight size={14} aria-hidden="true" />
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default SearchResultGroup;
