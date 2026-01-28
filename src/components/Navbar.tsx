'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface NavbarProps {
  userName?: string;
  userRole?: 'administrador' | 'trabajador';
  onLogout?: () => void;
}

export default function Sidebar({ userName, userRole, onLogout }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (path: string) => pathname === path;
  const isAdmin = userRole === 'administrador';

  // Ajustar el margen del contenido principal según el estado del sidebar
  useEffect(() => {
    const root = document.documentElement;
    const sidebarWidth = isCollapsed ? '72px' : '260px'; // Variables CSS

    // En móvil no empujamos el contenido, el sidebar es un overlay
    if (window.innerWidth > 992) {
      root.style.setProperty('--sidebar-width', sidebarWidth);
    } else {
      root.style.setProperty('--sidebar-width', '0px');
    }

    const handleResize = () => {
      if (window.innerWidth > 992) {
        root.style.setProperty('--sidebar-width', isCollapsed ? '72px' : '260px');
      } else {
        root.style.setProperty('--sidebar-width', '0px');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  const navLinks = [
    {
      href: '/registro-productos',
      label: 'Registrar',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      ),
      adminOnly: false
    },
    {
      href: '/registros',
      label: 'Historial',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      ),
      adminOnly: false
    },
    // Admin Group
    {
      href: '/productos',
      label: 'Productos',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      ),
      adminOnly: true
    },
    {
      href: '/parametros-maestros',
      label: 'Parámetros',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
      ),
      adminOnly: true
    },
    {
      href: '/usuarios',
      label: 'Usuarios',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ),
      adminOnly: true
    },
  ];

  const filteredLinks = navLinks.filter(link => !link.adminOnly || isAdmin);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  const handleDefaultLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }

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
        <Link href="/registro-productos" className="mobile-brand">Control Calidad</Link>
        <button className="mobile-toggle" onClick={toggleMobile}>
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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            {!isCollapsed && <span className="brand-name">Control Calidad</span>}
          </div>
        </div>

        {/* Collapser (Desktop Only) */}
        <button className="collapse-btn" onClick={toggleSidebar} title={isCollapsed ? "Expandir" : "Colapsar"}>
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
              {filteredLinks.map((link) => (
                <li key={link.href} className="nav-item">
                  <Link
                    href={link.href}
                    className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
                    title={isCollapsed ? link.label : ''}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <span className="nav-icon">{link.icon}</span>
                    {!isCollapsed && <span className="nav-text">{link.label}</span>}
                    {isCollapsed && isActive(link.href) && <div className="active-dot" />}
                  </Link>
                </li>
              ))}
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
                    <span className="user-role">{userRole === 'administrador' ? 'Admin' : 'Staff'}</span>
                  </div>
                )}
              </Link>

              <button className="logout-btn" onClick={handleDefaultLogout} title="Cerrar Sesión">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Global Styles injected here for sidebar layout support */}
      <style jsx global>{`
                :root {
                    --sidebar-width: 0px; 
                    --sidebar-bg: #1e293b;
                    --sidebar-text: #e2e8f0;
                    --primary-color: #10b981;
                }

                @media (min-width: 993px) {
                    body {
                        padding-left: var(--sidebar-width);
                        transition: padding-left 0.3s ease;
                        padding-top: 0 !important; /* Override previous navbar padding */
                    }
                }
            `}</style>

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
                    width: 260px;
                    background-color: var(--sidebar-bg);
                    color: var(--sidebar-text);
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
                    padding: 0 1.5rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .sidebar.collapsed .sidebar-header {
                    padding: 0;
                    justify-content: center;
                }

                .brand-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    overflow: hidden;
                }

                .logo-box {
                    min-width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
                }

                .brand-box svg { width: 20px; height: 20px; }

                .brand-name {
                    font-weight: 700;
                    font-size: 1.1rem;
                    white-space: nowrap;
                    color: #fff;
                    opacity: 1;
                    transition: opacity 0.2s;
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

                .rotate-180 { transform: rotate(180deg); }

                /* Nav List */
                .sidebar-content {
                    flex: 1;
                    padding: 2rem 0; /* Más aire arriba y abajo */
                    overflow-y: auto;
                    scrollbar-width: none;
                }

                .nav-list {
                    list-style: none;
                    margin: 0;
                    padding: 0 1.25rem; /* Más margen lateral */
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem; /* Separación entre items */
                }

                .sidebar.collapsed .nav-list {
                    padding: 0 0.75rem;
                }

                .nav-item {
                    width: 100%;
                }

                /* Separador visual opcional entre grupos si se desea lógica futura */
                .nav-item:nth-child(2) {
                    margin-bottom: 1.5rem; /* Separar Historial de Productos */
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding-bottom: 1.5rem;
                }

                .nav-link {
                    display: flex !important;
                    align-items: center;
                    flex-direction: row !important; /* Forzar fila SIEMPRE */
                    flex-wrap: nowrap;
                    gap: 16px;              /* Más espacio entre icono y texto */
                    padding: 0 20px;        /* Botones más anchos internamente */
                    text-decoration: none;
                    color: #94a3b8;
                    border-radius: 12px;    /* Bordes más redondeados */
                    transition: all 0.2s ease;
                    position: relative;
                    height: 52px;           /* Botones más altos */
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
                    transform: translateX(4px); /* Pequeña animación de hover */
                }

                .nav-link.active {
                    color: #fff;
                    background: var(--primary-color);
                    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3); /* Sombra más suave y amplia */
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
                }
                
                .nav-icon svg { 
                    width: 22px; 
                    height: 22px; 
                }

                .nav-text {
                    font-weight: 500;
                    font-size: 1rem; /* Texto un poco más grande */
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
                    justify-content: space-between; /* Separar perfil de logout */
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
                    flex: 1; /* Ocupar espacio disponible */
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
                    background: #6366f1;
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
                    font-size: 0.75rem;
                    color: #94a3b8;
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
                    
                    /* Reset body padding for mobile handled by global jsx now */
                }
            `}</style>
    </>
  );
}
