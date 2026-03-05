import { NextResponse } from 'next/server';
import { withAuth, createServiceClient } from '@/lib/api/withAuth';

/**
 * GET /api/auth/me
 * Retorna la información del usuario actual.
 */
export const GET = withAuth(async (_request, user) => {
    const supabase = createServiceClient();

    // Check for 'solicitudes' permission
    let hasSolicitudesPermission = false;

    if (user.usuario === 'sadmin' || user.roles === 'administrador') {
        hasSolicitudesPermission = true;
    } else if (user.role_id) {


        const { data: permisos } = await supabase
            .from('role_permisos')
            .select('modulo_key')
            .eq('role_id', user.role_id)
            .eq('habilitado', true)
            .eq('modulo_key', 'solicitudes');

        hasSolicitudesPermission = !!(permisos && permisos.length > 0);
    }

    return NextResponse.json({
        id: user.id,
        nombre_completo: user.nombre_completo,
        usuario: user.usuario,
        roles: user.roles,
        email: user.email,
        activo: user.activo,
        two_factor_enabled: !!user.two_factor_secret,
        hasSolicitudesPermission
    });
});

