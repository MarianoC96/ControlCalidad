import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
const createAdminClient = () => createServiceClient();

// GET - Returns list of active workers for offline preloading
export async function GET() {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;
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
