import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { getLocalized } from '../../../i18n';
import { formatHumanDisplay } from '../../../utils/dates';

export function AnnouncementCard({ announcement, lang }) {
    const formattedDate = announcement.event_date ? formatHumanDisplay(announcement.event_date) : '';

    const todayStr = new Date().toISOString().split('T')[0];
    const isPast = announcement.event_date && announcement.event_date < todayStr;
    const isToday = announcement.event_date && announcement.event_date === todayStr;

    return (
        <div className={`civic-card ${isPast ? 'opacity-75' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
            {announcement.image_url && (
                <div className="civic-card-media">
                    <img 
                        src={announcement.image_url} 
                        alt={announcement.title} 
                        loading="lazy"
                    />
                </div>
            )}
            <div style={{ flex: 1 }}>
                <div className="card-header-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-warning">{announcement.category || 'Public Notice'}</span>
                        {isToday && (
                            <span className="badge badge-alert" style={{ fontSize: '0.7rem' }}>
                                {lang === 'te' ? 'ఈరోజు' : 'Today'}
                            </span>
                        )}
                        {isPast && (
                            <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--color-slate-200)', color: 'var(--color-slate-700)' }}>
                                {lang === 'te' ? 'ముగిసింది' : 'Past Notice'}
                            </span>
                        )}
                    </div>
                    {formattedDate && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <Calendar size={13} /> {formattedDate}
                        </span>
                    )}
                </div>
                <h3 className="card-item-title">
                    {announcement.id ? (
                        <Link to={`/announcements/${announcement.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {getLocalized(announcement, 'title', lang)}
                        </Link>
                    ) : (
                        getLocalized(announcement, 'title', lang)
                    )}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-700)', lineHeight: '1.55', margin: '0.5rem 0 1rem' }}>
                    {getLocalized(announcement, 'description', lang)}
                </p>
            </div>
            <div className="card-verify-tag">
                <span>Source: {announcement.source || 'Public Board'}</span>
                <span>Verified: {announcement.verified_on || 'Current'}</span>
            </div>
        </div>
    );
}

export default AnnouncementCard;
