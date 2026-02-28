import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';

/**
 * GET /api/auth/me
 * Retorna la información del usuario actual.
 */
export const GET = withAuth(async (_request, user) => {
    return NextResponse.json({
        id: user.id,
        nombre_completo: user.nombre_completo,
        usuario: user.usuario,
        roles: user.roles,
        email: user.email,
        activo: user.activo,
        two_factor_enabled: !!user.two_factor_secret, // Se marca como activo si existe el secreto
    });
});
