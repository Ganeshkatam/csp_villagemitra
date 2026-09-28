import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Phone, Menu, X, Landmark, LogOut } from 'lucide-react';
import { useAppContext } from '../../app/providers';
import { contactService } from '../../features/contacts/api/contacts';
import { authService } from '../../lib/auth';
import { createTelLink } from '../../utils/phone';
import { MobileDrawer } from './MobileDrawer';

export function Header() {
    const { lang, toggleLang, textZoom, setTextZoom, user, isAdmin, t } = useAppContext();
    const [helplines, setHelplines] = useState([]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        contactService.getEmergencyHelplines().then(data => {
            if (data && data.length > 0) setHelplines(data);
        });
    }, []);

    const handleSignOut = async () => {
        await authService.signOut();
        navigate('/');
    };

    return (
        <header className="clean-site-header" role="banner">
            <div className="top-civic-stripe" aria-hidden="true"></div>

            {/* Micro Utility Bar */}
            <div className="clean-utility-bar">
                <div className="container utility-inner">
                    <div className="utility-govt">
                        <span className="utility-flag-dot" aria-hidden="true"></span>
                        <span className="utility-govt-text">
                            {t?.projectBadge || 'Community Service Project (CSP) • Department of CSE'}
                        </span>
                    </div>

                    <div className="utility-actions">
                        <div className="utility-helplines">
                            <span className="helpline-label">24x7 Helplines:</span>
                            {helplines.slice(0, 3).map(hl => (
                                <a 
                                    key={hl.phone}
                                    href={createTelLink(hl.phone)} 
                                    className={`helpline-pill ${hl.phone === '108' ? 'helpline-red' : hl.phone === '100' ? 'helpline-blue' : 'helpline-green'}`} 
                                    title={`${hl.name} (${hl.phone})`}
                                >
                                    <Phone size={10} style={{ marginRight: '3px' }} aria-hidden="true" />
                                    <span>{hl.phone} {hl.phone === '108' ? 'Ambulance' : hl.phone === '100' ? 'Police' : 'Health'}</span>
                                </a>
                            ))}
                        </div>

                        <span className="utility-divider">|</span>

                        <div className="utility-tools">
                            <button
                                type="button"
                                className={`tool-btn ${textZoom === 'normal' ? 'active' : ''}`}
                                onClick={() => setTextZoom('normal')}
                                title="Standard font size"
                                aria-label="Standard font size"
                            >
                                A
                            </button>
                            <button
                                type="button"
                                className={`tool-btn ${textZoom === 'large' ? 'active' : ''}`}
                                onClick={() => setTextZoom('large')}
                                title="Enlarged font size"
                                aria-label="Enlarged font size"
                            >
                                A+
                            </button>
                            <button
                                type="button"
                                className="lang-toggle-btn"
                                onClick={toggleLang}
                                title="Switch Language / భాష మార్చండి"
                                aria-label="Switch Language / భాష మార్చండి"
                            >
                                {lang === 'en' ? 'తెలుగు' : 'English'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Navigation Bar */}
            <div className="clean-main-nav">
                <div className="container main-nav-inner">
                    <Link to="/" className="nav-brand">
                        <div className="nav-emblem" aria-hidden="true">
                            <Landmark size={20} />
                        </div>
                        <div className="nav-brand-text">
                            <span className="nav-brand-title">{t?.portalTitleEn || 'VILLAGE MITRA'}</span>
                            <span className="nav-brand-sub">{t?.portalSubtitle || 'Village Information Gateway'}</span>
                        </div>
                    </Link>

                    {/* Desktop Navigation Links */}
                    <nav className="nav-menu desktop-nav-only" aria-label="Main Navigation">
                        <NavLink to="/" end className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Home
                        </NavLink>
                        <NavLink to="/schemes" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Schemes
                        </NavLink>
                        <NavLink to="/contacts" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Contacts
                        </NavLink>
                        <NavLink to="/healthcare" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Health
                        </NavLink>
                        <NavLink to="/education" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Schools
                        </NavLink>
                        <NavLink to="/businesses" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Businesses
                        </NavLink>
                        <NavLink to="/announcements" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Notices
                        </NavLink>
                        <NavLink to="/village" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Village
                        </NavLink>
                        <NavLink to="/feedback" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Feedback
                        </NavLink>
                        <NavLink to="/survey" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Survey
                        </NavLink>
                        <NavLink to="/dashboard" className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}>
                            Analytics
                        </NavLink>
                        {isAdmin && (
                            <NavLink to="/admin" className={({ isActive }) => `menu-link admin-btn ${isActive ? 'active' : ''}`}>
                                Admin Console
                            </NavLink>
                        )}
                        {user && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={handleSignOut}
                                title="Sign Out"
                                aria-label="Sign Out"
                                style={{ marginLeft: '4px' }}
                            >
                                <LogOut size={15} />
                            </button>
                        )}
                    </nav>

                    {/* Mobile Controls */}
                    <div className="mobile-header-actions">
                        <button
                            type="button"
                            className="mobile-lang-chip"
                            onClick={toggleLang}
                            aria-label="Switch Language / భాష మార్చండి"
                        >
                            {lang === 'en' ? 'తెలుగు' : 'EN'}
                        </button>
                        <button
                            type="button"
                            className="mobile-hamburger-btn"
                            onClick={() => setDrawerOpen(!drawerOpen)}
                            aria-label="Toggle navigation menu"
                            aria-expanded={drawerOpen}
                        >
                            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Slide-Out Drawer */}
            <MobileDrawer 
                isOpen={drawerOpen} 
                onClose={() => setDrawerOpen(false)} 
                user={user}
                isAdmin={isAdmin}
                onSignOut={handleSignOut}
            />
        </header>
    );
}

export default Header;
