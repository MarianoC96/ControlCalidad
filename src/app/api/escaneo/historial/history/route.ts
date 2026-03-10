import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/api/withAuth';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const mode = searchParams.get('mode');

        if (!id || !mode) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('edit_history_escaneo')
            .select(`
                *,
                usuarios (
                    nombre_completo
                )
            `)
            .eq('historial_id', id)
            .eq('scan_mode', mode)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data || []);

    } catch (error) {
        console.error('Fetch history error:', error);
        return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
    }
}
