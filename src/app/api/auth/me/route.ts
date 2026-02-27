import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';

/**
 * GET /api/auth/me
 *
 * Chesterton's Fence: previously read user_id from cookie and fetched from DB
 * with SERVICE_ROLE_KEY. Now uses the withAuth helper which validates the
 * Supabase JWT session and looks up the usuarios profile automatically.
 */
export const GET = withAuth(async (_request, user) => {
    return NextResponse.json({
        id: user.id,
        nombre_completo: user.nombre_completo,
        usuario: user.usuario,
        email: user.email,
        roles: user.roles,
        activo: user.activo,
    });
});
