import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
import bcrypt from 'bcryptjs';

/**
 * Cliente Admin (Service Role) para operaciones de sistema
 */
const createAdminClient = () => createServiceClient();

export async function GET() {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;
        const supabase = createAdminClient();

        let isAdmin = false;
        if (userId) {
            const { data: u } = await supabase.from('usuarios').select('roles').eq('id', parseInt(userId)).single();
            if (u?.roles === 'administrador') isAdmin = true;
        }

        if (!isAdmin) {
            console.log('API Usuarios/GET: Acceso denegado.', { userId });
            return NextResponse.json(
                { error: 'No autorizado. Se requiere rol de administrador.' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('usuarios')
            .select('id, auth_uid, nombre_completo, usuario, email, roles, role_id, activo, is_deleted, created_at')
            .eq('is_deleted', false)
            .order('nombre_completo');

        if (error) throw error;
        return NextResponse.json(data);

    } catch (error) {
        console.error('Get usuarios error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;
        const supabase = createAdminClient();

        // 1. Validar Admin
        let isAdmin = false;
        if (userId) {
            const { data: u } = await supabase.from('usuarios').select('roles').eq('id', parseInt(userId)).single();
            if (u?.roles === 'administrador') isAdmin = true;
        }

        if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const body = await request.json();
        const { nombre_completo, usuario, password, roles, role_id } = body;

        // 2. Crear usuario en Supabase Auth
        // WHY: Supabase Auth requires an email. We auto-generate it from the
        // username so the user only needs to remember their username + password.
        const authEmail = `${usuario.trim().toLowerCase()}@controlcalidad.local`;

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: authEmail,
            password: password,
            email_confirm: true,
            user_metadata: { nombre_completo, usuario, has_2fa: false }
        });

        if (authError) {
            return NextResponse.json({ error: `Error en Autenticación: ${authError.message}` }, { status: 400 });
        }

        // 3. Crear perfil en tabla local
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data, error } = await supabase
            .from('usuarios')
            .insert({
                auth_uid: authData.user.id,
                nombre_completo,
                usuario: usuario.trim().toLowerCase(),
                email: authEmail,
                password: hashedPassword,
                roles: roles || 'trabajador',
                role_id: role_id || null,
                activo: true,
            })
            .select()
            .single();

        if (error) {
            // Rollback en Auth si falla la DB local
            await supabase.auth.admin.deleteUser(authData.user.id);
            if (error.code === '23505') return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
            throw error;
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error('Create usuario error:', error);
        return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;
        const supabase = createAdminClient();

        let isAdmin = false;
        if (userId) {
            const { data: u } = await supabase.from('usuarios').select('roles').eq('id', parseInt(userId)).single();
            if (u?.roles === 'administrador') isAdmin = true;
        }
        if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const body = await request.json();
        const { id, nombre_completo, usuario, password, roles, role_id, activo, is_deleted } = body;

        if (id === 1) return NextResponse.json({ error: 'sadmin no modificable' }, { status: 403 });

        // Auto-generate internal email from username
        const authEmail = usuario
            ? `${usuario.trim().toLowerCase()}@controlcalidad.local`
            : undefined;

        // Sincronizar con Supabase Auth
        const { data: currentUser } = await supabase.from('usuarios').select('auth_uid').eq('id', id).single();

        if (currentUser?.auth_uid) {
            if (is_deleted) {
                // WHY: On soft-delete, we fully remove the Auth account to free
                // the username for a potential new user. The local usuarios row
                // persists (is_deleted=true) so historical FK references survive.
                await supabase.auth.admin.deleteUser(currentUser.auth_uid);
            } else {
                const authUpdate: Record<string, unknown> = {};
                if (password) authUpdate.password = password;
                if (authEmail) authUpdate.email = authEmail;
                if (activo === false) authUpdate.app_metadata = { disabled: true };
                else authUpdate.app_metadata = { disabled: false };

                if (Object.keys(authUpdate).length > 0) {
                    await supabase.auth.admin.updateUserById(currentUser.auth_uid, authUpdate);
                }
            }
        }

        // Actualizar local
        const updateData: Record<string, unknown> = { nombre_completo, roles, role_id, activo, is_deleted };
        if (is_deleted) {
            // Clear auth_uid so the record is fully disconnected from Auth
            updateData.auth_uid = null;
        }
        if (usuario && !is_deleted) {
            updateData.usuario = usuario.trim().toLowerCase();
            updateData.email = authEmail;
        }
        if (password) updateData.password = await bcrypt.hash(password, 10);

        const { data, error } = await supabase.from('usuarios').update(updateData).eq('id', id).select().single();
        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error('Update usuario error:', error);
        return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }
}
