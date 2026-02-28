import { NextResponse } from 'next/server';
import { getAuthUserId, createServiceClient } from '@/lib/api/withAuth';

export async function GET(request: Request) {
    try {
        const auth = await getAuthUserId();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        if (!auth) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabase = createServiceClient();

        if (type === 'locales') {
            // Get unique local parameters (parametro_maestro_id IS NULL)
            // We group by name and type to show candidates for standardization
            const { data, error } = await supabase
                .from('parametros')
                .select('nombre, tipo, producto_id, productos(nombre)')
                .is('parametro_maestro_id', null);

            if (error) throw error;

            // Group by name and type to count occurrences
            const grouped = data.reduce((acc: any, curr: any) => {
                const key = `${curr.nombre.toLowerCase()}-${curr.tipo}`;
                if (!acc[key]) {
                    acc[key] = {
                        nombre: curr.nombre,
                        tipo: curr.tipo,
                        frecuencia: 0,
                        productos: []
                    };
                }
                acc[key].frecuencia += 1;
                if (curr.productos?.nombre) {
                    acc[key].productos.push(curr.productos.nombre);
                }
                return acc;
            }, {});

            return NextResponse.json(Object.values(grouped));
        }

        const { data, error } = await supabase
            .from('parametros_maestros')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { data, error } = await supabase
            .from('parametros_maestros')
            .insert(body)
            .select()
            .single();
        if (error) throw error;
        return data;
    });
}

export async function PUT(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { id, ...updates } = body;
        const { data, error } = await supabase
            .from('parametros_maestros')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    });
}

export async function DELETE(request: Request) {
    return handleRequest(request, async (supabase, body) => {
        const { id } = body; // Expect { id: X } in body or query param? Let's use body for consistency
        const { error } = await supabase
            .from('parametros_maestros')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return { success: true };
    });
}

async function handleRequest(request: Request, action: (supabase: any, body: any) => Promise<any>) {
    try {
        const auth = await getAuthUserId();
        if (!auth) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const body = await request.json().catch(() => ({}));

        const supabase = createServiceClient();

        const result = await action(supabase, body);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
