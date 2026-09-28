import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { 
    X, Home, FileText, Phone, Activity, GraduationCap, 
    Store, Bell, Landmark, MessageSquare, ClipboardList, 
    BarChart3, Lock, LogOut 
} from 'lucide-react';

export function MobileDrawer({ isOpen, onClose, user, isAdmin, onSignOut }) {
    const drawerRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const navLinks = [
        { to: '/', label: 'Home', icon: <Home size={18} /> },
        { to: '/schemes', label: 'Welfare Schemes', icon: <FileText size={18} /> },
        { to: '/contacts', label: 'Emergency & Contacts', icon: <Phone size={18} /> },
        { to: '/healthcare', label: 'Primary Healthcare', icon: <Activity size={18} /> },
        { to: '/education', label: 'Schools & Education', icon: <GraduationCap size={18} /> },
        { to: '/businesses', label: 'Local Artisans & Businesses', icon: <Store size={18} /> },
        { to: '/announcements', label: 'Notices & Announcements', icon: <Bell size={18} /> },
        { to: '/village', label: 'Village Information', icon: <Landmark size={18} /> },
        { to: '/feedback', label: 'Citizen Feedback', icon: <MessageSquare size={18} /> },
        { to: '/survey', label: 'Field Survey Form', icon: <ClipboardList size={18} /> },
        { to: '/dashboard', label: 'Survey Analytics', icon: <BarChart3 size={18} /> },
        ...(isAdmin ? [{ to: '/admin', label: 'Admin Console', icon: <Lock size={18} /> }] : [])
    ];

    return (
        <div className="mobile-drawer-overlay" onClick={onClose}>
            <div 
                className="mobile-drawer" 
                ref={drawerRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="mobile-drawer-header">
                    <span style={{ fontWeight: 800, color: 'var(--color-slate-900)', fontSize: '1.05rem' }}>
                        Menu
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-slate-500)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                        aria-label="Close menu"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="mobile-drawer-content">
                    {navLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === '/'}
                            className={({ isActive }) => `drawer-nav-item ${isActive ? 'active' : ''}`}
                            onClick={onClose}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </NavLink>
                    ))}

                    {user && (
                        <button
                            type="button"
                            className="drawer-nav-item"
                            onClick={() => {
                                onSignOut();
                                onClose();
                            }}
                            style={{ color: 'var(--color-red-600)', marginTop: '0.5rem', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                        >
                            <LogOut size={18} />
                            <span>Sign Out ({user.email})</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MobileDrawer;
