import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const registroId = searchParams.get('id');

        if (!registroId) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch controles and fotos in parallel (already was, but now with specific columns)
        const [controlesRes, fotosRes] = await Promise.all([
            supabase.from('controles')
                .select('id,registro_id,parametro_nombre,rango_completo,valor_control,texto_control,parametro_tipo,observacion,fuera_de_rango')
                .eq('registro_id', registroId),
            supabase.from('fotos')
                .select('id,registro_id,datos_base64,descripcion')
                .eq('registro_id', registroId),
        ]);

        return NextResponse.json({
            controles: controlesRes.data || [],
            fotos: fotosRes.data || []
        });

    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
