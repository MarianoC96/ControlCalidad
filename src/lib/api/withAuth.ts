import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/**
 * Perfil de usuario autenticado enriquecido con UID de Supabase
 * y secretos de 2FA.
 */
export interface AuthenticatedUser {
    readonly id: number;
    readonly auth_uid: string;
    readonly nombre_completo: string;
    readonly usuario: string;
    readonly email: string;
    readonly roles: 'administrador' | 'trabajador';
    readonly role_id: number | null;
    readonly activo: boolean;
    readonly two_factor_secret?: string | null;
}

type RouteHandler = (
    request: Request,
    user: AuthenticatedUser
) => Promise<NextResponse>;

/**
 * HOF que envuelve las rutas de API con validación de sesión de Supabase.
 */
export function withAuth(handler: RouteHandler) {
    return async (request: Request): Promise<NextResponse> => {
        try {
            const supabase = await createClient();

            const {
                data: { user: authUser },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !authUser) {
                return NextResponse.json(
                    { error: 'No autenticado' },
                    { status: 401 }
                );
            }

            // Buscamos el perfil en la tabla de usuarios local
            const adminClient = createServiceClient();

            const { data: appUser, error: userError } = await adminClient
                .from('usuarios')
                .select('id, auth_uid, nombre_completo, usuario, email, roles, role_id, activo, two_factor_secret')
                .eq('auth_uid', authUser.id)
                .eq('activo', true)
                .eq('is_deleted', false)
                .single();

            if (userError || !appUser) {
                return NextResponse.json(
                    { error: 'Usuario no encontrado o inactivo' },
                    { status: 403 }
                );
            }

            return handler(request, appUser as AuthenticatedUser);
        } catch (error) {
            console.error('withAuth error:', error);
            return NextResponse.json(
                { error: 'Error interno del servidor' },
                { status: 500 }
            );
        }
    };
}

/**
 * Crea un cliente de Supabase con Service Role (Admin).
 * Úsalo solo en rutas de API seguras (Server-side).
 */
export function createServiceClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * Obtiene el ID del usuario autenticado de forma ligera.
 */
export async function getAuthUserId(): Promise<{ userId: string; authUid: string } | null> {
    try {
        const supabase = await createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) return null;

        const adminClient = createServiceClient();
        const { data: appUser } = await adminClient
            .from('usuarios')
            .select('id')
            .eq('auth_uid', authUser.id)
            .eq('activo', true)
            .eq('is_deleted', false)
            .single();

        if (!appUser) return null;

        return { userId: appUser.id.toString(), authUid: authUser.id };
    } catch {
        return null;
    }
}
