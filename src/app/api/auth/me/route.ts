import { NextResponse } from 'next/server';
import { withAuth, createServiceClient } from '@/lib/api/withAuth';

/**
 * GET /api/auth/me
 * Retorna la información del usuario actual.
 */
export const GET = withAuth(async (_request, user) => {
    const supabase = createServiceClient();

    let hasSolicitudesPermission = false;
    let permisos_list: string[] = [];

    if (user.usuario === 'sadmin' || user.roles === 'administrador') {
        hasSolicitudesPermission = true;
        permisos_list = [
            'registro-productos', 'historial', 'registros-modificados', 'historial-descargas', 'historial-descargas-masivas', 'solicitudes',
            'productos', 'parametros-maestros', 'usuarios', 'admin/config-pdf', 'admin/config-reportes', 'accesos',
            'control-sistema', 'control-calidad',
            'escaneo', 'escaneo-productos', 'escaneo-cajas', 'escaneo-historial', 'escaneo-central'
        ];
    } else if (user.role_id) {
        const { data: permisos } = await supabase
            .from('role_permisos')
            .select('modulo_key')
            .eq('role_id', user.role_id)
            .eq('habilitado', true);

        if (permisos) {
            permisos_list = permisos.map(p => p.modulo_key);
            hasSolicitudesPermission = permisos_list.includes('solicitudes');
        }
    }

    return NextResponse.json({
        id: user.id,
        nombre_completo: user.nombre_completo,
        usuario: user.usuario,
        roles: user.roles,
        email: user.email,
        activo: user.activo,
        two_factor_enabled: !!user.two_factor_secret,
        hasSolicitudesPermission,
        role_permisos: permisos_list,
        permiso_escaneo: permisos_list.includes('escaneo'),
        permiso_escaneo_productos: permisos_list.includes('escaneo-productos'),
        permiso_escaneo_cajas: permisos_list.includes('escaneo-cajas'),
        permiso_escaneo_historial: permisos_list.includes('escaneo-historial')
    });
});

