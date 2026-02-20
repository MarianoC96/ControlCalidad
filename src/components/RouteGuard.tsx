'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Map URL paths to module keys
const PATH_TO_MODULE: Record<string, string> = {
    '/registro-productos': 'registro-productos',
    '/historial': 'historial',
    '/historial-descargas': 'historial-descargas',
    '/solicitudes': 'solicitudes',
    '/productos': 'productos',
    '/parametros-maestros': 'parametros-maestros',
    '/usuarios': 'usuarios',
    '/admin/config-pdf': 'admin/config-pdf',
    '/accesos': 'accesos',
    '/temporal': 'temporal',
    '/auditoria': 'auditoria',
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
        const checkPermission = async () => {
            try {
                const key = moduleKey || PATH_TO_MODULE[pathname];
                if (!key) {
                    // No module restriction for this path
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

                const res = await fetch('/api/auth/permisos');
                if (!res.ok) {
                    router.replace('/');
                    return;
                }

                const data = await res.json();
                const allowed = data.allowedModules || [];

                if (allowed.includes(key)) {
                    setAuthorized(true);
                } else {
                    // Redirect to first allowed module or home
                    const firstAllowed = allowed[0];
                    if (firstAllowed) {
                        // Find the path for the first allowed module
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
