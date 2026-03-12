import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';

export async function POST(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { historial_id, scan_mode } = body;

        if (!historial_id || !scan_mode) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        const supabase = createServiceClient();
        const table = scan_mode === 'productos' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';

        const { error: updateError } = await supabase
            .from(table)
            .update({
                edit_started_at: null,
                edit_expires_at: null,
                edit_started_by: null
            })
            .eq('id', parseInt(historial_id));

        if (updateError) {
            console.error('Error in unlock:', updateError);
            return NextResponse.json({ error: 'Fallo al desbloquear' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unlock error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
