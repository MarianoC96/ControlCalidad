import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// Helper para crear cliente Admin (Service Role)
const createAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
};

export async function GET() {
    try {
        const cookieStore = await cookies();

        const userId = cookieStore.get('user_id')?.value;
        const userRoleCookie = cookieStore.get('user_role')?.value;

        // Cliente con permisos totales
        const supabase = createAdminClient();

        let isAdmin = false;

        // 1. Verificación rápida por cookie
        if (userRoleCookie === 'administrador') {
            isAdmin = true;
        }
        // 2. Verificación robusta en DB si hay session
        else if (userId) {
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
            console.log('API Usuarios/GET: Acceso denegado.', { userRoleCookie, userId });
            return NextResponse.json(
                { error: 'No autorizado. Se requiere rol de administrador.' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
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
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const supabase = createAdminClient();

        // Validar Admin (simplificado, reusar lógica sería ideal pero duplicamos por claridad ahora)
        let isAdmin = false;
        if (cookieStore.get('user_role')?.value === 'administrador') {
            isAdmin = true;
        } else if (userId) {
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
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const supabase = createAdminClient();

        // Validar Admin
        let isAdmin = false;
        if (cookieStore.get('user_role')?.value === 'administrador') {
            isAdmin = true;
        } else if (userId) {
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
