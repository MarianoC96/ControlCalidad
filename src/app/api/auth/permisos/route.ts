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
                'historial-descargas-masivas', 'solicitudes', 'productos', 'parametros-maestros',
                'usuarios', 'admin/config-pdf', 'admin/config-reportes', 'accesos',
                'control-sistema', 'control-calidad', 'escaneo',
                'escaneo-productos', 'escaneo-cajas', 'escaneo-historial', 'escaneo-central',
                'temporal',
            ],
            isSadmin: true,
            roleName: 'sadmin',
        });
    }

    if (!user.role_id) {
        // WHY: Users without a role_id assigned get minimal access only.
        // Previously, `roles === 'administrador'` got full access here,
        // which contradicted the DB-based permissions.
        // All users should have a role_id pointing to the roles table
        // so their permissions are managed from the Accesos panel.
        return NextResponse.json({
            allowedModules: ['registro-productos', 'historial', 'registros-modificados', 'historial-descargas', 'temporal'],
            isSadmin: false,
            roleName: user.roles || 'trabajador',
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
