'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';

interface AuthUser {
    id: number;
    nombre_completo: string;
    usuario: string;
    roles: 'administrador' | 'trabajador';
    email: string | null;
    activo: boolean;
    two_factor_enabled?: boolean;
    hasSolicitudesPermission?: boolean;
    role_permisos?: string[];
    permiso_escaneo?: boolean;
    permiso_escaneo_productos?: boolean;
    permiso_escaneo_cajas?: boolean;
    permiso_escaneo_historial?: boolean;
    [key: string]: any;
}

interface AuthState {
    readonly userName: string;
    readonly userRole: 'administrador' | 'trabajador';
    readonly userId: number | null;
    readonly isLoading: boolean;
    readonly isAdmin: boolean;
    readonly user?: AuthUser | null;
    readonly permissions: string[];
    readonly hasSolicitudesPermission: boolean;
    readonly mutate: () => Promise<any>;
}

interface UseAuthOptions {
    /** If true, redirects non-admin users to /registro-productos */
    readonly requireAdmin?: boolean;
    /** If true, redirects unauthenticated users to login */
    readonly redirectOnFail?: boolean;
}

const authFetcher = async (url: string): Promise<AuthUser> => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Auth failed: HTTP ${res.status}`);
    }
    return res.json();
};

export const invalidateAuth = () => globalMutate('/api/auth/me');

/**
 * Centralizes authentication check logic and deduplicates /api/auth/me queries
 * across the entire application using SWR in-memory caching.
 */
export function useAuth(options: UseAuthOptions = {}): AuthState {
    const { requireAdmin = false, redirectOnFail = true } = options;
    const router = useRouter();

    const { data: user, error, isLoading, mutate } = useSWR<AuthUser>(
        '/api/auth/me',
        authFetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60_000,
            shouldRetryOnError: false,
        }
    );

    useEffect(() => {
        if (error && redirectOnFail) {
            router.push('/');
        }
    }, [error, redirectOnFail, router]);

    useEffect(() => {
        if (user && requireAdmin && user.roles !== 'administrador') {
            router.push('/control-calidad/registro-productos');
        }
    }, [user, requireAdmin, router]);

    const isAdmin = user?.roles === 'administrador';

    return {
        userName: user ? (user.nombre_completo || user.usuario || '') : '',
        userRole: (user?.roles as 'administrador' | 'trabajador') || 'trabajador',
        userId: user?.id ?? null,
        isLoading: isLoading && !user,
        isAdmin,
        user: user ?? null,
        permissions: user?.role_permisos || [],
        hasSolicitudesPermission: user?.hasSolicitudesPermission || false,
        mutate: () => mutate(),
    };
}
