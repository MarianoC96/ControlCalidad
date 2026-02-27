'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AuthState {
    readonly userName: string;
    readonly userRole: 'administrador' | 'trabajador';
    readonly userId: number | null;
    readonly isLoading: boolean;
    readonly isAdmin: boolean;
}

interface UseAuthOptions {
    /** If true, redirects non-admin users to /registro-productos */
    readonly requireAdmin?: boolean;
    /** If true, redirects unauthenticated users to login */
    readonly redirectOnFail?: boolean;
}

const AUTH_DEFAULTS: AuthState = {
    userName: '',
    userRole: 'trabajador',
    userId: null,
    isLoading: true,
    isAdmin: false,
};

/**
 * Centralizes authentication check logic used across all *Client.tsx pages.
 *
 * Why fetch /api/auth/me instead of supabase.auth.getUser() directly:
 * The /me route uses withAuth which returns the FULL app-level profile
 * (nombre_completo, roles, userId from the `usuarios` table), not just
 * the Supabase Auth user. This gives us the data every page needs.
 */
export function useAuth(options: UseAuthOptions = {}): AuthState {
    const { requireAdmin = false, redirectOnFail = true } = options;
    const router = useRouter();

    const [state, setState] = useState<AuthState>(AUTH_DEFAULTS);

    const fetchUser = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/me');

            if (!response.ok) {
                if (redirectOnFail) router.push('/');
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            const user = await response.json();

            const isAdmin = user.roles === 'administrador';

            if (requireAdmin && !isAdmin) {
                router.push('/registro-productos');
                return;
            }

            setState({
                userName: user.nombre_completo || user.usuario,
                userRole: user.roles,
                userId: user.id ?? null,
                isLoading: false,
                isAdmin,
            });
        } catch {
            // Network failure — cannot verify auth
            if (redirectOnFail) {
                router.push('/');
            }
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [requireAdmin, redirectOnFail, router]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    return state;
}
