import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const createAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
};

// Returns the current user's allowed modules based on their role
export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const supabase = createAdminClient();

        const { data: user } = await supabase
            .from('usuarios')
            .select('id, usuario, roles, role_id')
            .eq('id', parseInt(userId))
            .single();

        if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

        // sadmin user always gets all modules
        if (user.usuario === 'sadmin') {
            return NextResponse.json({
                allowedModules: [
                    'registro-productos', 'historial', 'historial-descargas',
                    'solicitudes', 'productos', 'parametros-maestros',
                    'usuarios', 'admin/config-pdf', 'accesos',
                    'temporal'
                ],
                isSadmin: true,
                roleName: 'sadmin'
            });
        }

        if (!user.role_id) {
            // Fallback: use old roles field
            if (user.roles === 'administrador') {
                return NextResponse.json({
                    allowedModules: [
                        'registro-productos', 'historial', 'historial-descargas',
                        'solicitudes', 'productos', 'parametros-maestros',
                        'usuarios', 'admin/config-pdf',
                        'temporal'
                    ],
                    isSadmin: false,
                    roleName: 'administrador'
                });
            } else {
                return NextResponse.json({
                    allowedModules: ['registro-productos', 'historial', 'historial-descargas', 'temporal'],
                    isSadmin: false,
                    roleName: 'trabajador'
                });
            }
        }

        // Get role info WITH permissions in a single query
        const { data: role } = await supabase
            .from('roles')
            .select('nombre, role_permisos(modulo_key)')
            .eq('id', user.role_id)
            .eq('role_permisos.habilitado', true)
            .single();

        const allowedModules = (role?.role_permisos || []).map((p: any) => p.modulo_key);

        // 'temporal' is always available for all users (contingency module)
        if (!allowedModules.includes('temporal')) {
            allowedModules.push('temporal');
        }

        return NextResponse.json({
            allowedModules,
            isSadmin: false,
            roleName: role?.nombre || user.roles
        });

    } catch (error) {
        console.error('Get permissions error:', error);
        return NextResponse.json({ error: 'Error al obtener permisos' }, { status: 500 });
    }
}
