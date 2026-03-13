'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPendingCount } from '@/lib/temporal-db';
import { createClient } from '@/lib/supabase/client';

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
  // Start with server-safe defaults to avoid hydration mismatch
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Hydrate from sessionStorage on client mount (after first render)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('nav_permisos');
      if (cached) {
        setAllowedModules(JSON.parse(cached));
        setPermissionsLoaded(true);
      }
    } catch { }
  }, []);
  const [pendingSolicitudes, setPendingSolicitudes] = useState(0);
  const [pendingTemporales, setPendingTemporales] = useState(0);

  const isActive = (path: string) => pathname === path;

  // Fetch permissions on mount and update cache
  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/permisos');
      if (res.ok) {
        const data = await res.json();
        const modules = data.allowedModules || [];
        setAllowedModules(modules);
        try { sessionStorage.setItem('nav_permisos', JSON.stringify(modules)); } catch { }
      }
    } catch (e) {
      console.error('Error fetching permissions:', e);
    } finally {
      setPermissionsLoaded(true);
    }
  }, []);

  // Fetch pending counts for notification badges
  const fetchPendingCounts = useCallback(async () => {
    try {
      // Solicitudes pendientes (from API, only meaningful for admins)
      const res = await fetch('/api/admin/pending-counts');
      if (res.ok) {
        const data = await res.json();
        setPendingSolicitudes(data.pendingSolicitudes || 0);
      }
    } catch (e) {
      // Silently fail if offline or not admin
    }

    try {
      // Temporales pendientes (from IndexedDB)
      const count = await getPendingCount();
      setPendingTemporales(count);
    } catch (e) {
      // IndexedDB not available
    }
  }, []);

  // On mount: fetch permissions and pending counts IN PARALLEL
  useEffect(() => {
    Promise.all([fetchPermissions(), fetchPendingCounts()]);
  }, [fetchPermissions, fetchPendingCounts]);

  // Poll pending counts every 10 seconds (fallback)
  useEffect(() => {
    const interval = setInterval(fetchPendingCounts, 10000);
    return () => clearInterval(interval);
  }, [fetchPendingCounts]);

  // 🔥 Realtime Subscription for instant badge updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('navbar_realtime_badges')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'edit_requests'
        },
        () => {
          // Whenever something changes in edit_requests, fetch the new count
          fetchPendingCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingCounts]);

  // Ajustar el margen del contenido principal según el estado del sidebar
  useEffect(() => {
    const root = document.documentElement;
    if (window.innerWidth > 992) {
      root.style.setProperty('--sidebar-width', isCollapsed ? '72px' : '260px');
    }
  }, [isCollapsed]);

  const navLinks = [
    {
      href: '/control-calidad/registro-productos',
      label: 'Registrar',
      moduleKey: 'registro-productos',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      ),
    },
    {
      href: '/control-calidad/historial',
      label: 'Historial',
      moduleKey: 'historial',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      ),
    },
    {
      href: '/control-calidad/registros-modificados',
      label: 'Registros Modificados',
      moduleKey: 'registros-modificados',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      ),
    },
    {
      href: '/control-calidad/historial-descargas',
      label: 'Historial de descargas masivas',
      moduleKey: 'historial-descargas',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.5.5 0 0 1 0-1h2.688C13.979 10 15 8.988 15 7.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 2.825 10.328 1 8 1a4.53 4.53 0 0 0-2.941 1.1c-.757.652-1.153 1.438-1.153 2.055v.448l-.445.049C2.064 4.805 1 5.952 1 7.318 1 8.785 2.23 10 3.781 10H6a.5.5 0 0 1 0 1H3.781C1.708 11 0 9.366 0 7.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" /></svg>
      ),
    },
    {
      href: '/control-calidad/centro-solicitudes',
      label: 'Solicitudes',
      moduleKey: 'solicitudes',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      ),
    },
    {
      href: '/control-calidad/productos',
      label: 'Productos',
      moduleKey: 'productos',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      ),
    },
    {
      href: '/control-calidad/parametros-maestros',
      label: 'Parámetros',
      moduleKey: 'parametros-maestros',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
      ),
    },
    {
      href: '/control-calidad/temporal',
      label: 'Temporal',
      moduleKey: 'temporal',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      ),
    },
    {
      href: '/dashboard',
      label: 'Volver a Dashboard',
      moduleKey: 'dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
      ),
    }
  ];

  // Map of moduleKey -> pending count for badge display
  const pendingBadges: Record<string, number> = {
    'solicitudes': pendingSolicitudes,
    'temporal': pendingTemporales,
  };

  const filteredLinks = permissionsLoaded
    ? navLinks.filter(link => allowedModules.includes(link.moduleKey) || link.moduleKey === 'temporal' || link.moduleKey === 'dashboard')
    : [];

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
        <Link href="/control-calidad/registro-productos" className="mobile-brand">Control Calidad - El Olivar</Link>
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
            {!isCollapsed && <span className="brand-name">
              <span className="block text-sm">Control Calidad</span>
              <span className="block text-xs text-[#969836] font-semibold">El Olivar</span>
            </span>}
          </div>
        </div>

        {/* Collapser (Desktop Only) */}
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
              {filteredLinks.map((link) => {
                const badgeCount = pendingBadges[link.moduleKey] || 0;
                return (
                  <li key={link.href} className="nav-item">
                    <Link
                      href={link.href}
                      className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
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
                        <div className="nav-badge-bell" style={{ marginRight: 'auto' }}>
                          <i className="bi bi-bell-fill bell-icon"></i>
                          <span className="badge-count">{badgeCount > 99 ? '99+' : badgeCount}</span>
                        </div>
                      )}
                      {isCollapsed && isActive(link.href) && <div className="active-dot" />}
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
                    <span className="user-role">{userRole === 'administrador' ? 'Admin' : 'Staff'}</span>
                  </div>
                )}
              </Link>

              <div className="flex items-center gap-1">
                <button className="logout-btn" onClick={handleDefaultLogout} title="Cerrar Sesión" aria-label="Cerrar sesión">
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
                    background: #ffffff;
                    color: var(--sidebar-bg);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    padding: 4px;
                }
                
                .logo-box img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .brand-box svg { width: 20px; height: 20px; }

                .brand-name {
                    font-weight: 700;
                    font-size: 1.05rem;
                    white-space: nowrap;
                    color: #fff;
                    opacity: 1;
                    transition: opacity 0.2s;
                    line-height: 1.2;
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
                    position: relative;
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

                /* Notification Bell (expanded sidebar) */
                .nav-badge-bell {
                    margin-left: 8px; /* Espacio pequeño después del texto */
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                }

                .bell-icon {
                    color: #ef4444; /* Rojo llamativo */
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
                    font-size: 0.65rem; /* Un poco más legible */
                    font-weight: 800;
                    min-width: 16px;
                    height: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50px;
                    padding: 0 4px;
                    border: 2px solid var(--sidebar-bg); /* O border para simular recorte */
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    z-index: 2;
                }

                @keyframes bell-shake {
                    0%, 15%, 100% { transform: rotate(0); }
                    5% { transform: rotate(15deg); }
                    10% { transform: rotate(-15deg); }
                }

                /* Notification Badge (collapsed sidebar) */
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
