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

// Client-side in-memory cache of allowed modules
let cachedAllowedModules: string[] | null = null;
let ongoingPermisosPromise: Promise<string[]> | null = null;

export function clearPermissionsCache() {
    cachedAllowedModules = null;
    ongoingPermisosPromise = null;
    if (typeof window !== 'undefined') {
        try { sessionStorage.removeItem('nav_permisos'); } catch { }
    }
}

function getInitialAllowedModules(): string[] | null {
    if (cachedAllowedModules) return cachedAllowedModules;
    if (typeof window === 'undefined') return null;
    try {
        const saved = sessionStorage.getItem('nav_permisos');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                cachedAllowedModules = parsed;
                return parsed;
            }
        }
    } catch { }
    return null;
}

async function fetchAllowedModules(): Promise<string[]> {
    if (ongoingPermisosPromise) return ongoingPermisosPromise;

    ongoingPermisosPromise = (async () => {
        try {
            const res = await fetch('/api/auth/permisos');
            if (!res.ok) {
                return [];
            }
            const data = await res.json();
            const allowed: string[] = data.allowedModules || [];
            cachedAllowedModules = allowed;
            if (typeof window !== 'undefined') {
                try { sessionStorage.setItem('nav_permisos', JSON.stringify(allowed)); } catch { }
            }
            return allowed;
        } catch {
            return [];
        } finally {
            ongoingPermisosPromise = null;
        }
    })();

    return ongoingPermisosPromise;
}

interface RouteGuardProps {
    children: React.ReactNode;
    moduleKey?: string; // optional override
}

export default function RouteGuard({ children, moduleKey }: RouteGuardProps) {
    const router = useRouter();
    const pathname = usePathname();

    const key = moduleKey || PATH_TO_MODULE[pathname];
    const isPublicOrTemporal = !key || key === 'temporal';

    // Synchronous permission check against memory/session cache
    const initialAllowed = getInitialAllowedModules();
    const isInitiallyAuthorized = isPublicOrTemporal || (initialAllowed !== null && initialAllowed.includes(key));
    const isInitiallyChecking = !isPublicOrTemporal && initialAllowed === null;

    const [authorized, setAuthorized] = useState(isInitiallyAuthorized);
    const [checking, setChecking] = useState(isInitiallyChecking);

    useEffect(() => {
        if (isPublicOrTemporal) {
            setAuthorized(true);
            setChecking(false);
            return;
        }

        const handleAuthorization = (allowed: string[]) => {
            if (allowed.includes(key)) {
                setAuthorized(true);
                setChecking(false);
            } else {
                setAuthorized(false);
                setChecking(false);
                router.replace('/dashboard');
            }
        };

        const currentAllowed = getInitialAllowedModules();
        if (currentAllowed !== null) {
            // Validated synchronously: do NOT block UI
            handleAuthorization(currentAllowed);

            // Revalidate in background without blocking UI
            fetchAllowedModules().then(freshAllowed => {
                if (freshAllowed.length > 0 && !freshAllowed.includes(key)) {
                    setAuthorized(false);
                    router.replace('/dashboard');
                }
            });
            return;
        }

        // Cold start (empty cache): fetch and block only once
        setChecking(true);
        fetchAllowedModules().then(allowed => {
            if (allowed.length === 0) {
                router.replace('/dashboard');
                return;
            }
            handleAuthorization(allowed);
        });
    }, [pathname, moduleKey, key, isPublicOrTemporal, router]);

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
