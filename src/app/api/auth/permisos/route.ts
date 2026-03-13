import { NextResponse } from 'next/server';
import { withAuth, createServiceClient } from '@/lib/api/withAuth';

/**
 * GET /api/auth/permisos
 *
 * Returns the current user's allowed modules based on role.
 * Uses withAuth for session validation, then queries roles/role_permisos.
 */
export const GET = withAuth(async (_request, user) => {
    // sadmin always gets all modules
    if (user.usuario === 'sadmin') {
        return NextResponse.json({
            allowedModules: [
                'registro-productos', 'historial', 'registros-modificados', 'historial-descargas',
                'solicitudes', 'productos', 'parametros-maestros',
                'usuarios', 'admin/config-pdf', 'accesos',
                'control-sistema', 'control-calidad', 'escaneo',
                'escaneo-productos', 'escaneo-cajas', 'escaneo-historial',
                'temporal',
            ],
            isSadmin: true,
            roleName: 'sadmin',
        });
    }

    if (!user.role_id) {
        // Fallback: use the roles field directly
        if (user.roles === 'administrador') {
            return NextResponse.json({
                allowedModules: [
                    'registro-productos', 'historial', 'registros-modificados', 'historial-descargas',
                    'solicitudes', 'productos', 'parametros-maestros',
                    'usuarios', 'admin/config-pdf', 'accesos',
                    'control-sistema', 'control-calidad', 'escaneo',
                    'escaneo-productos', 'escaneo-cajas', 'escaneo-historial',
                    'temporal',
                ],
                isSadmin: false,
                roleName: 'administrador',
            });
        }

        return NextResponse.json({
            allowedModules: ['registro-productos', 'historial', 'registros-modificados', 'historial-descargas', 'temporal'],
            isSadmin: false,
            roleName: 'trabajador',
        });
    }

    // Query role permissions from DB
    const adminClient = createServiceClient();

    const { data: role } = await adminClient
        .from('roles')
        .select('nombre, role_permisos(modulo_key)')
        .eq('id', user.role_id)
        .eq('role_permisos.habilitado', true)
        .single();

    const allowedModules = (role?.role_permisos || []).map(
        (p: { modulo_key: string }) => p.modulo_key
    );

    // 'temporal' is always available (contingency module)
    if (!allowedModules.includes('temporal')) {
        allowedModules.push('temporal');
    }

    return NextResponse.json({
        allowedModules,
        isSadmin: false,
        roleName: role?.nombre || user.roles,
    });
});
