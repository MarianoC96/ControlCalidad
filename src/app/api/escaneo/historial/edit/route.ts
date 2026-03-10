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
        const { historial_id, scan_mode, lote, password } = body;

        if (!historial_id || !scan_mode || !lote) {
            return NextResponse.json({ error: 'Faltan parámetros o lote nuevo' }, { status: 400 });
        }

        const supabase = createServiceClient();
        const table = scan_mode === 'productos' ? 'historial_escaneos_productos' : 'historial_escaneos_cajas';

        // Get current
        const { data: reg, error: regError } = await supabase
            .from(table)
            .select('*')
            .eq('id', historial_id)
            .single();

        if (regError || !reg) {
            return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
        }

        // Apply changes
        const { error: updateError } = await supabase
            .from(table)
            .update({
                lote: lote.toUpperCase(),
                edit_started_by: null,
                edit_started_at: null,
                edit_expires_at: null
            })
            .eq('id', historial_id);

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json({ error: 'Fallo al actualizar registro' }, { status: 500 });
        }

        // Registrar history of edits
        await supabase
            .from('edit_history_escaneo')
            .insert({
                historial_id,
                scan_mode,
                usuario_id: parseInt(userId),
                changes: {
                    before: { lote: reg.lote },
                    after: { lote: lote.toUpperCase() }
                }
            });

        // Marcar solicitud como revisada si había una
        await supabase
            .from('edit_requests_escaneo')
            .update({ status: 'editado_aprobado' })
            .eq('historial_id', historial_id)
            .eq('scan_mode', scan_mode)
            .eq('usuario_id', parseInt(userId))
            .eq('status', 'aprobado');

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Edit error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
