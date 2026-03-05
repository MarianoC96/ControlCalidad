import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';

export async function GET(request: Request) {
    try {
        const auth = await getAuthUserId();
        const userId = auth?.userId;

        if (!userId) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const supabase = createServiceClient();

        // 1. Get the latest edit date per registro_id
        const { data: latestEdits, error: editsError } = await supabase
            .from('history_edits')
            .select('registro_id, created_at')
            .order('created_at', { ascending: false });

        if (editsError) throw editsError;

        // 2. Filter to get only the NEWEST entry per registry (manually as history_edits could be large, 
        // but for a trial this manual approach is safe and simple in JS)
        const latestByRegistry: Record<number, string> = {};
        latestEdits.forEach(edit => {
            if (!latestByRegistry[edit.registro_id]) {
                latestByRegistry[edit.registro_id] = edit.created_at;
            }
        });

        const registryIds = Object.keys(latestByRegistry).map(id => parseInt(id));

        if (registryIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // 3. Fetch registry details for these IDs
        const { data: registries, error: regError } = await supabase
            .from('registros')
            .select(`
                id,
                lote_interno,
                producto_nombre,
                verificado_por,
                usuario_nombre,
                fecha_registro
            `)
            .in('id', registryIds);

        if (regError) throw regError;

        // 4. Map the latest edit date back to the registry
        const result = registries.map(reg => ({
            ...reg,
            ultima_modificacion: latestByRegistry[reg.id]
        })).sort((a, b) => 
            new Date(b.ultima_modificacion).getTime() - new Date(a.ultima_modificacion).getTime()
        );

        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error('Modified registries API error:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
