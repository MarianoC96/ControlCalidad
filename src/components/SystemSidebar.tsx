'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SystemSidebarProps {
    userName?: string;
    userRole?: string;
}

export default function SystemSidebar({ userName, userRole }: SystemSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [pendingSolicitudes, setPendingSolicitudes] = useState(0);

    const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

    // Fetch pending counts for notification badges
    const fetchPendingCounts = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/pending-counts');
            if (res.ok) {
                const data = await res.json();
                setPendingSolicitudes(data.pendingSolicitudes || 0);
            }
        } catch (e) {
            // Silently fail
        }
    }, []);

    // On mount
    useEffect(() => {
        fetchPendingCounts();
        const interval = setInterval(fetchPendingCounts, 10000); // 10s polling as fallback
        return () => clearInterval(interval);
    }, [fetchPendingCounts]);

    // Realtime changes
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('system_sidebar_realtime_badges')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'edit_requests'
                },
                () => {
                    fetchPendingCounts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchPendingCounts]);


    // Adjust main content margin based on sidebar state
    useEffect(() => {
        const root = document.documentElement;
        if (root && window.innerWidth > 992) {
            root.style.setProperty('--sidebar-width', isCollapsed ? '72px' : '260px');
        }
    }, [isCollapsed]);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);
    const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

    const navLinks = [
        {
            href: '/control-sistema',
            label: 'Control de Sistema',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
            )
        },
        {
            href: '/control-sistema/gestion-usuarios',
            label: 'Gestión de Usuarios',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            )
        },
        {
            href: '/control-sistema/centro-solicitudes',
            label: 'Centro Solicitudes',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ),
            badge: pendingSolicitudes
        },
        {
            href: '/control-sistema/auditoria-accesos',
            label: 'Auditoría y Accesos',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            )
        },
        {
            href: '/control-sistema/config-reporte',
            label: 'Config. Reportes',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            )
        },
        {
            href: '/dashboard', 
            label: 'Volver a Dashboard',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            )
        }
    ];

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    return (
        <>
            {/* Mobile Header Toggle */}
            <div className="mobile-header">
                <Link href="/control-sistema" className="mobile-brand">Control Sistema</Link>
                <button className="mobile-toggle" onClick={toggleMobile} aria-label="Abrir menú">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
            </div>

            {/* Backdrop for Mobile */}
            {isMobileOpen && (
                <div className="mobile-backdrop" onClick={() => setIsMobileOpen(false)} />
            )}

            {/* Sidebar Container */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>

                <div className="sidebar-header">
                    <div className="brand-wrapper">
                        <div className="logo-box">
                            <img src="/logo.png" alt="Logo El Olivar" />
                        </div>
                        {!isCollapsed && (
                            <div className="brand-details">
                                <span className="brand-name">Control Sistema</span>
                                <span className="brand-subtitle">El Olivar</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collapser (Desktop Only) */}
                <button className="collapse-btn" onClick={toggleSidebar} title={isCollapsed ? "Expandir" : "Colapsar"} aria-label={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isCollapsed ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        )}
                    </svg>
                </button>

                {/* Navigation Links */}
                <div className="sidebar-content">
                    <nav className="sidebar-nav">
                        <ul className="nav-list">
                            {navLinks.map((link) => {
                                const badgeCount = link.badge || 0;
                                const active = isActive(link.href) && link.href !== '/dashboard'; // fix for highlighting issue
                                
                                return (
                                    <li key={link.href} className="nav-item">
                                        <Link
                                            href={link.href}
                                            className={`nav-link ${active ? 'active' : ''}`}
                                            title={isCollapsed ? link.label : ''}
                                            onClick={() => setIsMobileOpen(false)}
                                        >
                                            <span className="nav-icon">
                                                {link.icon}
                                                {badgeCount > 0 && isCollapsed && (
                                                    <span className="nav-badge-collapsed">{badgeCount > 99 ? '99+' : badgeCount}</span>
                                                )}
                                            </span>
                                            {!isCollapsed && <span className="nav-text">{link.label}</span>}
                                            {!isCollapsed && badgeCount > 0 && (
                                                <div className="nav-badge-bell" style={{ fontStyle: 'normal' }}>
                                                    <i className="bi bi-bell-fill bell-icon"></i>
                                                    <span className="badge-count">{badgeCount > 99 ? '99+' : badgeCount}</span>
                                                </div>
                                            )}
                                            {isCollapsed && active && <div className="active-dot" />}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </div>

                {/* User Footer */}
                {userName && (
                    <div className="sidebar-footer">
                        <div className="user-profile-container">
                            <Link href="/perfil" className="user-profile-link" title="Ir a mi perfil">
                                <div className="avatar">
                                    {userName.charAt(0).toUpperCase()}
                                </div>

                                {!isCollapsed && (
                                    <div className="user-details">
                                        <span className="user-name">{userName.split(' ')[0]}</span>
                                        <span className="user-role">ADMIN</span>
                                    </div>
                                )}
                            </Link>

                            <div className="flex items-center gap-1">
                                <button className="logout-btn" onClick={handleLogout} title="Cerrar Sesión" aria-label="Cerrar sesión">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Global Styles injected here for sidebar layout support */}
            <style jsx>{`
                /* Mobile Header */
                .mobile-header {
                    display: none;
                    background: white;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0.75rem 1rem;
                    align-items: center;
                    justify-content: space-between;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    height: 60px;
                }

                .mobile-brand {
                    font-weight: 700;
                    font-size: 1.25rem;
                    color: #1e293b;
                    text-decoration: none;
                }

                .mobile-toggle {
                    background: none;
                    border: none;
                    color: #475569;
                    cursor: pointer;
                    padding: 0.25rem;
                }

                .mobile-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 1001;
                    backdrop-filter: blur(2px);
                }

                /* Sidebar Base */
                .sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    width: 280px;
                    background-color: #003d1f; /* Verde más claro y vibrante */
                    color: #f1f5f9;
                    z-index: 1002;
                    display: flex;
                    flex-direction: column;
                    transition: width 0.3s ease, transform 0.3s ease;
                    box-shadow: 4px 0 24px rgba(0,0,0,0.1);
                }

                .sidebar.collapsed {
                    width: 72px;
                }

                /* Header */
                .sidebar-header {
                    height: 70px;
                    display: flex;
                    align-items: center;
                    padding: 0 1.25rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .sidebar.collapsed .sidebar-header {
                    padding: 0;
                    justify-content: center;
                }

                .brand-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .logo-box {
                    min-width: 85px;
                    height: 38px;
                    background: #ffffff;
                    color: var(--sidebar-bg);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    padding: 4px 6px;
                }
                
                .logo-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .brand-name {
                    font-weight: 800;
                    font-size: 0.95rem;
                    white-space: nowrap;
                    color: #ffffff;
                    transition: opacity 0.2s;
                    line-height: 1;
                    display: block;
                }

                .brand-subtitle {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: #acc62d; /* Gold según la imagen */
                    display: block;
                    letter-spacing: 0.02em;
                }

                /* Collapse Button */
                .collapse-btn {
                    position: absolute;
                    top: 24px;
                    right: -12px;
                    width: 24px;
                    height: 24px;
                    background: #fff;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    z-index: 10;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .sidebar:hover .collapse-btn {
                    opacity: 1;
                }

                /* Nav List */
                .sidebar-content {
                    flex: 1;
                    padding: 2rem 0;
                    overflow-y: auto;
                    scrollbar-width: none;
                }

                .nav-list {
                    list-style: none;
                    margin: 0;
                    padding: 0 1.25rem;
                    display: flex;
                    flex-direction: column;
                }

                .sidebar.collapsed .nav-list {
                    padding: 0 0.75rem;
                }

                .nav-item {
                    width: 100%;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding-bottom: 0.75rem;
                    margin-bottom: 0.75rem;
                }

                .nav-item:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                    margin-bottom: 0;
                }

                .nav-link {
                    display: flex !important;
                    align-items: center;
                    flex-direction: row !important;
                    flex-wrap: nowrap;
                    gap: 12px;
                    padding: 0 16px;
                    text-decoration: none;
                    color: #94a3b8;
                    border-radius: 10px;
                    transition: all 0.2s ease;
                    position: relative;
                    height: 42px; /* Compacto */
                    width: 100%;
                    box-sizing: border-box;
                }

                .sidebar.collapsed .nav-link {
                    padding: 0;
                    justify-content: center;
                    height: 48px;
                }

                .nav-link:hover {
                    color: #f1f5f9;
                    background: rgba(255,255,255,0.08);
                    transform: translateX(4px);
                }

                .nav-link.active {
                    color: #fff;
                    background: #005d31;
                    box-shadow: 0 4px 20px rgba(0, 93, 49, 0.3);
                }
                
                .nav-link.active:hover {
                    transform: none;
                }

                .nav-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    width: 24px;
                    height: 24px;
                    position: relative;
                }
                
                .nav-icon svg { 
                    width: 22px; 
                    height: 22px; 
                }

                .nav-text {
                    font-weight: 500;
                    font-size: 0.85rem;
                    white-space: nowrap;
                    opacity: 1;
                    line-height: 1.2;
                    letter-spacing: 0.01em;
                }

                /* Notification Bell */
                .nav-badge-bell {
                    margin-left: auto;
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                }

                .bell-icon {
                    color: #ef4444;
                    font-size: 1.1rem;
                    animation: bell-shake 2s infinite ease-in-out;
                    filter: drop-shadow(0 2px 4px rgba(239, 68, 68, 0.4));
                }

                .badge-count {
                    position: absolute;
                    top: -6px;
                    right: -8px;
                    background: #dc2626;
                    color: white;
                    font-size: 0.65rem;
                    font-weight: 800;
                    min-width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50px;
                    padding: 0 4px;
                    border: 2px solid var(--sidebar-bg);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    z-index: 2;
                }

                @keyframes bell-shake {
                    0%, 15%, 100% { transform: rotate(0); }
                    5% { transform: rotate(15deg); }
                    10% { transform: rotate(-15deg); }
                }

                .nav-badge-collapsed {
                    position: absolute;
                    top: -4px;
                    right: -6px;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    font-size: 0.6rem;
                    font-weight: 800;
                    min-width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50px;
                    padding: 0 4px;
                    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
                    animation: badge-pulse 2s infinite;
                    z-index: 5;
                }

                @keyframes badge-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
                    70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }

                .active-dot {
                    position: absolute;
                    right: 4px;
                    top: 4px;
                    width: 6px;
                    height: 6px;
                    background: #fff;
                    border-radius: 50%;
                }

                /* Footer */
                .sidebar-footer {
                    padding: 1.5rem 1rem;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                .sidebar.collapsed .sidebar-footer {
                    padding: 1.5rem 0;
                    display: flex;
                    justify-content: center;
                }

                .user-profile-container {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.5rem;
                    background: rgba(0,0,0,0.2);
                    padding: 0.5rem;
                    border-radius: 12px;
                    overflow: hidden;
                    transition: background 0.2s;
                }

                .user-profile-link {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    text-decoration: none;
                    flex: 1;
                    overflow: hidden;
                }
                
                .user-profile-link:hover .user-name {
                    color: var(--primary-color);
                }

                .sidebar.collapsed .user-profile-container {
                    background: transparent;
                    padding: 0.5rem 0;
                    justify-content: center;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .avatar {
                    width: 40px;
                    height: 40px;
                    background: #111827;
                    border: 2px solid #b5b74b;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 1rem;
                    flex-shrink: 0;
                    transition: transform 0.2s;
                }
                
                .user-profile-link:hover .avatar {
                    transform: scale(1.05);
                }

                .user-details {
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .user-name {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #fff;
                    white-space: nowrap;
                    transition: color 0.2s;
                }

                .user-role {
                    font-size: 0.70rem;
                    font-weight: 800;
                    color: #b5b74b; /* Verde olivo / dorado */
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    white-space: nowrap;
                }

                .logout-btn {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 8px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    margin-left: 4px;
                }

                .logout-btn:hover {
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                }

                /* Mobile Styles */
                @media (max-width: 992px) {
                    .mobile-header { display: flex; }
                    .collapse-btn { display: none; }
                    
                    .sidebar {
                        transform: translateX(-100%);
                        width: 280px;
                    }

                    .sidebar.mobile-open {
                        transform: translateX(0);
                    }
                }
            `}</style>
        </>
    );
}

