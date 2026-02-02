import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Helper Service Role Client
const createAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createAdminClient();

        // Verify if user is admin
        const { data: user } = await supabase
            .from('usuarios')
            .select('roles')
            .eq('id', parseInt(userId))
            .single();

        if (!user || user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No tienes permisos de administrador' }, { status: 403 });
        }

        // Fetch requests with record and user details
        const { data, error } = await supabase
            .from('edit_requests')
            .select(`
                *,
                registros (
                    lote_interno,
                    producto_nombre,
                    fecha_registro
                ),
                usuarios!usuario_id (
                    nombre_completo,
                    usuario
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Error fetching edit requests:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { id, status } = body; // 'aprobado' or 'rechazado'

        if (!id || !['aprobado', 'rechazado'].includes(status)) {
            return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
        }

        const supabase = createAdminClient();

        // Verify if user is admin
        const { data: user } = await supabase
            .from('usuarios')
            .select('roles')
            .eq('id', parseInt(userId))
            .single();

        if (!user || user.roles !== 'administrador') {
            return NextResponse.json({ error: 'No tienes permisos de administrador' }, { status: 403 });
        }

        const { error } = await supabase
            .from('edit_requests')
            .update({
                status,
                resolved_at: new Date().toISOString(),
                resolved_by: parseInt(userId)
            })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error updating edit request:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
