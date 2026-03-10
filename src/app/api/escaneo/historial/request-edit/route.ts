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
        const { historial_id, scan_mode, motivo } = body;

        if (!historial_id || !scan_mode || !motivo) {
            return NextResponse.json({ error: 'Faltan parámetros o motivo' }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Verificar si ya hay una petición pendiente para evitar duplicados
        const { data: existing } = await supabase
            .from('edit_requests_escaneo')
            .select('id')
            .eq('historial_id', parseInt(historial_id))
            .eq('scan_mode', scan_mode)
            .eq('usuario_id', parseInt(userId))
            .eq('status', 'pendiente')
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Ya tienes una solicitud pendiente para este registro' }, { status: 409 });
        }

        const { error: insertError } = await supabase
            .from('edit_requests_escaneo')
            .insert({
                historial_id: parseInt(historial_id),
                scan_mode: scan_mode,
                usuario_id: parseInt(userId),
                motivo,
                status: 'pendiente'
            });

        if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json({ error: 'Fallo al insertar la solicitud' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Request edit error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
