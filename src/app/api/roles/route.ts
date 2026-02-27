import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
const createAdminClient = () => createServiceClient();

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
];

async function getAuthUser(supabase: ReturnType<typeof createAdminClient>) {
    const auth = await getAuthUserId();
        const userId = auth?.userId;
    if (!userId) return null;

    const { data: user } = await supabase
        .from('usuarios')
        .select('id, usuario, roles, role_id')
        .eq('id', parseInt(userId))
        .single();

    return user;
}


// GET - List all roles with their permissions (OPTIMIZED: single query with join)
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

        // Single query: fetch roles WITH their permissions using Supabase join
        const { data: roles, error } = await supabase
            .from('roles')
            .select('id, nombre, descripcion, is_system, jerarquia, role_permisos (id, role_id, modulo_key, habilitado)')
            .order('is_system', { ascending: false })
            .order('jerarquia', { ascending: true })
            .order('nombre', { ascending: true });

        if (error) throw error;

        // Map the joined data to the expected format
        const rolesWithPerms = (roles || []).map(role => ({
            ...role,
            permisos: role.role_permisos || [],
            role_permisos: undefined, // remove the raw join field
        }));

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
            .select('id, nombre, descripcion, is_system')
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 });
            }
            throw error;
        }

        // Insert ALL permissions in a single batch
        const permRecords = ALL_MODULES.map(mod => ({
            role_id: newRole.id,
            modulo_key: mod,
            habilitado: Array.isArray(permisos) && permisos.includes(mod),
        }));
        await supabase.from('role_permisos').insert(permRecords);

        return NextResponse.json(newRole);

    } catch (error) {
        console.error('Create role error:', error);
        return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 });
    }
}

// PUT - Update a role and its permissions (OPTIMIZED: batch upsert)
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
            .select('id, is_system')
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

        // Run role update and permissions upsert in parallel
        const filteredPermisos = isSadmin ? permisos : (permisos || []).filter((p: string) => p !== 'accesos');

        const permRecords = ALL_MODULES.map(mod => ({
            role_id: id,
            modulo_key: mod,
            habilitado: Array.isArray(filteredPermisos) && filteredPermisos.includes(mod),
        }));

        const [updateResult, permsResult] = await Promise.all([
            supabase.from('roles').update(updateData).eq('id', id),
            permisos && Array.isArray(permisos)
                ? supabase.from('role_permisos').upsert(permRecords, { onConflict: 'role_id,modulo_key' })
                : Promise.resolve(null)
        ]);

        if (updateResult.error) {
            if (updateResult.error.code === '23505') {
                return NextResponse.json({ error: 'Ya existe un rol con ese nombre' }, { status: 400 });
            }
            throw updateResult.error;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Update role error:', error);
        return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 });
    }
}

// PATCH - Reorder roles (OPTIMIZED: batch update)
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

        // Update all non-system roles in parallel
        await Promise.all(
            order.map(item =>
                supabase
                    .from('roles')
                    .update({ jerarquia: item.posicion })
                    .eq('id', item.id)
                    .eq('is_system', false) // safety: only update non-system roles
            )
        );

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

        // Fetch role and users in parallel
        const [roleResult, usersResult] = await Promise.all([
            supabase.from('roles').select('id, is_system').eq('id', parseInt(id)).single(),
            supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('role_id', parseInt(id)).eq('is_deleted', false)
        ]);

        const targetRole = roleResult.data;
        if (!targetRole) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });

        if (targetRole.is_system) {
            return NextResponse.json({ error: 'No se puede eliminar un rol del sistema' }, { status: 403 });
        }

        const userCount = usersResult.count || 0;
        if (userCount > 0) {
            return NextResponse.json({ error: `No se puede eliminar: ${userCount} usuario(s) tienen este rol asignado` }, { status: 400 });
        }

        // Delete permissions and role in parallel
        await Promise.all([
            supabase.from('role_permisos').delete().eq('role_id', parseInt(id)),
            supabase.from('roles').delete().eq('id', parseInt(id))
        ]);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete role error:', error);
        return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 });
    }
}
