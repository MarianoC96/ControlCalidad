import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

/**
 * Authenticated user profile from the `usuarios` table,
 * enriched with Supabase Auth UID.
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
}

type RouteHandler = (
    request: Request,
    user: AuthenticatedUser
) => Promise<NextResponse>;

/**
 * Higher-order function that wraps API route handlers with auth validation.
 *
 * Why this exists: every API route duplicated the same pattern —
 * read cookies, validate user, create admin client. This centralizes
 * that into a single composable wrapper.
 *
 * Flow:
 * 1. Gets Supabase session from the request cookies (Supabase SSR)
 * 2. Validates the session JWT via `supabase.auth.getUser()`
 * 3. Looks up the corresponding `usuarios` record via `auth_uid`
 * 4. Passes the authenticated user to the wrapped handler
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

            // Look up the app-level user profile
            const adminClient = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { autoRefreshToken: false, persistSession: false } }
            );

            const { data: appUser, error: userError } = await adminClient
                .from('usuarios')
                .select('id, auth_uid, nombre_completo, usuario, email, roles, role_id, activo')
                .eq('auth_uid', authUser.id)
                .eq('activo', true)
                .eq('is_deleted', false)
                .single();

            if (userError || !appUser) {
                return NextResponse.json(
                    { error: 'Usuario no encontrado en el sistema' },
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
 * Creates an admin Supabase client that bypasses RLS.
 * Use only in server-side API routes where elevated access is required.
 */
export function createServiceClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

/**
 * Lightweight auth check for routes that just need the userId.
 * Returns the usuarios.id (app-level ID) or null if unauthenticated.
 *
 * Why this exists: many routes only need `userId` to filter queries.
 * The full `withAuth` HOF is better for new routes, but this function
 * allows migrating existing routes with minimal code changes.
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
