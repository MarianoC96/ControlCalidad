import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
import bcrypt from 'bcryptjs';

// Helper para crear cliente Admin (Service Role)
const createAdminClient = () => createServiceClient();

export async function GET() {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        // Cliente con permisos totales
        const supabase = createAdminClient();

        let isAdmin = false;

        // Verificación en DB
        if (userId) {
            const { data: userCheck } = await supabase
                .from('usuarios')
                .select('roles')
                .eq('id', parseInt(userId))
                .single();

            if (userCheck?.roles === 'administrador') {
                isAdmin = true;
            }
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
            .select('id, nombre_completo, usuario, email, roles, role_id, activo, is_deleted, created_at')
            .eq('is_deleted', false)
            .order('nombre_completo');

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error) {
        console.error('Get usuarios error:', error);
        return NextResponse.json(
            { error: 'Error interno al obtener usuarios' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;
        const supabase = createAdminClient();

        // Validar Admin
        let isAdmin = false;
        if (userId) {
            const { data: u } = await supabase.from('usuarios').select('roles').eq('id', parseInt(userId)).single();
            if (u?.roles === 'administrador') isAdmin = true;
        }

        if (!isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { nombre_completo, usuario, email, password, roles } = body;

        if (!nombre_completo || !usuario || !password) {
            return NextResponse.json(
                { error: 'Campos requeridos faltantes' },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('usuarios')
            .insert({
                nombre_completo,
                usuario,
                email,
                password: hashedPassword,
                roles: roles || 'trabajador',
                activo: true,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'El nombre de usuario ya existe' },
                    { status: 400 }
                );
            }
            throw error;
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error('Create usuario error:', error);
        return NextResponse.json(
            { error: 'Error al crear usuario' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;
        const supabase = createAdminClient();

        // Validar Admin
        let isAdmin = false;
        if (userId) {
            const { data: u } = await supabase.from('usuarios').select('roles').eq('id', parseInt(userId)).single();
            if (u?.roles === 'administrador') isAdmin = true;
        }

        if (!isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { id, nombre_completo, usuario, email, password, roles, activo, is_deleted } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        // Proteger al usuario sadmin (id=1) de ser editado o deshabilitado
        if (id === 1) {
            return NextResponse.json(
                { error: 'El usuario del sistema (sadmin) no puede ser modificado' },
                { status: 403 }
            );
        }

        const updateData: Record<string, unknown> = {
            nombre_completo,
            usuario,
            email,
            roles,
            activo,
            is_deleted,
        };



        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const { data, error } = await supabase
            .from('usuarios')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error) {
        console.error('Update usuario error:', error);
        return NextResponse.json(
            { error: 'Error al actualizar usuario' },
            { status: 500 }
        );
    }
}
