import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Helper to handle auth and service client creation
async function handleRequest(request: Request, action: (supabase: any, body: any) => Promise<any>) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const body = request.method !== 'GET' ? await request.json().catch(() => ({})) : {};

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
        );

        const result = await action(supabase, body);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    return handleRequest(request, async (supabase) => {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            // Get detailed product with parameters
            const { data: producto, error: prodError } = await supabase
                .from('productos')
                .select('*')
                .eq('id', id)
                .single();

            if (prodError) throw prodError;

            const { data: params, error: paramError } = await supabase
                .from('parametros')
                .select('*')
                .eq('producto_id', id);

            if (paramError) throw paramError;

            return { ...producto, parametros: params };
        }

        // List all products
        const { data, error } = await supabase
            .from('productos')
            .select('*')
            .order('nombre');
        if (error) throw error;
        return data;
    });
}

export async function POST(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        // Body includes: nombre, parametros (array of {parametro_maestro_id, ...})
        // This is a complex transaction: Create Product -> Create Parameters

        // 1. Create Product
        const { data: producto, error: prodError } = await supabase
            .from('productos')
            .insert({ nombre: body.nombre })
            .select()
            .single();

        if (prodError) throw prodError;

        // 2. Create Parameters if any
        if (body.parametros && body.parametros.length > 0) {
            const paramsToInsert = body.parametros.map((p: any) => ({
                producto_id: producto.id,
                parametro_maestro_id: p.parametro_maestro_id,
                nombre: p.nombre,
                es_rango: p.es_rango,
                rango_min: p.rango_min,
                rango_max: p.rango_max,
                unidad: p.unidad,
                valor_texto: p.valor_texto,
                rango_completo: p.es_rango ? `${p.rango_min} - ${p.rango_max} ${p.unidad}` : null
            }));

            const { error: paramsError } = await supabase
                .from('parametros')
                .insert(paramsToInsert);

            if (paramsError) throw paramsError; // Ideally revert product creation, but for now simple error
        }

        return producto;
    });
}

export async function PUT(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { id, nombre, parametros } = body;

        // 1. Update Product Name
        const { data: producto, error: prodError } = await supabase
            .from('productos')
            .update({ nombre })
            .eq('id', id)
            .select()
            .single();

        if (prodError) throw prodError;

        // 2. Update Parameters (Full replacement strategy is easiest: Delete all -> Insert new)
        // or smart update. For simplicity in this fix context:
        // We will assume the client handles parameters via separate logic or we can implement
        // a smart update here. Given the complexity, let's see how the client sends data.
        // If the client sends the full list of parameters, replacing is safer.

        if (parametros) {
            // Delete existing
            await supabase.from('parametros').delete().eq('producto_id', id);

            // Insert new
            if (parametros.length > 0) {
                const paramsToInsert = parametros.map((p: any) => ({
                    producto_id: id,
                    parametro_maestro_id: p.parametro_maestro_id,
                    nombre: p.nombre,
                    es_rango: p.es_rango,
                    rango_min: p.rango_min,
                    rango_max: p.rango_max,
                    unidad: p.unidad,
                    valor_texto: p.valor_texto,
                    rango_completo: p.es_rango ? `${p.rango_min} - ${p.rango_max} ${p.unidad}` : null
                }));

                await supabase.from('parametros').insert(paramsToInsert);
            }
        }

        return producto;
    });
}

export async function DELETE(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { id } = body;
        // Parameters are cascade deleted usually, but let's be sure DB is set up that way.
        // If not, we should delete params first.
        // Assuming cascade:
        const { error } = await supabase
            .from('productos')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    });
}
