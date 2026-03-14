'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface ScannerSidebarProps {
    userName?: string;
    userRole?: string;
}

export default function ScannerSidebar({ userName, userRole }: ScannerSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [permissions, setPermissions] = useState<string[]>([]);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setPermissions(data.role_permisos || []);
                }
            } catch (e) { }
        };
        fetchUserData();
    }, []);

    // Determinar si una ruta está activa
    const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

    // Ajustar el margen del contenido principal según el estado del sidebar
    useEffect(() => {
        const root = document.documentElement;
        if (root && window.innerWidth > 992) {
            root.style.setProperty('--sidebar-width', isCollapsed ? '72px' : '260px');
        }
    }, [isCollapsed]);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);
    const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    const navLinks = [
        {
            href: '/escaner-codigos/escaner',
            label: 'Escáner Central',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 8v8M12 8v8M16 8v8" />
                </svg>
            )
        },
        {
            href: '/escaner-codigos/centro-solicitudes',
            label: 'Centro Solicitudes',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )
        },
        {
            href: '/escaner-codigos/productos',
            label: 'Agregar Producto',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            )
        },
        {
            href: '/escaner-codigos/cajas',
            label: 'Agregar Caja',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            )
        },
        {
            href: '/escaner-codigos/temporal',
            label: 'Sinc. Temporal',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            )
        },
        {
            href: '/escaner-codigos/historial',
            label: 'Historial',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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

    // Filtro de enlaces basado en permisos
    const filteredNavLinks = navLinks.filter(link => {
        if (['/dashboard'].includes(link.href)) return true;
        
        const permsMap: Record<string, string[]> = {
            '/escaner-codigos/escaner': ['escaneo-central'],
            '/escaner-codigos/centro-solicitudes': ['solicitudes'],
            '/escaner-codigos/productos': ['escaneo-productos'],
            '/escaner-codigos/cajas': ['escaneo-cajas'],
            '/escaner-codigos/temporal': ['temporal'],
            '/escaner-codigos/historial': ['escaneo-historial']
        };

        const required = permsMap[link.href];
        if (!required) return true;
        
        // El módulo temporal es universal por contingencia
        if (required.includes('temporal')) return true;

        return required.some(p => permissions.includes(p));
    });

    return (
        <>
            {/* Mobile Header Toggle */}
            <div className="mobile-header">
                <Link href="/dashboard" className="mobile-brand">Módulo Escaneo</Link>
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

                {/* Header / Brand */}
                <div className="sidebar-header">
                    <div className="brand-wrapper">
                        <div className="logo-box">
                            <img src="/logo.png" alt="Logo El Olivar" />
                        </div>
                        {!isCollapsed && (
                            <div className="brand-details">
                                <span className="brand-name">Módulo Escaneo</span>
                                <span className="brand-subtitle">El Olivar</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collapser (Desktop Only) */}
                <button className="collapse-btn" onClick={toggleSidebar}>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>

                {/* Navigation Links */}
                <div className="sidebar-content">
                    <nav className="sidebar-nav">
                        <ul className="nav-list">
                            {filteredNavLinks.map((link) => {
                                const active = isActive(link.href) && (link.href !== '/dashboard');
                                return (
                                    <li key={link.href} className="nav-item">
                                        <Link
                                            href={link.href}
                                            className={`flex items-center gap-[14px] px-[18px] h-[46px] rounded-[10px] transition-all relative w-full ${
                                                active 
                                                    ? 'text-white bg-gradient-to-r from-[#005d31] to-[#005d31]/40 shadow-[inset_4px_0_0_#acc62d,0_4px_20px_rgba(0,93,49,0.4)]' 
                                                    : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-white/10 hover:translate-x-1'
                                            } ${isCollapsed ? 'justify-center px-0 h-[48px]' : ''}`}
                                            title={isCollapsed ? link.label : ''}
                                            onClick={() => setIsMobileOpen(false)}
                                        >
                                            <span className={`flex items-center justify-center shrink-0 w-6 h-6 relative ${active ? 'text-[#acc62d] drop-shadow-[0_0_8px_rgba(172,198,45,0.6)]' : ''}`}>
                                                {link.icon}
                                            </span>
                                            {!isCollapsed && (
                                                <span className={`whitespace-nowrap leading-tight tracking-[0.01em] text-[0.95rem] ${active ? 'font-bold' : 'font-medium'}`}>
                                                    {link.label}
                                                </span>
                                            )}
                                            {isCollapsed && active && <div className="absolute right-1 top-1 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_white]" />}
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
                            <Link href="/escaner-codigos/perfil" className="user-profile-link" title="Ir a mi perfil" style={{ textDecoration: 'none' }}>
                                <div className="avatar">
                                    {userName.charAt(0).toUpperCase()}
                                </div>

                                {!isCollapsed && (
                                    <div className="user-details">
                                        <span className="user-name">{userName.split(' ')[0]}</span>
                                        <span className="user-role">{userRole?.toUpperCase() || 'TRABAJADOR'}</span>
                                    </div>
                                )}
                            </Link>

                            <button className="logout-btn" onClick={handleLogout} title="Cerrar Sesión">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </aside>


            {/* Global Styles for Scanner Sidebar Structure */}
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
                    font-size: 1.05rem;
                    white-space: nowrap;
                    color: #ffffff;
                    transition: opacity 0.2s;
                    line-height: 1.1;
                    display: block;
                }

                .brand-subtitle {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #acc62d; 
                    display: block;
                    letter-spacing: 0.01em;
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
                    gap: 14px;
                    padding: 0 18px;
                    text-decoration: none;
                    color: #94a3b8;
                    border-radius: 12px;
                    transition: all 0.2s ease;
                    position: relative;
                    height: 46px; 
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
                    background: linear-gradient(90deg, #005d31 0%, rgba(0, 93, 49, 0.4) 100%); 
                    box-shadow: inset 4px 0 0 #acc62d, 0 4px 20px rgba(0, 93, 49, 0.4);
                }
                
                .nav-link.active .nav-icon {
                    color: #acc62d;
                    filter: drop-shadow(0 0 8px rgba(172, 198, 45, 0.6));
                }
                
                .nav-link.active .nav-text {
                    font-weight: 700;
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
                    font-size: 0.95rem;
                    white-space: nowrap;
                    opacity: 1;
                    line-height: 1.2;
                    letter-spacing: 0.01em;
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
                    flex: 1;
                    overflow: hidden;
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
                    color: #b5b74b;
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

