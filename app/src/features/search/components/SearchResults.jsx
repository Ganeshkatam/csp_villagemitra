import React from 'react';
import { 
    Activity, Phone, FileText, GraduationCap, 
    Store, Bell, Search, AlertCircle, HelpCircle
} from 'lucide-react';
import { SearchResultGroup } from './SearchResultGroup';
import { LoadingState } from '../../../components/feedback/LoadingState';

export function SearchResults({ results = [], state = 'idle', error = null, query = '', lang = 'en', onSuggestClick }) {
    if (state === 'loading') {
        return (
            <div className="search-status-box" aria-live="polite">
                <LoadingState count={3} message={lang === 'te' ? 'వెతుకుతున్నాము...' : `Searching portal for "${query}"...`} />
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div className="search-status-box search-error-box" role="alert">
                <AlertCircle size={28} className="search-error-icon" aria-hidden="true" />
                <h3 className="search-status-title">
                    {lang === 'te' ? 'శోధన లోపం సంభవించింది' : 'Search Query Failed'}
                </h3>
                <p className="search-status-desc">{error || 'Unable to connect to the database. Please verify network connectivity.'}</p>
            </div>
        );
    }

    if (state === 'empty') {
        return (
            <div className="search-status-box search-empty-box" aria-live="polite">
                <div className="search-empty-icon-wrap" aria-hidden="true">
                    <Search size={32} />
                </div>
                <h3 className="search-status-title">
                    {lang === 'te' ? `"${query}" కు ఫలితాలు కనుగొనబడలేదు` : `No civic records found for "${query}"`}
                </h3>
                <p className="search-status-desc">
                    {lang === 'te' 
                        ? 'దయచేసి సరైన పదం లేదా అత్యవసర నంబర్ (ఉదా: 108, PHC, రేషన్, పెన్షన్) తో ప్రయత్నించండి.'
                        : 'Try searching with common village terms, department names, or emergency short codes (e.g. 108, PHC, Pension, School).'
                    }
                </p>

                {onSuggestClick && (
                    <div className="search-suggestions-panel">
                        <span className="search-suggestions-label">
                            {lang === 'te' ? 'సూచించిన పదాలు:' : 'Suggested civic queries:'}
                        </span>
                        <div className="search-suggestion-chips">
                            {['PHC', '108', 'PM-Kisan', 'Aarogyasri', 'Panchayat', 'Water'].map(item => (
                                <button
                                    key={item}
                                    type="button"
                                    className="suggestion-chip"
                                    onClick={() => onSuggestClick(item)}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (state === 'idle') {
        return (
            <div className="search-idle-guide">
                <div className="search-guide-head">
                    <HelpCircle size={20} className="search-guide-icon" aria-hidden="true" />
                    <h3 className="search-guide-title">
                        {lang === 'te' ? 'గ్రామ మిత్ర సమగ్ర శోధన గైడ్' : 'Modavalasa Civic Information Directory'}
                    </h3>
                </div>
                <p className="search-guide-desc">
                    {lang === 'te'
                        ? 'ప్రభుత్వ సంక్షేమ పథకాలు, పీహెచ్‌సీ వైద్యుల సమయాలు, అంగన్‌వాడీ మరియు పాఠశాలల వివరాలు, అత్యవసర ఫోన్ నంబర్లు, మరియు స్థానిక చేతివృత్తుల వారిని నేరుగా శోధించండి.'
                        : 'Instantly find verified information across government schemes, Primary Health Centre duty rosters, school facilities, emergency hotlines, and local village trades.'
                    }
                </p>

                {onSuggestClick && (
                    <div className="search-popular-categories">
                        <span className="search-popular-label">
                            {lang === 'te' ? 'ప్రజాదరణ పొందిన అంశాలు:' : 'Quick Searches:'}
                        </span>
                        <div className="search-suggestion-chips">
                            {[
                                { text: 'Primary Health Centre (PHC)', query: 'PHC' },
                                { text: '108 Ambulance', query: '108' },
                                { text: 'YSR Pension Kanuka', query: 'Pension' },
                                { text: 'PM-Kisan Rythu Bharosa', query: 'PM-Kisan' },
                                { text: 'Aarogyasri Health Insurance', query: 'Aarogyasri' },
                                { text: 'Mandal Parishad School', query: 'School' },
                                { text: 'Electricity Lineman (1912)', query: '1912' },
                                { text: 'Panchayat Secretary', query: 'Panchayat' }
                            ].map(item => (
                                <button
                                    key={item.query}
                                    type="button"
                                    className="suggestion-chip"
                                    onClick={() => onSuggestClick(item.query)}
                                >
                                    {item.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Results state: Group items
    const healthItems = results.filter(r => 
        ['healthcare', 'clinical_schedule', 'immunization_schedule', 'diagnostic_service'].includes(r.entity_type)
    );
    const contactItems = results.filter(r => r.entity_type === 'contact');
    const schemeItems = results.filter(r => r.entity_type === 'scheme');
    const educationItems = results.filter(r => r.entity_type === 'education');
    const businessItems = results.filter(r => r.entity_type === 'business');
    const announcementItems = results.filter(r => r.entity_type === 'announcement');

    return (
        <div className="search-results-container" aria-live="polite">
            <div className="search-results-summary-row">
                <span className="search-summary-text">
                    {lang === 'te' 
                        ? `"${query}" కొరకు ${results.length} ఫలితాలు లభించాయి`
                        : `Found ${results.length} verified ${results.length === 1 ? 'record' : 'records'} for "${query}"`
                    }
                </span>
            </div>

            <SearchResultGroup 
                groupTitle={lang === 'te' ? 'ప్రాథమిక ఆరోగ్య కేంద్రం & వైద్య సేవలు' : 'Healthcare & PHC Services'}
                groupIcon={Activity}
                items={healthItems}
                lang={lang}
            />

            <SearchResultGroup 
                groupTitle={lang === 'te' ? 'అత్యవసర & పరిపాలనా సంప్రదింపులు' : 'Emergency & Civic Directory'}
                groupIcon={Phone}
                items={contactItems}
                lang={lang}
            />

            <SearchResultGroup 
                groupTitle={lang === 'te' ? 'ప్రభుత్వ సంక్షేమ పథకాలు' : 'Government Welfare Schemes'}
                groupIcon={FileText}
                items={schemeItems}
                lang={lang}
            />

            <SearchResultGroup 
                groupTitle={lang === 'te' ? 'విద్యా సంస్థలు & అంగన్‌వాడీ' : 'Education & Anganwadi'}
                groupIcon={GraduationCap}
                items={educationItems}
                lang={lang}
            />

            <SearchResultGroup 
                groupTitle={lang === 'te' ? 'స్థానిక వ్యాపారాలు & చేతివృత్తులు' : 'Local Commerce & Artisans'}
                groupIcon={Store}
                items={businessItems}
                lang={lang}
            />

            <SearchResultGroup 
                groupTitle={lang === 'te' ? 'ప్రకటనలు & హెచ్చరికలు' : 'Public Notices & Advisories'}
                groupIcon={Bell}
                items={announcementItems}
                lang={lang}
            />
        </div>
    );
}

export default SearchResults;
