import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const createAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
};

// All system modules
const ALL_MODULES = [
    'registro-productos',
    'historial',
    'historial-descargas',
    'solicitudes',
    'productos',
    'parametros-maestros',
    'usuarios',
    'admin/config-pdf',
    'accesos',
    'temporal',
    'auditoria',
];

async function getAuthUser(supabase: ReturnType<typeof createAdminClient>) {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;
    if (!userId) return null;

    const { data: user } = await supabase
        .from('usuarios')
        .select('id, usuario, roles, role_id')
        .eq('id', parseInt(userId))
        .single();

    return user;
}


// GET - List all roles with their permissions
export async function GET() {
    try {
        const supabase = createAdminClient();
        const user = await getAuthUser(supabase);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        // Only sadmin user or admin can view roles
        const isSadmin = user.usuario === 'sadmin';
        if (!isSadmin && user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { data: roles, error } = await supabase
            .from('roles')
            .select('*')
            .order('is_system', { ascending: false })
            .order('jerarquia', { ascending: true })
            .order('nombre', { ascending: true });

        if (error) throw error;

        // Get permissions for each role
        const rolesWithPerms = await Promise.all(
            (roles || []).map(async (role) => {
                const { data: permisos } = await supabase
                    .from('role_permisos')
                    .select('*')
                    .eq('role_id', role.id);
                return { ...role, permisos: permisos || [] };
            })
        );

        return NextResponse.json({
            roles: rolesWithPerms,
            modules: ALL_MODULES,
            isSadmin
        });

    } catch (error) {
        console.error('Get roles error:', error);
        return NextResponse.json({ error: 'Error al obtener roles' }, { status: 500 });
    }
}

// POST - Create a new role
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const user = await getAuthUser(supabase);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const isSadmin = user.usuario === 'sadmin';
        if (!isSadmin && user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { nombre, descripcion, permisos } = body;

        if (!nombre?.trim()) {
            return NextResponse.json({ error: 'El nombre del rol es obligatorio' }, { status: 400 });
        }



        // Can't use reserved names
        if (nombre.toLowerCase() === 'sadmin') {
            return NextResponse.json({ error: 'No puedes usar el nombre "sadmin"' }, { status: 400 });
        }

        // Create role
        const { data: newRole, error } = await supabase
            .from('roles')
            .insert({ nombre: nombre.trim(), descripcion, is_system: false })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 });
            }
            throw error;
        }

        // Insert permissions
        if (permisos && Array.isArray(permisos)) {
            const permRecords = ALL_MODULES.map(mod => ({
                role_id: newRole.id,
                modulo_key: mod,
                habilitado: permisos.includes(mod),
            }));
            await supabase.from('role_permisos').insert(permRecords);
        }

        return NextResponse.json(newRole);

    } catch (error) {
        console.error('Create role error:', error);
        return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 });
    }
}

// PUT - Update a role and its permissions
export async function PUT(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const user = await getAuthUser(supabase);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const isSadmin = user.usuario === 'sadmin';
        if (!isSadmin && user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { id, nombre, descripcion, permisos } = body;

        if (!id) return NextResponse.json({ error: 'ID de rol requerido' }, { status: 400 });

        // Get the role being edited
        const { data: targetRole } = await supabase
            .from('roles')
            .select('*')
            .eq('id', id)
            .single();

        if (!targetRole) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });

        // Cannot edit sadmin role
        if (targetRole.is_system) {
            return NextResponse.json({ error: 'El rol del sistema no puede ser modificado' }, { status: 403 });
        }


        if (nombre?.toLowerCase() === 'sadmin') {
            return NextResponse.json({ error: 'No puedes usar el nombre "sadmin"' }, { status: 400 });
        }

        // Update role
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (nombre) updateData.nombre = nombre.trim();
        if (descripcion !== undefined) updateData.descripcion = descripcion;


        const { error: updateError } = await supabase
            .from('roles')
            .update(updateData)
            .eq('id', id);

        if (updateError) {
            if (updateError.code === '23505') {
                return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 });
            }
            throw updateError;
        }

        // Update permissions
        if (permisos && Array.isArray(permisos)) {
            // Don't allow accesos module for non-sadmin roles
            const filteredPermisos = isSadmin ? permisos : permisos.filter((p: string) => p !== 'accesos');

            for (const mod of ALL_MODULES) {
                await supabase
                    .from('role_permisos')
                    .upsert({
                        role_id: id,
                        modulo_key: mod,
                        habilitado: filteredPermisos.includes(mod),
                    }, { onConflict: 'role_id,modulo_key' });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update role error:', error);
        return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 });
    }
}

// PATCH - Reorder roles
export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const user = await getAuthUser(supabase);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const isSadmin = user.usuario === 'sadmin';
        if (!isSadmin && user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { order } = body; // array of { id, posicion }

        if (!order || !Array.isArray(order)) {
            return NextResponse.json({ error: 'Orden requerido' }, { status: 400 });
        }

        for (const item of order) {
            // Don't allow reordering system roles
            const { data: role } = await supabase.from('roles').select('is_system').eq('id', item.id).single();
            if (role?.is_system) continue;

            await supabase
                .from('roles')
                .update({ jerarquia: item.posicion })
                .eq('id', item.id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reorder roles error:', error);
        return NextResponse.json({ error: 'Error al reordenar roles' }, { status: 500 });
    }
}

// DELETE - Delete a role
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient();
        const user = await getAuthUser(supabase);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const isSadmin = user.usuario === 'sadmin';
        if (!isSadmin && user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        const { data: targetRole } = await supabase
            .from('roles')
            .select('*')
            .eq('id', parseInt(id))
            .single();

        if (!targetRole) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });

        if (targetRole.is_system) {
            return NextResponse.json({ error: 'No se puede eliminar un rol del sistema' }, { status: 403 });
        }

        // Check no users are assigned to this role
        const { data: usersWithRole } = await supabase
            .from('usuarios')
            .select('id')
            .eq('role_id', parseInt(id))
            .eq('is_deleted', false);

        if (usersWithRole && usersWithRole.length > 0) {
            return NextResponse.json({ error: `No se puede eliminar: ${usersWithRole.length} usuario(s) tienen este rol asignado` }, { status: 400 });
        }

        await supabase.from('role_permisos').delete().eq('role_id', parseInt(id));
        await supabase.from('roles').delete().eq('id', parseInt(id));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete role error:', error);
        return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 });
    }
}
