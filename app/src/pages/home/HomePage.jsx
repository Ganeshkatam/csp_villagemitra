import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Search, FileText, Phone, Activity, GraduationCap,
    Building2, MessageSquare, ArrowRight, HeartPulse,
    Store, Calendar, CheckCircle2, HomeIcon, Landmark, X
} from 'lucide-react';
import { useAppContext } from '../../app/providers';
import {
    villageService,
    CENSUS_2011_BASELINE,
    ADMINISTRATIVE_JURISDICTION,
    LIVELIHOOD_PROFILE,
    PROVENANCE_DISCLAIMER
} from '../../features/village';
import { announcementService } from '../../features/announcements/api/announcements';
import { schemeService } from '../../features/schemes/api/schemes';
import { contactService } from '../../features/contacts/api/contacts';
import { healthcareService } from '../../features/healthcare/api/healthcare';
import { educationService } from '../../features/education/api/education';
import { businessService } from '../../features/businesses/api/businesses';
import { SchemeCard } from '../../features/schemes/components/SchemeCard';
import { ContactCard } from '../../features/contacts/components/ContactCard';
import { HealthcareCard } from '../../features/healthcare/components/HealthcareCard';
import { EducationCard } from '../../features/education/components/EducationCard';
import { BusinessCard } from '../../features/businesses/components/BusinessCard';
import { getLocalized } from '../../i18n';
import { createTelLink } from '../../utils/phone';

export function HomePage() {
    const { lang, t } = useAppContext();
    const isTe = lang === 'te';
    const [pageData, setPageData] = useState({
        village: null,
        announcements: [],
        schemes: [],
        contacts: [],
        healthcare: [],
        education: [],
        businesses: []
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeExplorerTab, setActiveExplorerTab] = useState('schemes'); // 'schemes' | 'contacts' | 'facilities' | 'businesses'
    const navigate = useNavigate();

    const { village, announcements, schemes, contacts, healthcare, education, businesses } = pageData;

    useEffect(() => {
        let isMounted = true;

        Promise.allSettled([
            villageService.getVillageProfile(),
            announcementService.getAnnouncements(),
            schemeService.getAllSchemes(),
            contactService.getContacts(),
            healthcareService.getHealthcareFacilities(),
            educationService.getEducationInstitutions(),
            businessService.getBusinesses()
        ]).then(([vRes, aRes, sRes, cRes, hRes, eRes, bRes]) => {
            if (!isMounted) return;
            setPageData({
                village: vRes.status === 'fulfilled' && vRes.value ? vRes.value : null,
                announcements: aRes.status === 'fulfilled' && Array.isArray(aRes.value) ? aRes.value.slice(0, 3) : [],
                schemes: sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value.slice(0, 4) : [],
                contacts: cRes.status === 'fulfilled' && Array.isArray(cRes.value) ? cRes.value.slice(0, 4) : [],
                healthcare: hRes.status === 'fulfilled' && Array.isArray(hRes.value) ? hRes.value.slice(0, 2) : [],
                education: eRes.status === 'fulfilled' && Array.isArray(eRes.value) ? eRes.value.slice(0, 2) : [],
                businesses: bRes.status === 'fulfilled' && Array.isArray(bRes.value) ? bRes.value.slice(0, 4) : []
            });
            setLoading(false);
        }).catch(err => {
            console.error('Home data load error:', err);
            if (isMounted) setLoading(false);
        });

        return () => { isMounted = false; };
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/schemes?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const hubs = [
        {
            to: '/schemes',
            title: t?.hubSchemesTitle || 'Government Welfare Schemes',
            desc: t?.hubSchemesDesc || 'Check eligibility criteria, required documents checklists, and direct official portal links.',
            icon: <FileText size={22} />,
            theme: 'hub-theme-blue',
            actionText: 'Browse Schemes'
        },
        {
            to: '/contacts',
            title: t?.hubContactsTitle || 'Emergency & Admin Contacts',
            desc: t?.hubContactsDesc || 'Direct verified phone numbers for Panchayat, Police, Medical Staff, and Linemen.',
            icon: <Phone size={22} />,
            theme: 'hub-theme-red',
            actionText: 'Emergency Directory'
        },
        {
            to: '/healthcare',
            title: t?.hubHealthTitle || 'Primary Health Centre (PHC)',
            desc: t?.hubHealthDesc || 'Doctor OPD timings, maternal immunization schedule, and operating hours indicator.',
            icon: <Activity size={22} />,
            theme: 'hub-theme-emerald',
            actionText: 'Healthcare Timings'
        },
        {
            to: '/education',
            title: t?.hubSchoolsTitle || 'Education & Anganwadi',
            desc: t?.hubSchoolsDesc || 'Mandal Parishad School, student capacity, mid-day meals, and Headmaster details.',
            icon: <GraduationCap size={22} />,
            theme: 'hub-theme-indigo',
            actionText: 'School Facilities'
        },
        {
            to: '/businesses',
            title: t?.hubBizTitle || 'Local Businesses & SHGs',
            desc: t?.hubBizDesc || 'Artisans, motor rewinding electricians, mechanics, and women\'s self-help groups.',
            icon: <Building2 size={22} />,
            theme: 'hub-theme-amber',
            actionText: 'Artisans & Shops'
        },
        {
            to: '/feedback',
            title: t?.hubFeedbackTitle || 'Citizen Feedback Desk',
            desc: t?.hubFeedbackDesc || 'Request information updates, report outdated numbers, or suggest new listings.',
            icon: <MessageSquare size={22} />,
            theme: 'hub-theme-slate',
            actionText: 'Submit Correction'
        }
    ];

    const infraObservations = [
        { service: 'Drinking Water', observation: 'Functional RO filtration plant & overhead reservoir', source: 'CSP Field Survey & Panchayat', date: 'Aug 2024' },
        { service: 'Rural Electricity', observation: '24x7 domestic grid supply; agricultural feeder on scheduled roster', source: 'APEPDCL Feeder Roster', date: 'Aug 2024' },
        { service: 'Concrete Roads', observation: 'Internal CC roads completed; main approach road under maintenance', source: 'Gram Panchayat Records', date: 'Aug 2024' },
        { service: 'Streetlights', observation: 'LED street fixtures installed across primary habitation lanes', source: 'Field Survey Observation', date: 'Aug 2024' },
        { service: 'Sanitation', observation: 'Surface drainage with periodic sanitation; waste collection active', source: 'Swachh Habitation Log', date: 'Aug 2024' }
    ];

    return (
        <div className="container">
            {/* Civic Hero */}
            <section className="civic-hero modern-split-hero">
                <div className="hero-grid-layout">
                    <div className="hero-content-col">
                        <div className="hero-project-badge">
                            <span className="badge-dot" aria-hidden="true"></span>
                            <span>{t?.projectBadge || 'Academic CSP Initiative • B.Tech CSE'}</span>
                        </div>

                        <h1 className="hero-title">
                            {village?.name ? `${t?.welcomeTo || 'Welcome to'} ${getLocalized(village, 'name', lang)}` : 'Village Mitra'}
                            <span className="hero-title-suffix"> {t?.portalTitleEn || 'Portal'}</span>
                        </h1>

                        <div className="hero-regional-badge">
                            <span>{t?.portalTitleRegional || 'గ్రామ మిత్ర'}</span>
                        </div>

                        <p className="hero-subtitle">
                            {village?.gram_panchayat
                                ? `${village.gram_panchayat} Gram Panchayat • ${village.mandal} Mandal • ${village.district} District • ${village.state || 'Andhra Pradesh'}`
                                : (t?.portalSubtitle || 'Village Information Gateway • Academic CSP Initiative')
                            }
                        </p>

                        {/* Global Unified Search Bar */}
                        <form onSubmit={handleSearchSubmit} className="hero-search-form">
                            <div className="hero-search-icon-badge" aria-hidden="true">
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                className="hero-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t?.searchPlaceholder || 'Search schemes, contacts, doctors, schools...'}
                                aria-label="Global search query"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="hero-search-clear-btn"
                                    aria-label="Clear search query"
                                >
                                    <X size={16} />
                                </button>
                            )}
                            <button type="submit" className="hero-search-submit-btn">
                                <Search size={14} />
                                <span>{isTe ? "శోధించండి" : "Search"}</span>
                            </button>
                        </form>

                        {/* Fast Navigation Shortcut Tags */}
                        <div className="hero-pills-row">
                            <Link to="/schemes" className="hero-quick-pill hero-pill-schemes">
                                <FileText size={15} /> Welfare Schemes
                            </Link>
                            <Link to="/contacts" className="hero-quick-pill hero-pill-contacts">
                                <Phone size={15} /> Emergency Contacts
                            </Link>
                            <Link to="/healthcare" className="hero-quick-pill hero-pill-health">
                                <HeartPulse size={15} /> PHC Healthcare
                            </Link>
                            <Link to="/businesses" className="hero-quick-pill hero-pill-biz">
                                <Store size={15} /> Local Artisans
                            </Link>
                        </div>
                    </div>

                    <div className="hero-visual-col">
                        <div className="hero-illustration-frame">
                            <img
                                src="/images/rural_village_illustration.jpg"
                                alt="Digital Village Civic Community Landscape"
                                className="hero-illustration-img"
                            />
                            <div className="hero-illustration-caption">
                                <div className="hero-caption-left">
                                    <div className="hero-caption-icon">
                                        <HomeIcon size={17} />
                                    </div>
                                    <span className="hero-caption-text">
                                        {isTe ? "మోదవలస గ్రామం • డెంకాడ" : "Modavalasa Village • Denkada"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. Modavalasa Village Overview (Provenance-Gated Habitation Profile) */}
            <section className="village-overview-block" aria-label="Modavalasa Habitation Overview">
                {/* Lead Card: Modavalasa at a Glance */}
                <div className="village-glance-card">
                    <div className="village-glance-header">
                        <div className="village-glance-title-wrap">
                            <span className="badge badge-civic" style={{ alignSelf: 'flex-start', marginBottom: '4px' }}>
                                <Landmark size={13} style={{ marginRight: '4px' }} />
                                {t?.villageOverviewBadge || 'Habitation Profile & Civic Overview'}
                            </span>
                            <h2 className="village-glance-title">
                                {t?.villageOverviewTitle || 'About Modavalasa Habitation'}
                            </h2>
                            <div className="village-glance-sub">
                                {t?.villageOverviewSub || 'Denkada Mandal • Vizianagaram District • Andhra Pradesh'}
                            </div>
                        </div>
                        <span className="village-pillar-evidence-tag evidence-tag-census">
                            {isTe ? "సెన్సస్ 2011 గ్రామ కోడ్: 583218" : "Census 2011 Village Code: 583218"}
                        </span>
                    </div>

                    <p className="village-glance-desc">
                        {t?.villageLeadNarrative || (isTe ? LIVELIHOOD_PROFILE.summaryTe : LIVELIHOOD_PROFILE.summaryEn)}
                    </p>

                    {/* Quick Baseline Metadata Pills */}
                    <div className="village-glance-pills">
                        <div className="village-glance-pill">
                            <span className="village-glance-pill-label">{isTe ? "గ్రామ పంచాయతీ" : "Panchayat"}:</span>
                            <span className="village-glance-pill-val">{isTe ? ADMINISTRATIVE_JURISDICTION.gramPanchayatTe : ADMINISTRATIVE_JURISDICTION.gramPanchayat}</span>
                        </div>
                        <div className="village-glance-pill">
                            <span className="village-glance-pill-label">{isTe ? "మండలం" : "Mandal"}:</span>
                            <span className="village-glance-pill-val">{isTe ? ADMINISTRATIVE_JURISDICTION.mandalTe : ADMINISTRATIVE_JURISDICTION.mandal}</span>
                        </div>
                        <div className="village-glance-pill">
                            <span className="village-glance-pill-label">{isTe ? "జిల్లా" : "District"}:</span>
                            <span className="village-glance-pill-val">{isTe ? ADMINISTRATIVE_JURISDICTION.districtTe : ADMINISTRATIVE_JURISDICTION.district}</span>
                        </div>
                        <div className="village-glance-pill">
                            <span className="village-glance-pill-label">{isTe ? "జనాభా" : "Population"}:</span>
                            <span className="village-glance-pill-val">{CENSUS_2011_BASELINE.population.toLocaleString()}</span>
                        </div>
                        <div className="village-glance-pill">
                            <span className="village-glance-pill-label">{isTe ? "గృహాలు" : "Households"}:</span>
                            <span className="village-glance-pill-val">{CENSUS_2011_BASELINE.households}</span>
                        </div>
                        <div className="village-glance-pill">
                            <span className="village-glance-pill-label">{isTe ? "వైశాల్యం" : "Area"}:</span>
                            <span className="village-glance-pill-val">{CENSUS_2011_BASELINE.areaHectares} Ha</span>
                        </div>
                        <div className="village-glance-pill">
                            <span className="village-glance-pill-label">{isTe ? "పిన్ కోడ్" : "PIN"}:</span>
                            <span className="village-glance-pill-val" style={{ fontFamily: 'var(--font-mono)' }}>{CENSUS_2011_BASELINE.pin}</span>
                        </div>
                    </div>
                </div>

                {/* 4 Concise Evidence-Labeled Pillars Grid */}
                <div className="village-pillars-grid">
                    {/* Pillar 1: Administrative Jurisdiction */}
                    <div className="village-pillar-card">
                        <div>
                            <div className="village-pillar-header">
                                <div className="village-pillar-title-wrap">
                                    <div className="village-pillar-icon-box village-pillar-icon-blue">
                                        <Landmark size={18} />
                                    </div>
                                    <h3 className="village-pillar-title">
                                        {t?.pillarAdminTitle || 'Administrative Jurisdiction'}
                                    </h3>
                                </div>
                                <span className="village-pillar-evidence-tag evidence-tag-admin">
                                    {t?.evidenceAdmin || 'Official Admin Record'}
                                </span>
                            </div>
                            <div className="village-pillar-content">
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "గ్రామ పంచాయతీ: మోదవలస, డెంకాడ మండలం, విజయనగరం జిల్లా" : "Modavalasa Gram Panchayat under Denkada Mandal, Vizianagaram District"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "స్థానిక పాలన: మోదవలస గ్రామ సచివాలయ పౌర సేవా కేంద్రం" : "Local Governance: Modavalasa Grama Sachivalayam citizen services"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "శాసనసభ నియోజకవర్గం: నెల్లిమర్ల (136) | లోక్‌సభ: విజయనగరం" : "Assembly: Nellimarla (136) | Parliamentary: Vizianagaram"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pillar 2: Livelihood & Economy */}
                    <div className="village-pillar-card">
                        <div>
                            <div className="village-pillar-header">
                                <div className="village-pillar-title-wrap">
                                    <div className="village-pillar-icon-box village-pillar-icon-amber">
                                        <Store size={18} />
                                    </div>
                                    <h3 className="village-pillar-title">
                                        {t?.pillarLivelihoodTitle || 'Livelihood & Economy'}
                                    </h3>
                                </div>
                                <span className="village-pillar-evidence-tag evidence-tag-survey">
                                    {t?.evidenceSurvey || 'Community Survey Finding'}
                                </span>
                            </div>
                            <div className="village-pillar-content">
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "వ్యవసాయ రంగం: వరి, పప్పుధాన్యాలు మరియు వాణిజ్య పంటల సాగు" : "Agrarian base: Primary cultivation of paddy, pulses, and commercial crops"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "చేనేత క్లస్టర్లు: బీసీ కాలనీలోని సాంప్రదాయ చేనేత మగ్గాలు మరియు మహిళా సంఘాలు" : "Handloom clusters: Traditional weaver looms and women's self-help groups (BC Colony)"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "గ్రామీణ వ్యాపారాలు: పాడి కేంద్రాలు, మోటార్ రీవైండింగ్, పంప్ రిపేర్లు మరియు స్థానిక దుకాణాలు" : "Rural services: Dairy units, electrical pump repairs, and local provision stores"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pillar 3: Public Healthcare & Education */}
                    <div className="village-pillar-card">
                        <div>
                            <div className="village-pillar-header">
                                <div className="village-pillar-title-wrap">
                                    <div className="village-pillar-icon-box village-pillar-icon-emerald">
                                        <HeartPulse size={18} />
                                    </div>
                                    <h3 className="village-pillar-title">
                                        {t?.pillarInstitutionsTitle || 'Healthcare & Education'}
                                    </h3>
                                </div>
                                <span className="village-pillar-evidence-tag evidence-tag-institution">
                                    {t?.evidenceInstitution || 'Verified Local Institution'}
                                </span>
                            </div>
                            <div className="village-pillar-content">
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "ఆరోగ్య కేంద్రం: డెంకాడ ప్రాథమిక ఆరోగ్య కేంద్రం (PHC) ద్వారా ఓపీడీ మరియు వైద్య సేవలు" : "Primary healthcare anchored by Denkada Primary Health Centre (PHC)"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "గ్రామ ఆరోగ్య సేవలు: ఏఎన్ఎం, ఆశా కార్యకర్తల ద్వారా క్రమబద్ధమైన టీకాలు మరియు స్క్రీనింగ్" : "Village outreach: Scheduled immunization and NCD health screenings by ANM & ASHA"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "పాఠశాల విద్య: మధ్యాహ్న భోజనంతో ఎంపీపీఎస్ మోదవలస ప్రాథమిక పాఠశాల & అంగన్‌వాడీ" : "Education: MPPS Modavalasa Primary School with mid-day meals and Anganwadi"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pillar 4: Utilities & Infrastructure */}
                    <div className="village-pillar-card">
                        <div>
                            <div className="village-pillar-header">
                                <div className="village-pillar-title-wrap">
                                    <div className="village-pillar-icon-box village-pillar-icon-indigo">
                                        <Building2 size={18} />
                                    </div>
                                    <h3 className="village-pillar-title">
                                        {t?.pillarUtilitiesTitle || 'Utilities & Infrastructure'}
                                    </h3>
                                </div>
                                <span className="village-pillar-evidence-tag evidence-tag-observation">
                                    {t?.evidenceObservation || 'CSP Survey Observation'}
                                </span>
                            </div>
                            <div className="village-pillar-content">
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "తాగునీరు: ఆర్వో శుద్ధి ప్లాంట్ మరియు ఓవర్‌హెడ్ రిజర్వాయర్ సౌకర్యం (సర్వేలో పరిశీలించబడింది)" : "Drinking water: Functional RO purification plant and overhead reservoir observed"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "విద్యుత్ సరఫరా: గృహ విద్యుత్ సరఫరా మరియు వ్యవసాయ బోరుబావులకు షెడ్యూల్డ్ రోస్టర్" : "Grid electricity: Domestic supply grid with scheduled roster for agricultural borewells"}</span>
                                </div>
                                <div className="village-pillar-bullet">
                                    <span className="village-pillar-bullet-dot"></span>
                                    <span>{isTe ? "రవాణా మార్గాలు: నివాస వీధులలో అంతర్గత సిమెంట్ రోడ్లు; డెంకాడ, విజయనగరంకు పక్కా రోడ్డు" : "Connectivity: Internal CC paved residential lanes; all-weather road to Denkada & Vizianagaram"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Provenance Line */}
                <div className="village-provenance-bar">
                    <span>{isTe ? PROVENANCE_DISCLAIMER.te : PROVENANCE_DISCLAIMER.en}</span>
                </div>

                {/* CTA Navigation Buttons */}
                <div className="village-overview-actions">
                    <Link to="/village" className="btn btn-secondary btn-sm" style={{ fontWeight: 700 }}>
                        <span>{t?.viewVillageProfile || 'Explore Village Profile'}</span>
                        <ArrowRight size={14} />
                    </Link>
                    <Link to="/contacts" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
                        <span>{t?.viewCivicContacts || 'View Civic Contacts'}</span>
                        <ArrowRight size={14} />
                    </Link>
                    <Link to="/healthcare" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
                        <span>{t?.viewHealthcareServices || 'View Healthcare Services'}</span>
                        <ArrowRight size={14} />
                    </Link>
                </div>
            </section>

            {/* 3. Important Information & Verified Notices */}
            {(loading || announcements.length > 0) && (
                <section className="section-block">
                    <div style={{ background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'clamp(1.5rem, 2.5vw, 2.25rem)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-slate-100)', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} style={{ color: 'var(--color-blue-600)' }} />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--color-slate-900)' }}>
                                    Important Notices &amp; Announcements
                                </h3>
                                <span className="badge badge-verified" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
                                    Grama Panchayat Verified
                                </span>
                            </div>
                            <Link to="/announcements" className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem' }}>
                                <span>View All Notices</span>
                                <ArrowRight size={13} />
                            </Link>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="civic-card skeleton-card" style={{ height: '90px' }}></div>
                                ))
                            ) : (
                                announcements.map(a => (
                                    <Link
                                        key={a.id}
                                        to={`/announcements/${a.id}`}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            padding: '1.1rem 1.25rem',
                                            background: 'var(--color-slate-50)',
                                            border: '1px solid var(--color-slate-200)',
                                            borderRadius: 'var(--radius-md)',
                                            textDecoration: 'none',
                                            transition: 'transform 0.15s ease, border-color 0.15s ease'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                <span className="badge badge-alert" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                                                    {a.category || 'Public Notice'}
                                                </span>
                                                {a.event_date && (
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>
                                                        {new Date(a.event_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: '0 0 0.25rem', lineHeight: '1.3' }}>
                                                {getLocalized(a, 'title', lang)}
                                            </h4>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-blue-600)', marginTop: '0.5rem' }}>
                                            <span>Read details</span>
                                            <ArrowRight size={12} />
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* 4. Core Public Services Directory (6 Bento Hubs) */}
            <section className="section-block">
                <div className="section-head">
                    <div className="section-title-wrap">
                        <span className="badge badge-civic" style={{ marginBottom: '6px' }}>Public Services Gateway</span>
                        <h2 className="section-title">
                            {t?.citizenCornerTitle || 'Citizen Services Hub'}
                        </h2>
                    </div>
                    <p className="section-desc">
                        Direct, verified access to essential village services, welfare schemes, public facilities, and administrative contacts.
                    </p>
                </div>

                <div className="bento-service-grid">
                    {hubs.map((hub, idx) => (
                        <Link key={idx} to={hub.to} className={`bento-hub-card ${hub.theme}`}>
                            <div className="bento-hub-header">
                                <div className="bento-icon-box" aria-hidden="true">
                                    {hub.icon}
                                </div>
                            </div>
                            <div className="bento-hub-body">
                                <h3 className="bento-hub-title">{hub.title}</h3>
                                <p className="bento-hub-desc">{hub.desc}</p>
                            </div>
                            <div className="bento-hub-footer">
                                <span className="bento-action-label">{hub.actionText}</span>
                                <ArrowRight size={14} aria-hidden="true" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* 5. Curated Village Data Explorer (Interactive Tabbed Representation) */}
            <section className="section-block">
                <div className="section-head" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <span className="badge badge-verified" style={{ marginBottom: '6px' }}>Verified Directory</span>
                        <h2 className="section-title">Explore Village Records &amp; Services</h2>
                        <p className="section-desc">Curated entries verified against official government notifications and field survey findings.</p>
                    </div>
                </div>

                {/* Tab Navigation Controls */}
                <div className="civic-explorer-tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeExplorerTab === 'schemes'}
                        className={`civic-explorer-tab ${activeExplorerTab === 'schemes' ? 'active' : ''}`}
                        onClick={() => setActiveExplorerTab('schemes')}
                    >
                        <FileText size={16} />
                        <span>Welfare Schemes</span>
                        <span className="civic-explorer-tab-badge">{schemes.length}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeExplorerTab === 'contacts'}
                        className={`civic-explorer-tab ${activeExplorerTab === 'contacts' ? 'active' : ''}`}
                        onClick={() => setActiveExplorerTab('contacts')}
                    >
                        <Phone size={16} />
                        <span>Administration &amp; Contacts</span>
                        <span className="civic-explorer-tab-badge">{contacts.length}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeExplorerTab === 'facilities'}
                        className={`civic-explorer-tab ${activeExplorerTab === 'facilities' ? 'active' : ''}`}
                        onClick={() => setActiveExplorerTab('facilities')}
                    >
                        <Activity size={16} />
                        <span>Healthcare &amp; Schools</span>
                        <span className="civic-explorer-tab-badge">{healthcare.length + education.length}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeExplorerTab === 'businesses'}
                        className={`civic-explorer-tab ${activeExplorerTab === 'businesses' ? 'active' : ''}`}
                        onClick={() => setActiveExplorerTab('businesses')}
                    >
                        <Store size={16} />
                        <span>Artisans &amp; Local Economy</span>
                        <span className="civic-explorer-tab-badge">{businesses.length}</span>
                    </button>
                </div>

                {/* Tab Content Display Area */}
                <div>
                    {activeExplorerTab === 'schemes' && (
                        <div>
                            <div className="card-grid">
                                {schemes.map(s => (
                                    <SchemeCard key={s.id} scheme={s} lang={lang} t={t} variant="vertical" />
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 'clamp(2rem, 3.5vw, 3rem)' }}>
                                <Link to="/schemes" className="btn btn-secondary btn-sm">
                                    <span>Browse All Verified Schemes ({schemes.length})</span>
                                    <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    )}

                    {activeExplorerTab === 'contacts' && (
                        <div>
                            {/* 24x7 Statutory Helplines Quick Call Bar */}
                            <div className="quick-dial-bar" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.75rem', alignItems: 'center', background: 'var(--color-slate-50)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-slate-700)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Phone size={14} style={{ color: 'var(--color-red-600)' }} />
                                    {isTe ? "అత్యవసర హెల్ప్‌లైన్‌లు:" : "24x7 Emergency Helplines:"}
                                </span>
                                {[
                                    { code: '108', label: isTe ? '108 అంబులెన్స్' : '108 Ambulance', cls: 'btn-danger' },
                                    { code: '100', label: isTe ? '100 పోలీస్' : '100 Police', cls: 'btn-primary' },
                                    { code: '104', label: isTe ? '104 వైద్య సలహా' : '104 Health', cls: 'btn-secondary' },
                                    { code: '1912', label: isTe ? '1912 విద్యుత్' : '1912 Power', cls: 'btn-secondary' }
                                ].map(hl => (
                                    <a
                                        key={hl.code}
                                        href={createTelLink(hl.code)}
                                        className={`btn ${hl.cls} btn-sm`}
                                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', textDecoration: 'none' }}
                                        title={`Call ${hl.label}`}
                                    >
                                        <Phone size={12} style={{ marginRight: '4px' }} />
                                        <span>{hl.label}</span>
                                    </a>
                                ))}
                            </div>

                            <div className="card-grid">
                                {contacts.map(c => (
                                    <ContactCard key={c.id} contact={c} lang={lang} t={t} />
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 'clamp(2rem, 3.5vw, 3rem)' }}>
                                <Link to="/contacts" className="btn btn-secondary btn-sm">
                                    <span>View Complete Contact Directory</span>
                                    <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    )}

                    {activeExplorerTab === 'facilities' && (
                        <div>
                            <div className="card-grid">
                                {healthcare.map(f => (
                                    <HealthcareCard key={f.id} facility={f} lang={lang} t={t} variant="vertical" />
                                ))}
                                {education.map(inst => (
                                    <EducationCard key={inst.id} institution={inst} lang={lang} t={t} />
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: 'clamp(2rem, 3.5vw, 3rem)', flexWrap: 'wrap' }}>
                                <Link to="/healthcare" className="btn btn-secondary btn-sm">
                                    <span>PHC Operating Schedule</span>
                                    <ArrowRight size={14} />
                                </Link>
                                <Link to="/education" className="btn btn-secondary btn-sm">
                                    <span>School Facilities &amp; Mid-Day Meals</span>
                                    <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    )}

                    {activeExplorerTab === 'businesses' && (
                        <div>
                            {businesses.length > 0 ? (
                                <>
                                    <div className="card-grid">
                                        {businesses.map(b => (
                                            <BusinessCard key={b.id} business={b} lang={lang} t={t} />
                                        ))}
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: 'clamp(2rem, 3.5vw, 3rem)' }}>
                                        <Link to="/businesses" className="btn btn-secondary btn-sm">
                                            <span>View All Village Artisans &amp; Shops</span>
                                            <ArrowRight size={14} />
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div className="civic-card" style={{ padding: 'clamp(2rem, 3.5vw, 3rem)', textAlign: 'center', maxWidth: '680px', margin: '0 auto' }}>
                                    <Store size={38} style={{ color: 'var(--color-amber-600)', margin: '0 auto 1rem', display: 'block' }} />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.65rem' }}>
                                        {isTe ? "గ్రామ వాణిజ్య & చేనేత వివరాలు ధృవీకరణలో ఉన్నాయి" : "Village Enterprise Directory Under Verification"}
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', lineHeight: '1.65', marginBottom: '1.25rem' }}>
                                        {isTe 
                                            ? "మోదవలస పరిధిలోని చేనేత క్లస్టర్లు, పాల సేకరణ కేంద్రాలు మరియు స్థానిక దుకాణాల వివరాలు అధికారిక పంచాయతీ రికార్డులు మరియు క్షేత్ర సర్వే ఆధారంగా ధృవీకరించబడుతున్నాయి. డేటా ప్రామాణికత నిబంధనల ప్రకారం కల్పిత లేదా ధృవీకరించని రికార్డులు ప్రచురించబడవు."
                                            : "Local commercial, cooperative, and artisanal listings are being verified against official administrative registers and ground survey logs. In accordance with strict CSP data provenance gates, synthetic or unverified business entries are withheld from publication until individual record-level proof is established."
                                        }
                                    </p>
                                    <span className="badge badge-warning" style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.35rem 0.85rem' }}>
                                        {isTe ? "రికార్డుల స్థాయి ఆధారాల ధృవీకరణ పెండింగ్‌లో ఉంది" : "Audit Status: Pending Attributable Evidence"}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* 6. Habitation Demographics & Infrastructure Status */}
            <section className="section-block">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'clamp(1.75rem, 3vw, 2.5rem)', alignItems: 'start' }}>
                    {/* Left: Census 2011 Demographics */}
                    <div className="civic-card" style={{ padding: 'clamp(1.75rem, 2.8vw, 2.5rem)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
                            <Landmark size={18} style={{ color: 'var(--color-blue-600)' }} />
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                                Habitation Demographics
                            </h3>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                            Data Source: Census 2011 (Village Code: {CENSUS_2011_BASELINE.censusVillageCode}, Modavalasa)
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', lineHeight: '1.6', marginBottom: '1rem' }}>
                            Official administrative baseline figures under Denkada Mandal, Vizianagaram District.
                        </p>

                        <div className="demographics-factsheet-grid">
                            <div className="factsheet-stat-card">
                                <span className="factsheet-stat-label">Total Population</span>
                                <span className="factsheet-stat-value">{CENSUS_2011_BASELINE.population.toLocaleString()}</span>
                                <span className="factsheet-stat-sub">Census 2011 official</span>
                            </div>
                            <div className="factsheet-stat-card">
                                <span className="factsheet-stat-label">Households</span>
                                <span className="factsheet-stat-value">{CENSUS_2011_BASELINE.households}</span>
                                <span className="factsheet-stat-sub">Census 2011 official</span>
                            </div>
                            <div className="factsheet-stat-card">
                                <span className="factsheet-stat-label">Literacy Rate</span>
                                <span className="factsheet-stat-value">68.4%</span>
                                <span className="factsheet-stat-sub">Census 2011 official</span>
                            </div>
                            <div className="factsheet-stat-card">
                                <span className="factsheet-stat-label">Geographic Area</span>
                                <span className="factsheet-stat-value">{CENSUS_2011_BASELINE.areaHectares} Ha</span>
                                <span className="factsheet-stat-sub">Total village territory</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--color-slate-200)', fontSize: '0.75rem', color: 'var(--color-slate-500)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Unsurveyed metrics: <em>Not yet verified</em></span>
                            <Link to="/village" style={{ fontWeight: 600, color: 'var(--color-blue-600)' }}>Full Profile &rarr;</Link>
                        </div>
                    </div>

                    {/* Right: Infrastructure Observation Status Matrix */}
                    <div className="civic-card" style={{ padding: 'clamp(1.75rem, 2.8vw, 2.5rem)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
                            <CheckCircle2 size={18} style={{ color: 'var(--color-emerald-600)' }} />
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                                Civic Infrastructure Status
                            </h3>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                            CSP Ground Survey Observations (Verified Aug 2024)
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-600)', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                            Verifiable field assessments across key public utilities serving Modavalasa habitation.
                        </p>

                        <table className="infra-ledger-table" aria-label="Infrastructure status table">
                            <thead>
                                <tr>
                                    <th>Utility</th>
                                    <th>Observed Status</th>
                                    <th>Verification Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {infraObservations.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 700 }}>{item.service}</td>
                                        <td>{item.observation}</td>
                                        <td style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>{item.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* 7. Citizen Feedback & Verification Desk Callout */}
            <section className="section-block">
                <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', borderRadius: 'var(--radius-xl)', padding: 'clamp(2rem, 3.5vw, 3.25rem)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem', boxShadow: 'var(--shadow-md)' }}>
                    <div style={{ maxWidth: '640px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.75rem' }}>
                            <MessageSquare size={14} />
                            <span>Community Feedback Desk • Transparent Redressal</span>
                        </div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
                            Keep Village Records Accurate &amp; Verified
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6', margin: 0 }}>
                            Report outdated telephone numbers, modified clinic timings, or suggest local business and artisan listings. Track your submission status securely using your unique Reference ID.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <a
                            href={createTelLink('9951871501')}
                            className="btn btn-secondary"
                            style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)', fontWeight: 600, textDecoration: 'none' }}
                            title="Call Panchayat Secretary (V. V. Anuradha) - Denkada Mandal Official Directory"
                        >
                            <Phone size={15} style={{ marginRight: '4px' }} />
                            <span>{isTe ? "పంచాయతీ కార్యదర్శి: 99518-71501" : "Panchayat Secretary: 99518-71501"}</span>
                        </a>
                        <Link to="/feedback" className="btn btn-primary" style={{ background: 'var(--color-blue-600)', color: '#ffffff', fontWeight: 700, border: 'none' }}>
                            <span>Submit Record Update</span>
                            <ArrowRight size={15} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default HomePage;
