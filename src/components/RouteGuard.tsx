'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Map URL paths to module keys
const PATH_TO_MODULE: Record<string, string> = {
    // Control de Calidad
    '/control-calidad': 'control-calidad',
    '/control-calidad/registro-productos': 'registro-productos',
    '/control-calidad/historial': 'historial',
    '/control-calidad/registros-modificados': 'registros-modificados',
    '/control-calidad/historial-descargas': 'historial-descargas',
    '/control-calidad/productos': 'productos',
    '/control-calidad/parametros-maestros': 'parametros-maestros',
    '/control-calidad/centro-solicitudes': 'solicitudes',
    '/control-calidad/temporal': 'temporal',

    // Control de Sistema
    '/control-sistema': 'control-sistema',
    '/control-sistema/gestion-usuarios': 'usuarios',
    '/control-sistema/centro-solicitudes': 'solicitudes',
    '/control-sistema/auditoria-accesos': 'accesos',
    '/control-sistema/config-reporte': 'admin/config-reportes',

    // Escaneo
    '/escaner-codigos': 'escaneo',
    '/escaner-codigos/escaner': 'escaneo',
    '/escaner-codigos/centro-solicitudes': 'solicitudes',
};

interface RouteGuardProps {
    children: React.ReactNode;
    moduleKey?: string; // optional override
}

export default function RouteGuard({ children, moduleKey }: RouteGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const key = moduleKey || PATH_TO_MODULE[pathname];

        // No module restriction for this path
        if (!key) {
            setAuthorized(true);
            setChecking(false);
            return;
        }

        // Temporal module is always accessible (critical contingency)
        if (key === 'temporal') {
            setAuthorized(true);
            setChecking(false);
            return;
        }

        // WHY: Always verify against the API instead of trusting sessionStorage.
        // The cache can contain stale permissions from a previous user session
        // (e.g., sadmin → test user switch), causing unauthorized access.
        // The API call is fast enough and the RouteGuard already shows a loading state.

        // 2) Fall back to API (only when cache miss or module not in cache)
        const checkPermission = async () => {
            try {
                const res = await fetch('/api/auth/permisos');
                if (!res.ok) {
                    router.replace('/');
                    return;
                }

                const data = await res.json();
                const allowed: string[] = data.allowedModules || [];

                // Update cache for future navigations
                try { sessionStorage.setItem('nav_permisos', JSON.stringify(allowed)); } catch { }

                if (allowed.includes(key)) {
                    setAuthorized(true);
                } else {
                    // Redirect to first allowed module or home
                    const firstAllowed = allowed[0];
                    if (firstAllowed) {
                        const entry = Object.entries(PATH_TO_MODULE).find(([, v]) => v === firstAllowed);
                        router.replace(entry ? entry[0] : '/');
                    } else {
                        router.replace('/');
                    }
                }
            } catch {
                router.replace('/');
            } finally {
                setChecking(false);
            }
        };

        checkPermission();
    }, [pathname, moduleKey, router]);

    if (checking) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                fontWeight: 900,
                color: '#6366f1',
                letterSpacing: '2px',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
                VERIFICANDO ACCESO...
            </div>
        );
    }

    if (!authorized) return null;

    return <>{children}</>;
}
