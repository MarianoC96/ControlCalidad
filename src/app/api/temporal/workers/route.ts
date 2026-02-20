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

// GET - Returns list of active workers for offline preloading
export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createAdminClient();

        const { data: workers, error } = await supabase
            .from('usuarios')
            .select('id, nombre_completo, usuario')
            .eq('activo', true)
            .eq('is_deleted', false)
            .order('nombre_completo');

        if (error) {
            console.error('Error fetching workers:', error);
            return NextResponse.json({ error: 'Error al obtener trabajadores' }, { status: 500 });
        }

        return NextResponse.json({ workers: workers || [] });
    } catch (error) {
        console.error('Workers API error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
