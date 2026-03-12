'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Navbar';
import ScannerSidebar from '@/components/ScannerSidebar';
import SystemSidebar from '@/components/SystemSidebar';
import { useState, useEffect } from 'react';

// Pages that should NOT show the sidebar
const PUBLIC_PATHS = ['/', '/olvide-password', '/restablecer-password', '/dashboard'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicPage = PUBLIC_PATHS.includes(pathname);
    const isScannerPath = pathname.startsWith('/escaner-codigos');
    const isSystemPath = pathname.startsWith('/control-sistema') || pathname.startsWith('/solicitudes');

    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState<'administrador' | 'trabajador'>('trabajador');

    useEffect(() => {
        const loadUserData = async () => {
            // 1. Intentar con cookies primero (más rápido)
            const getCookie = (name: string) => {
                const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
                return v ? decodeURIComponent(v[2]) : '';
            };

            let name = getCookie('user_name');
            let role = getCookie('user_role');

            // 2. Si no hay cookies, consultar a la API de sesión (fuente de verdad)
            if (!name) {
                try {
                    const res = await fetch('/api/auth/me');
                    if (res.ok) {
                        const data = await res.json();
                        name = data.nombre_completo || data.usuario;
                        role = data.roles;
                    }
                } catch (e) {
                    console.error('Error loading user data in AppShell:', e);
                }
            }

            setUserName(name || 'Usuario');
            setUserRole((role as any) || 'trabajador');
        };

        if (!isPublicPage) {
            loadUserData();
        }
    }, [pathname, isPublicPage]);

    if (isPublicPage) {
        return <>{children}</>;
    }

    return (
        <>
            {isScannerPath ? (
                <ScannerSidebar userName={userName} userRole={userRole} />
            ) : isSystemPath ? (
                <SystemSidebar userName={userName} userRole={userRole} />
            ) : (
                <Sidebar userName={userName} userRole={userRole} />
            )}
            {children}
        </>
    );
}
