import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';
export async function POST(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { registro_id, motivo } = await request.json();

        if (!registro_id) {
            return NextResponse.json({ error: 'ID de registro requerido' }, { status: 400 });
        }

        if (!motivo || !motivo.trim()) {
            return NextResponse.json({ error: 'El motivo de la solicitud es obligatorio' }, { status: 400 });
        }

        const supabase = createServiceClient();

        // Check if there is already a pending request for this user and record
        const { data: existing, error: checkError } = await supabase
            .from('edit_requests')
            .select('id')
            .eq('registro_id', registro_id)
            .eq('usuario_id', parseInt(userId))
            .eq('status', 'pendiente')
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Ya tienes una solicitud pendiente para este registro' }, { status: 400 });
        }

        // Create new request
        const { error: insertError } = await supabase
            .from('edit_requests')
            .insert({
                registro_id,
                usuario_id: parseInt(userId),
                status: 'pendiente',
                motivo: motivo.trim()
            });

        if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json({ error: 'Error al enviar la solicitud' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Solicitud enviada correctamente' });

    } catch (error) {
        console.error('Request edit error:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
