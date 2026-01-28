import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Helper Service Role Client
const createAdminClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
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

        const { data, error } = await supabase
            .from('registros')
            .select('*')
            .order('fecha_registro', { ascending: false });

        if (error) {
            console.error('Error fetching registros:', error);
            throw error;
        }

        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const {
            lote_interno,
            guia,
            cantidad,
            producto_id,
            producto_nombre,
            observaciones_generales,
            verificado_por,
            controles
        } = body;

        const supabase = createAdminClient();

        // 1. Crear el Registro
        const { data: registro, error: regError } = await supabase
            .from('registros')
            .insert({
                lote_interno,
                guia,
                cantidad,
                producto_id,
                producto_nombre,
                observaciones_generales,
                verificado_por,
                usuario_id: parseInt(userId) // Asociar con el usuario logueado
            })
            .select()
            .single();

        if (regError) throw regError;

        // 2. Crear los Controles asociados
        if (controles && controles.length > 0) {
            const controlesToInsert = controles.map((c: any) => ({
                registro_id: registro.id,
                parametro_nombre: c.parametroNombre,
                rango_completo: c.rangoCompleto,
                valor_control: c.valorControl,
                texto_control: c.textoControl,
                parametro_tipo: c.parametroTipo,
                observacion: c.observacion,
                fuera_de_rango: c.fueraDeRango,
                // Nota: mensajeAlerta no se suele guardar en BD a menos que haya col.
            }));

            const { error: controlError } = await supabase
                .from('controles')
                .insert(controlesToInsert);

            if (controlError) {
                // Idealmente rollback de registro, pero por ahora lanzamos error
                console.error('Error guardando controles:', controlError);
                // No borramos el registro para no perder datos parciales, pero avisamos.
                throw controlError;
            }
        }

        return NextResponse.json({ success: true, registro_id: registro.id });

    } catch (error: any) {
        console.error('Error creating registro:', error);
        return NextResponse.json({ error: error.message || 'Error al guardar registro' }, { status: 500 });
    }
}
